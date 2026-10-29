// Citirea calendarelor din afară, pe un MySQL adevărat; calendarul însuși e un text dat de test, nu luat de pe internet.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { tinyState } from '@/domain/fixtures';
import { type Db } from './db';
import { freshDb, resetTo } from './testdb';
import { DomainError } from './errors';
import { parseIcs } from '@/domain/ical';
import { addFeed, deleteFeed, exportIcs, exportToken, listFeeds, syncFeed, type Feed } from './ical';
import { createReservation, loadState, updateReservation } from './repo';

let db: Db;
beforeAll(async () => { db = await freshDb(); }, 120_000);
afterAll(() => db.close());
beforeEach(() => resetTo(db, tinyState()));

const TODAY = '2030-01-01';
const room = () => tinyState().rooms[0];
const cal = (evs: [string, string, string, string?][]) => 'BEGIN:VCALENDAR\r\n' + evs.map(([uid, s, e, sum]) =>
  `BEGIN:VEVENT\r\nUID:${uid}\r\nDTSTART;VALUE=DATE:${s.replace(/-/g, '')}\r\nDTEND;VALUE=DATE:${e.replace(/-/g, '')}\r\nSUMMARY:${sum ?? 'CLOSED - Not available'}\r\nEND:VEVENT\r\n`).join('') + 'END:VCALENDAR\r\n';
const feed = (source = 'booking') => addFeed(db, { roomId: room().id, source, url: 'https://exemplu.ro/cal.ics' });
const sync = (f: Feed, text: string) => syncFeed(db, f, async () => text, TODAY);
const fromFeed = async () => (await loadState(db)).reservations.filter(r => r.notes.startsWith('Adusă automat'));
const status = async (p: Promise<unknown>) => { try { await p; return 200; } catch (e) { return e instanceof DomainError ? e.status : 500; } };

describe('linkurile', () => {
  it('se adaugă pe o cameră, apar cu numele ei și se scot', async () => {
    const f = await feed('airbnb');
    expect(f).toMatchObject({ roomId: room().id, roomName: room().name, source: 'airbnb', lastSync: null, lastError: '' });
    expect(await listFeeds(db)).toHaveLength(1);
    await deleteFeed(db, f.id);
    expect(await listFeeds(db)).toHaveLength(0);
    expect(await status(deleteFeed(db, f.id))).toBe(404);
  });
  it('refuză ce nu e link, camera care nu există, sursa inventată și același link pus de două ori', async () => {
    expect(await status(addFeed(db, { roomId: room().id, source: 'booking', url: 'calendarul meu' }))).toBe(400);
    expect(await status(addFeed(db, { roomId: room().id, source: 'booking', url: 'file:///C:/x.ics' }))).toBe(400);
    expect(await status(addFeed(db, { roomId: 'nu_exista', source: 'booking', url: 'https://x.ro/a.ics' }))).toBe(400);
    expect(await status(addFeed(db, { roomId: room().id, source: 'inventata', url: 'https://x.ro/a.ics' }))).toBe(400);
    await feed();
    expect(await status(feed())).toBe(409);
  });
});

describe('linkul nostru pentru site-uri', () => {
  it('arată nopțile ocupate de acum încolo, fără nume și bani, și se poate citi la loc', async () => {
    await createReservation(db, { guestName: 'Secret Popescu', guestPhone: '0722 111 222', roomIds: [room().id], checkIn: '2030-02-10', checkOut: '2030-02-13', pax: 2, total: 777, notes: 'alergic' });
    await createReservation(db, { guestName: 'Trecut Demult', roomIds: [room().id], checkIn: '2029-11-01', checkOut: '2029-11-03', pax: 1, total: 100 });
    const { reservation: c } = await createReservation(db, { guestName: 'Anulat Azi', roomIds: [room().id], checkIn: '2030-05-01', checkOut: '2030-05-03', pax: 1, total: 100 });
    await updateReservation(db, c.id, { status: 'cancelled' });
    const token = await exportToken(db, room().id);
    const ics = (await exportIcs(db, token, TODAY))!;
    expect(parseIcs(ics).map(e => [e.start, e.end, e.summary])).toEqual([['2030-02-10', '2030-02-13', 'Ocupat']]);
    for (const secret of ['Popescu', '0722', '777', 'alergic']) expect(ics).not.toContain(secret);
  });
  it('codul rămâne același până e schimbat; cel vechi și cele inventate nu mai dau nimic', async () => {
    const t1 = await exportToken(db, room().id);
    expect(await exportToken(db, room().id)).toBe(t1);
    const t2 = await exportToken(db, room().id, true);
    expect(t2).not.toBe(t1);
    expect(await exportIcs(db, t1, TODAY)).toBeNull();
    expect(await exportIcs(db, "' OR 1=1 --", TODAY)).toBeNull();
    expect(await exportIcs(db, t2, TODAY)).toContain('BEGIN:VCALENDAR');
    expect(await status(exportToken(db, 'nu_exista'))).toBe(404);
  });
});

