// Calendarele din afară (Booking, Airbnb, Travelminit): linkurile .ics ale camerelor și citirea lor.
// Ce vine de acolo devine o rezervare obișnuită la noi, deci camera nu mai poate fi dată a doua oară.
import { randomBytes } from 'node:crypto';
import { todayIso } from '@/domain/dates';
import { icsGuestName, parseIcs, toIcs, type IcsEvent } from '@/domain/ical';
import { SOURCES, SRC } from '@/domain/labels';
import type { Source } from '@/domain/types';
import type { Db } from './db';
import { DomainError } from './errors';
import { newId } from './ids';
import { createReservation, updateReservation } from './repo';

export interface Feed { id: string; roomId: string; roomName: string; source: Source; url: string; lastSync: string | null; lastError: string }
export interface SyncReport { feedId: string; roomName: string; source: Source; added: number; changed: number; cancelled: number; conflicts: string[]; error: string }
export type FetchText = (url: string) => Promise<string>;

const FEED_COLS = 'f.id, f.room_id AS `roomId`, rm.name AS `roomName`, f.source, f.url, f.last_sync AS `lastSync`, f.last_error AS `lastError`';

export const listFeeds = (db: Db) => db.query<Feed>(`SELECT ${FEED_COLS} FROM ical_feeds f JOIN rooms rm ON rm.id = f.room_id ORDER BY rm.sort, rm.name, f.created_at`);

export async function addFeed(db: Db, raw: unknown): Promise<Feed> {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const roomId = typeof b.roomId === 'string' ? b.roomId : '', url = typeof b.url === 'string' ? b.url.trim() : '';
  const source = (typeof b.source === 'string' ? b.source : 'booking') as Source;
  if (!SOURCES.includes(source)) throw new DomainError(400, 'Sursa nu este validă.');
  let u: URL | null = null; try { u = new URL(url); } catch {}
  if (!u || !/^https?:$/.test(u.protocol) || url.length > 1000) throw new DomainError(400, 'Lipește linkul întreg al calendarului, cel care începe cu https://');
  const [room] = await db.query('SELECT id FROM rooms WHERE id = $1', [roomId]);
  if (!room) throw new DomainError(400, 'Alege camera.');
  const [dup] = await db.query('SELECT id FROM ical_feeds WHERE room_id = $1 AND url = $2', [roomId, url]);
  if (dup) throw new DomainError(409, 'Linkul acesta este deja pus la camera aceasta.');
  const id = newId('ical_');
  await db.query('INSERT INTO ical_feeds (id, room_id, source, url) VALUES ($1,$2,$3,$4)', [id, roomId, source, url]);
  return (await db.query<Feed>(`SELECT ${FEED_COLS} FROM ical_feeds f JOIN rooms rm ON rm.id = f.room_id WHERE f.id = $1`, [id]))[0];
}

/** Rezervările deja aduse rămân; doar nu mai sunt ținute la zi. */
export async function deleteFeed(db: Db, id: string) {
  const [f] = await db.query<Feed>(`SELECT ${FEED_COLS} FROM ical_feeds f JOIN rooms rm ON rm.id = f.room_id WHERE f.id = $1`, [id]);
  if (!f) throw new DomainError(404, 'Linkul nu mai există.');
  await db.query('DELETE FROM ical_feeds WHERE id = $1', [id]);
  return f;
}

export const fetchIcs: FetchText = async url => {
  const r = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { accept: 'text/calendar, text/plain, */*' }, redirect: 'follow' });
  if (!r.ok) throw new Error(`Site-ul a răspuns cu ${r.status}.`);
  const text = await r.text();
  if (text.length > 3_000_000) throw new Error('Calendarul este neobișnuit de mare.');
  return text;
};

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 290);

/**
 * Citește un calendar și aduce rezervările la zi: cele noi se adaugă, cele mutate se mută, cele care au dispărut
 * de acolo (anulate pe site) se anulează și la noi. Trecutul nu se atinge. Dacă o cameră e deja ocupată la noi,
 * rezervarea nu intră și apare la „conflicts”, ca omul să o rezolve de mână.
 */
