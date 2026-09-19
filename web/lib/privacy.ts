// Datele personale ale unui oaspete: tot ce știm despre el, la cerere, și ștergerea lor.
import { todayIso } from '@/domain/dates';
import type { Guest } from '@/domain/types';
import type { Db } from './db';
import { GUEST_COLS } from './repo';
import { DomainError } from './errors';

export const ERASED_FIRST = 'Oaspete', ERASED_LAST = 'șters';

/** Tot ce ține programul despre un om: datele lui, șederile, plățile și facturile. */
export async function exportGuest(db: Db, id: string) {
  const [guest] = await db.query('SELECT id, first_name AS prenume, last_name AS nume, phone AS telefon, email, country AS tara, notes AS observatii, ' +
    'birth_date AS data_nasterii, birth_place AS locul_nasterii, citizenship AS cetatenia, address AS domiciliul, id_type AS act, id_series AS seria, id_number AS numarul, ' +
    'created_at AS adaugat_la FROM guests WHERE id = $1', [id]);
  if (!guest) throw new DomainError(404, 'Oaspetele nu mai există.');
  const stays = await db.query(
    `SELECT r.id, r.check_in AS sosire, r.check_out AS plecare, r.pax AS persoane, r.total, r.source AS sursa, r.status AS stare, r.notes AS observatii,
            (SELECT GROUP_CONCAT(rm.name ORDER BY rr.position SEPARATOR ' + ') FROM reservation_rooms rr JOIN rooms rm ON rm.id = rr.room_id WHERE rr.reservation_id = r.id) AS camere
       FROM reservations r WHERE r.guest_id = $1 ORDER BY r.check_in`, [id]);
  const payments = await db.query(
    'SELECT p.reservation_id AS rezervare, p.amount AS suma, p.method AS metoda, p.paid_on AS data, p.note AS nota FROM payments p JOIN reservations r ON r.id = p.reservation_id WHERE r.guest_id = $1 ORDER BY p.paid_on', [id]);
  const invoices = await db.query(
    'SELECT series AS serie, `number` AS numar, issued_on AS data, buyer_name AS client, buyer_tax_id AS cui_cnp, buyer_address AS adresa, total FROM invoices WHERE guest_id = $1 ORDER BY issued_on', [id]);
  return { exportat_la: new Date().toISOString(), oaspete: guest, sederi: stays, plati: payments, facturi: invoices };
}

/**
 * Șterge datele personale, dar păstrează șederile și banii, ca statisticile și contabilitatea să rămână întregi.
 * Facturile emise nu se ating: legea cere păstrarea lor, cu numele clientului cu tot.
 * Nu se poate cât timp omul e cazat sau are o rezervare care urmează.
 */
export async function anonymizeGuest(db: Db, id: string): Promise<{ guest: Guest; invoicesKept: number }> {
  return db.tx(async q => {
    const [g] = await q<{ id: string; fullname: string }>("SELECT id, TRIM(CONCAT(first_name, ' ', last_name)) AS fullname FROM guests WHERE id = $1", [id]);
    if (!g) throw new DomainError(404, 'Oaspetele nu mai există.');
    const [{ n }] = await q<{ n: number }>("SELECT count(*) AS n FROM reservations WHERE guest_id = $1 AND status <> 'cancelled' AND check_out >= $2", [id, todayIso()]);
    if (Number(n) > 0) throw new DomainError(400, 'Oaspetele e cazat acum sau are o rezervare care urmează. Datele lui se pot șterge după plecare, sau după ce anulezi rezervarea.');
    await q(`UPDATE guests SET first_name = $2, last_name = $3, phone = '', email = '', notes = '', birth_date = NULL, birth_place = '',
             citizenship = '', address = '', id_type = '', id_series = '', id_number = '' WHERE id = $1`, [id, ERASED_FIRST, ERASED_LAST]);
    await q("UPDATE reservations SET notes = '' WHERE guest_id = $1", [id]);
    // numele lui apare și în rezumatele din jurnal; rândurile rămân, numele nu
    if (g.fullname.length > 2) await q('UPDATE audit_log SET summary = REPLACE(summary, $1, $2) WHERE summary LIKE $3', [g.fullname, `${ERASED_FIRST} ${ERASED_LAST}`, `%${g.fullname.replace(/[%_]/g, '')}%`]);
    const [{ k }] = await q<{ k: number }>('SELECT count(*) AS k FROM invoices WHERE guest_id = $1', [id]);
    const [guest] = await q<Guest>(`SELECT ${GUEST_COLS} FROM guests WHERE id = $1`, [id]);
    return { guest, invoicesKept: Number(k) };
  });
}
