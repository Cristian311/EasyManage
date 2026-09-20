// Jurnalul: cine a făcut ce. Scris din rute, după ce schimbarea a reușit. O eroare la scrierea
// jurnalului nu are voie să strice operația omului, de aceea e înghițită și doar notată în consolă.
import { fmtD } from '@/domain/dates';
import type { User } from './auth';
import type { Db } from './db';

export interface AuditRow { id: number; at: string; userName: string; action: string; entity: string; entityId: string; summary: string }

export const ACTIONS: Record<string, string> = {
  'reservation.create': 'Rezervare nouă', 'reservation.update': 'Rezervare schimbată', 'reservation.delete': 'Rezervare ștearsă',
  'block.create': 'Cameră blocată', 'block.delete': 'Blocare scoasă',
  'reservation.merge': 'Rezervări unite', 'reservation.import': 'Import de rezervări', 'payment.add': 'Încasare', 'extra.add': 'Serviciu adăugat', 'extra.delete': 'Serviciu scos',
  'invoice.create': 'Factură emisă', 'invoice.storno': 'Factură stornată',
  'expense.create': 'Cheltuială nouă', 'expense.update': 'Cheltuială schimbată', 'expense.delete': 'Cheltuială ștearsă',
  'rates.set': 'Prețuri schimbate', 'room.create': 'Cameră nouă', 'room.update': 'Cameră schimbată', 'room.delete': 'Cameră ștearsă', 'room.order': 'Camere rearanjate',
  'floor.create': 'Etaj nou', 'floor.update': 'Etaj schimbat', 'floor.delete': 'Etaj șters',
  'property.create': 'Proprietate nouă', 'property.update': 'Proprietate schimbată', 'property.delete': 'Proprietate ștearsă',
  'guest.update': 'Date oaspete schimbate', 'guest.export': 'Date oaspete exportate', 'guest.anonymize': 'Date personale șterse',
  'user.create': 'Cont nou', 'user.update': 'Cont schimbat', 'user.delete': 'Cont șters', 'user.login': 'Intrare în cont', 'user.setup': 'Primul cont',
  'settings.company': 'Datele pensiunii schimbate', 'settings.template': 'Mesajul de confirmare schimbat', 'settings.hours': 'Orele de sosire/plecare schimbate',
  'backup.create': 'Copie de siguranță', 'backup.dir': 'Folderul copiilor schimbat', 'backup.download': 'Copie descărcată', 'demo.reset': 'Date demo reîncărcate', 'demo.clean': 'Date demo șterse, camerele păstrate',
  'ical.add': 'Calendar extern adăugat', 'ical.delete': 'Calendar extern scos', 'ical.sync': 'Calendare externe citite', 'ical.renew': 'Link de calendar schimbat',
};

export async function audit(db: Db, user: Pick<User, 'id' | 'name'> | null, action: string, entity = '', entityId = '', summary = ''): Promise<void> {
  try {
    await db.query('INSERT INTO audit_log (user_id, user_name, action, entity, entity_id, summary) VALUES ($1,$2,$3,$4,$5,$6)',
      [user?.id ?? null, user?.name ?? '', action, entity, entityId, summary.slice(0, 500)]);
  } catch (e) { console.error('[jurnal]', (e as Error).message); }
}

/** „Ion Popescu, 101 + 102, 12 aug – 15 aug, 750 lei” — ca rândul din jurnal să se înțeleagă și după ce rezervarea dispare. */
export async function resLabel(db: Db, id: string): Promise<string> {
  const [r] = await db.query<{ guest: string; rooms: string | null; checkIn: string; checkOut: string; total: number }>(
    `SELECT TRIM(CONCAT(g.first_name, ' ', g.last_name)) AS guest, r.check_in AS \`checkIn\`, r.check_out AS \`checkOut\`, r.total,
            (SELECT GROUP_CONCAT(rm.name ORDER BY rr.position SEPARATOR ' + ') FROM reservation_rooms rr JOIN rooms rm ON rm.id = rr.room_id WHERE rr.reservation_id = r.id) AS rooms
       FROM reservations r JOIN guests g ON g.id = r.guest_id WHERE r.id = $1`, [id]);
  return r ? `${r.guest}, ${r.rooms ?? '—'}, ${fmtD(r.checkIn)} – ${fmtD(r.checkOut)}, ${Math.round(Number(r.total)).toLocaleString('ro-RO')} lei` : id;
}

/** Ultimele rânduri, cele mai noi întâi; cu text de căutat în rezumat, om sau fel. */
export async function listAudit(db: Db, q = '', limit = 500): Promise<AuditRow[]> {
  const s = q.trim().slice(0, 100), like = `%${s.replace(/[%_\\]/g, m => '\\' + m)}%`;
  const n = Math.min(2000, Math.max(1, Math.round(limit)));
  return db.query<AuditRow>(
    `SELECT id, at, user_name AS \`userName\`, action, entity, entity_id AS \`entityId\`, summary FROM audit_log
      ${s ? 'WHERE summary LIKE $1 OR user_name LIKE $1 OR action LIKE $1' : ''} ORDER BY id DESC LIMIT ${n}`, s ? [like] : []);
}

/** Câmpurile trimise într-o cerere, pe românește, pentru „a schimbat: …”. */
export function changed(body: unknown, names: Record<string, string>): string {
  const keys = body && typeof body === 'object' ? Object.keys(body as object) : [];
  return keys.map(k => names[k]).filter(Boolean).join(', ');
}