describe('citirea', () => {
  it('aduce rezervările viitoare ca rezervări obișnuite, pe camera și sursa linkului; trecutul rămâne afară', async () => {
    const f = await feed();
    const rep = await sync(f, cal([['a', '2030-02-10', '2030-02-13'], ['vechi', '2029-12-01', '2029-12-05'], ['b', '2030-03-01', '2030-03-02', 'Ion Popescu']]));
    expect(rep).toMatchObject({ added: 2, changed: 0, cancelled: 0, conflicts: [], error: '' });
    const got = await fromFeed(), s = await loadState(db);
    expect(got.map(r => [r.checkIn, r.checkOut, r.source, r.status, r.roomIds.join()]).sort()).toEqual([
      ['2030-02-10', '2030-02-13', 'booking', 'confirmed', room().id], ['2030-03-01', '2030-03-02', 'booking', 'confirmed', room().id]]);
    expect(got.map(r => { const g = s.guests.find(x => x.id === r.guestId)!; return `${g.firstName} ${g.lastName}`; }).sort()).toEqual(['Ion Popescu', 'Rezervare Booking.com']);
    expect((await listFeeds(db))[0].lastSync).toMatch(/^\d{4}-/);
  });

  it('a doua citire a aceluiași calendar nu face nimic a doua oară', async () => {
    const f = await feed(), text = cal([['a', '2030-02-10', '2030-02-13']]);
    await sync(f, text);
    expect(await sync(f, text)).toMatchObject({ added: 0, changed: 0, cancelled: 0 });
    expect(await fromFeed()).toHaveLength(1);
  });

  it('camera adusă din calendar nu mai poate fi dată la telefon pe aceleași nopți', async () => {
    await sync(await feed(), cal([['a', '2030-02-10', '2030-02-13']]));
    expect(await status(createReservation(db, { guestName: 'La Telefon', roomIds: [room().id], checkIn: '2030-02-12', checkOut: '2030-02-14', pax: 2, total: 300 }))).toBe(409);
  });

  it('o rezervare mutată pe site se mută și la noi, fără să piardă ce a completat omul', async () => {
    const f = await feed();
    await sync(f, cal([['a', '2030-02-10', '2030-02-13']]));
    const [r] = await fromFeed();
    await updateReservation(db, r.id, { total: 900, pax: 3 });
    expect(await sync(f, cal([['a', '2030-02-11', '2030-02-15']]))).toMatchObject({ added: 0, changed: 1 });
    const after = (await loadState(db)).reservations.find(x => x.id === r.id)!;
    expect(after).toMatchObject({ checkIn: '2030-02-11', checkOut: '2030-02-15', total: 900, pax: 3 });
  });

  it('ce dispare din calendar se anulează la noi și eliberează camera; dacă reapare, revine', async () => {
    const f = await feed();
    await sync(f, cal([['a', '2030-02-10', '2030-02-13'], ['b', '2030-03-01', '2030-03-03']]));
    expect(await sync(f, cal([['b', '2030-03-01', '2030-03-03']]))).toMatchObject({ cancelled: 1, added: 0 });
    expect((await fromFeed()).find(r => r.checkIn === '2030-02-10')!.status).toBe('cancelled');
    expect(await status(createReservation(db, { guestName: 'Alt Om', roomIds: [room().id], checkIn: '2030-02-20', checkOut: '2030-02-22', pax: 1, total: 100 }))).toBe(200);
    expect(await sync(f, cal([['a', '2030-02-10', '2030-02-13'], ['b', '2030-03-01', '2030-03-03']]))).toMatchObject({ changed: 1, added: 0 });
    expect((await fromFeed()).find(r => r.checkIn === '2030-02-10')!.status).toBe('confirmed');
  });

  it('o rezervare făcută de mână nu e anulată niciodată de calendar, iar un oaspete deja cazat nu e atins', async () => {
    const f = await feed();
    const { reservation: manual } = await createReservation(db, { guestName: 'De Mana', roomIds: [room().id], checkIn: '2030-04-01', checkOut: '2030-04-03', pax: 1, total: 100 });
    await sync(f, cal([['a', '2030-02-10', '2030-02-13']]));
    const [r] = await fromFeed();
    await updateReservation(db, r.id, { status: 'checked_in' });
    expect(await sync(f, cal([]))).toMatchObject({ cancelled: 0, changed: 0 });
    const s = await loadState(db);
    expect(s.reservations.find(x => x.id === manual.id)!.status).toBe('confirmed');
    expect(s.reservations.find(x => x.id === r.id)!.status).toBe('checked_in');
  });

  it('camera deja ocupată la noi: rezervarea de pe site nu intră și e raportată, restul intră', async () => {
    await createReservation(db, { guestName: 'Era Deja', roomIds: [room().id], checkIn: '2030-02-11', checkOut: '2030-02-12', pax: 1, total: 100 });
    const rep = await sync(await feed(), cal([['a', '2030-02-10', '2030-02-13'], ['b', '2030-03-01', '2030-03-03']]));
    expect(rep.added).toBe(1);
    expect(rep.conflicts).toHaveLength(1);
    expect(rep.conflicts[0]).toMatch(/2030-02-10 – 2030-02-13.*Era Deja/);
    // la următoarea citire încearcă din nou, deci după ce omul eliberează camera, intră
    expect((await sync((await listFeeds(db))[0], cal([['a', '2030-02-10', '2030-02-13'], ['b', '2030-03-01', '2030-03-03']]))).conflicts).toHaveLength(1);
  });

  it('un link stricat sau un calendar venit gol nu anulează nimic și lasă eroarea la vedere', async () => {
    const f = await feed();
    await sync(f, cal([['a', '2030-02-10', '2030-02-13'], ['b', '2030-03-01', '2030-03-03']]));
    const bad = await syncFeed(db, f, async () => { throw new Error('Site-ul a răspuns cu 500.'); }, TODAY);
    expect(bad.error).toBe('Site-ul a răspuns cu 500.');
    expect((await sync(f, '<html>eroare</html>')).error).toMatch(/nu duce la un calendar/);
    expect((await listFeeds(db))[0].lastError).toMatch(/nu duce la un calendar/);
    const empty = await sync(f, cal([]));
    expect(empty).toMatchObject({ cancelled: 0 });
    expect(empty.error).toMatch(/venit gol/);
    expect((await fromFeed()).every(r => r.status === 'confirmed')).toBe(true);
    // o citire bună șterge eroarea
    await sync(f, cal([['a', '2030-02-10', '2030-02-13'], ['b', '2030-03-01', '2030-03-03']]));
    expect((await listFeeds(db))[0].lastError).toBe('');
  });

  it('propriile noastre rezervări, trimise înapoi de site ca „blocat”, nu se fac a doua oară și nu apar drept conflict', async () => {
    await createReservation(db, { guestName: 'La Telefon', roomIds: [room().id], checkIn: '2030-02-10', checkOut: '2030-02-14', pax: 2, total: 800 });
    const rep = await sync(await feed('airbnb'), cal([['ecou', '2030-02-10', '2030-02-14', 'Airbnb (Not available)'], ['bucata', '2030-02-11', '2030-02-13']]));
    expect(rep).toMatchObject({ added: 0, conflicts: [], error: '' });
    expect(await fromFeed()).toHaveLength(0);
  });

  it('scoaterea linkului lasă rezervările aduse', async () => {
    const f = await feed();
    await sync(f, cal([['a', '2030-02-10', '2030-02-13']]));
    await deleteFeed(db, f.id);
    expect(await fromFeed()).toHaveLength(1);
    expect((await db.query<{ n: number }>('SELECT COUNT(*) AS n FROM ical_links'))[0].n).toBe(0);
  });
});
