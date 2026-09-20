// Camere scoase din vânzare: reparații, zugrăvit, folosință proprie. O blocare e tot o rezervare, deci
// baza de date o apără la fel: nimeni nu mai poate da camera în nopțile acelea.
import type { Reservation } from '@/domain/types';
import { BLOCK_GUEST } from '@/domain/register';
import type { Db } from './db';
import { DomainError } from './errors';
import { createReservation } from './repo';

export { BLOCK_GUEST };

/**
 * O rezervare are nevoie de un oaspete, iar o blocare nu are unul. Rândul tehnic e refăcut la nevoie, pentru că
 * ștergerea datelor de probă sau reîncărcarea demo-ului golește tabelul de oaspeți.
 */
async function ensureBlockGuest(db: Db) {
  const [g] = await db.query('SELECT id FROM guests WHERE id = $1', [BLOCK_GUEST]);
  if (!g) await db.query('INSERT INTO guests (id, first_name, last_name, phone, email, country, notes) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [BLOCK_GUEST, 'Cameră', 'blocată', '', '', '', 'Rând tehnic: ține locul oaspetelui la camerele blocate pentru reparații.']);
}

/** { roomIds, checkIn, checkOut, reason } */
export async function createBlock(db: Db, raw: unknown): Promise<{ reservation: Reservation }> {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const reason = (typeof b.reason === 'string' ? b.reason.trim() : '').slice(0, 200);
  if (!reason) throw new DomainError(400, 'Scrie de ce blochezi camera (ex: „zugrăvit”).');
  await ensureBlockGuest(db);
  const out = await createReservation(db, {
    guestId: BLOCK_GUEST, roomIds: b.roomIds, checkIn: b.checkIn, checkOut: b.checkOut,
    pax: 1, total: 0, source: 'other', status: 'confirmed', notes: reason,
  });
  await db.query("UPDATE reservations SET kind = 'block' WHERE id = $1", [out.reservation.id]);
  return { reservation: { ...out.reservation, kind: 'block' } };
}

/** Se șterge de tot: o blocare nu are istoric de păstrat. */
export async function deleteBlock(db: Db, id: string): Promise<Reservation> {
  const [r] = await db.query<{ id: string; kind: string; notes: string; checkIn: string; checkOut: string }>(
    'SELECT id, kind, notes, check_in AS `checkIn`, check_out AS `checkOut` FROM reservations WHERE id = $1', [id]);
  if (!r) throw new DomainError(404, 'Blocarea nu mai există.');
  if (r.kind !== 'block') throw new DomainError(400, 'Aceasta este o rezervare, nu o blocare.');
  await db.query('DELETE FROM reservations WHERE id = $1', [id]);
  return r as unknown as Reservation;
}