export async function syncFeed(db: Db, feed: Feed, fetchText: FetchText = fetchIcs, today = todayIso()): Promise<SyncReport> {
  const rep: SyncReport = { feedId: feed.id, roomName: feed.roomName, source: feed.source, added: 0, changed: 0, cancelled: 0, conflicts: [], error: '' };
  let events: IcsEvent[];
  try { events = parseIcs(await fetchText(feed.url)).filter(e => e.end > today); }
  catch (e) {
    rep.error = msg(e);
    await db.query('UPDATE ical_feeds SET last_error = $2 WHERE id = $1', [feed.id, rep.error]);
    return rep;
  }
  const links = await db.query<{ uid: string; reservationId: string; checkIn: string; checkOut: string; status: string }>(
    'SELECT l.uid, l.reservation_id AS `reservationId`, r.check_in AS `checkIn`, r.check_out AS `checkOut`, r.status FROM ical_links l JOIN reservations r ON r.id = l.reservation_id WHERE l.feed_id = $1', [feed.id]);
  const known = new Map(links.map(l => [l.uid, l]));
  const label = SRC[feed.source] ?? 'din calendar';

  for (const e of events) {
    const k = known.get(e.uid);
    try {
      if (!k) {
        // site-urile care citesc și calendarul nostru ne trimit înapoi propriile rezervări ca „blocat”: dacă nopțile
        // acelea sunt deja acoperite întregi de o rezervare de la noi, nu e nimic nou de adus
        const [own] = await db.query(`SELECT r.id FROM reservations r JOIN reservation_rooms rr ON rr.reservation_id = r.id
          WHERE rr.room_id = $1 AND r.status <> 'cancelled' AND r.check_in <= $2 AND r.check_out >= $3 LIMIT 1`, [feed.roomId, e.start, e.end]);
        if (own) continue;
        const { reservation } = await createReservation(db, {
          guestName: icsGuestName(e.summary, label), roomIds: [feed.roomId], checkIn: e.start, checkOut: e.end, pax: 1, total: 0,
          source: feed.source, status: 'confirmed', notes: `Adusă automat din calendarul ${label}. Completează numele, persoanele și prețul.`,
        });
        await db.query('INSERT INTO ical_links (feed_id, uid, reservation_id) VALUES ($1,$2,$3)', [feed.id, e.uid, reservation.id]);
        rep.added++;
      } else if (k.status !== 'checked_in' && k.status !== 'checked_out' && (k.checkIn !== e.start || k.checkOut !== e.end || k.status === 'cancelled')) {
        await updateReservation(db, k.reservationId, { checkIn: e.start, checkOut: e.end, ...(k.status === 'cancelled' ? { status: 'confirmed' } : {}) });
        rep.changed++;
      }
    } catch (err) {
      if (err instanceof DomainError && err.status === 409) rep.conflicts.push(`${feed.roomName}, ${e.start} – ${e.end}: ${err.message}`);
      else rep.conflicts.push(`${feed.roomName}, ${e.start} – ${e.end}: ${msg(err)}`);
    }
  }

  // ce nu mai e în calendar a fost anulat pe site. Un calendar gol când noi avem rezervări de acolo e mai degrabă o
  // problemă a site-ului decât zece anulări deodată, deci atunci nu anulăm nimic.
  const seen = new Set(events.map(e => e.uid));
  const gone = links.filter(l => !seen.has(l.uid) && l.checkOut > today && (l.status === 'confirmed' || l.status === 'pending'));
  if (gone.length && !events.length && gone.length > 1) rep.error = 'Calendarul a venit gol, deși aveam rezervări din el. Nu am anulat nimic; verifică linkul.';
  else for (const l of gone) {
    try { await updateReservation(db, l.reservationId, { status: 'cancelled' }); rep.cancelled++; } catch (err) { rep.conflicts.push(msg(err)); }
  }
  // ce nu a intrat rămâne scris la link, ca să se vadă în Azi și în Setări până e rezolvat
  const left = rep.error || (rep.conflicts.length ? `${rep.conflicts.length === 1 ? 'O rezervare de pe site nu a intrat' : `${rep.conflicts.length} rezervări de pe site nu au intrat`}: ${rep.conflicts[0]}`.slice(0, 290) : '');
  await db.query('UPDATE ical_feeds SET last_sync = now(), last_error = $2 WHERE id = $1', [feed.id, left]);
  return rep;
}

export async function syncAll(db: Db, fetchText: FetchText = fetchIcs): Promise<SyncReport[]> {
  const out: SyncReport[] = [];
  for (const f of await listFeeds(db)) out.push(await syncFeed(db, f, fetchText));
  return out;
}

/* ---------- calendarul nostru, pentru site-uri ---------- */

/** Codul secret al camerei; se face la prima cerere. `renew` îl schimbă, deci linkul vechi nu mai merge. */
export async function exportToken(db: Db, roomId: string, renew = false): Promise<string> {
  const [room] = await db.query('SELECT id FROM rooms WHERE id = $1', [roomId]);
  if (!room) throw new DomainError(404, 'Camera nu mai există.');
  const [cur] = await db.query<{ token: string }>('SELECT token FROM ical_exports WHERE room_id = $1', [roomId]);
  if (cur && !renew) return cur.token;
  const token = randomBytes(24).toString('hex');
  await db.query(cur ? 'UPDATE ical_exports SET token = $2 WHERE room_id = $1' : 'INSERT INTO ical_exports (room_id, token) VALUES ($1,$2)', [roomId, token]);
  return token;
}

/** Textul .ics pentru un cod, sau null dacă nu există codul. Doar nopțile ocupate de acum încolo. */
export async function exportIcs(db: Db, token: string, today = todayIso()): Promise<string | null> {
  if (!/^[0-9a-f]{48}$/.test(token)) return null;
  const [x] = await db.query<{ roomId: string; name: string }>('SELECT x.room_id AS `roomId`, rm.name FROM ical_exports x JOIN rooms rm ON rm.id = x.room_id WHERE x.token = $1', [token]);
  if (!x) return null;
  const rows = await db.query<{ id: string; checkIn: string; checkOut: string }>(
    `SELECT r.id, r.check_in AS \`checkIn\`, r.check_out AS \`checkOut\` FROM reservations r JOIN reservation_rooms rr ON rr.reservation_id = r.id
      WHERE rr.room_id = $1 AND r.status <> 'cancelled' AND r.check_out > $2 ORDER BY r.check_in`, [x.roomId, today]);
  return toIcs(rows.map(r => ({ uid: r.id, start: r.checkIn, end: r.checkOut })), x.name, new Date().toISOString());
}

/* ---------- citirea din 15 în 15 minute ---------- */

const g = globalThis as unknown as { __veloraIcalTimer?: NodeJS.Timeout };

export function startIcalSync(db: Db) {
  if (g.__veloraIcalTimer || process.env.ICAL_SYNC === 'false') return;
  const tick = async () => { try { await syncAll(db); } catch (e) { console.error('[ical]', (e as Error).message); } };
  g.__veloraIcalTimer = setInterval(tick, 15 * 60 * 1000);
  g.__veloraIcalTimer.unref?.();
  setTimeout(tick, 40_000).unref?.();
}
