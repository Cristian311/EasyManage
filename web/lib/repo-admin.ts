// Rooms, floors, properties, prices and expenses; joining two stays. These change rarely, so most of them
// simply hand back the whole state afterwards.
import type { Db, Q } from './db';
import type { AppState, Expense, Rates } from '@/domain/types';
import { addDays, isIsoDate, isWkNight } from '@/domain/dates';
import { EXP_CATS } from '@/domain/finance';
import { DomainError, isRoomTaken } from './errors';
import { newId } from './ids';
import { loadState } from './repo';

type Body = Record<string, unknown>;
const asBody = (v: unknown): Body => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new DomainError(400, 'Cerere invalidă.'); return v as Body; };
const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v) ? +v : undefined);
const bool = (v: unknown) => (typeof v === 'boolean' ? v : undefined);
const need = (v: string | undefined, msg: string) => { if (!v) throw new DomainError(400, msg); return v; };

/* ---------- properties ---------- */
export async function createProperty(db: Db, raw: unknown) {
  const b = asBody(raw), name = need(str(b.name, 120), 'Scrie numele proprietății.');
  const [{ n }] = await db.query<{ n: number }>('SELECT count(*) AS n FROM properties');
  await db.query('INSERT INTO properties (id, name, city, sort) VALUES ($1,$2,$3,$4)', [newId('p_'), name, str(b.city, 120) ?? '', n]);
  return loadState(db);
}
export async function updateProperty(db: Db, id: string, raw: unknown) {
  const b = asBody(raw);
  const [cur] = await db.query<{ name: string; city: string }>('SELECT name, city FROM properties WHERE id = $1', [id]);
  if (!cur) throw new DomainError(404, 'Proprietatea nu există.');
  await db.query('UPDATE properties SET name = $2, city = $3 WHERE id = $1', [id, str(b.name, 120) || cur.name, str(b.city, 120) ?? cur.city]);
  return loadState(db);
}
export async function deleteProperty(db: Db, id: string) {
  const [{ n }] = await db.query<{ n: number }>('SELECT count(*) AS n FROM properties');
  if (n < 2) throw new DomainError(400, 'Trebuie să rămână cel puțin o proprietate.');
  const [{ r }] = await db.query<{ r: number }>('SELECT count(*) AS r FROM rooms WHERE property_id = $1', [id]);
  if (r) throw new DomainError(400, 'Mută sau șterge întâi camerele acestei proprietăți.');
  await db.query('DELETE FROM properties WHERE id = $1', [id]);
  return loadState(db);
}

/* ---------- floors ---------- */
export async function createFloor(db: Db, raw: unknown) {
  const b = asBody(raw), name = need(str(b.name, 80), 'Scrie numele etajului.'), pid = need(str(b.propertyId, 100), 'Alege proprietatea.');
  const [p] = await db.query('SELECT id FROM properties WHERE id = $1', [pid]); if (!p) throw new DomainError(400, 'Proprietatea nu există.');
  const [{ n }] = await db.query<{ n: number }>('SELECT count(*) AS n FROM floors');
  const id = newId('f_');
  await db.query('INSERT INTO floors (id, property_id, name, sort) VALUES ($1,$2,$3,$4)', [id, pid, name, n]);
  return { id, state: await loadState(db) };
}
/** Rename, or move one step left/right among the floors of the same property (dir -1 / 1). */
export async function updateFloor(db: Db, id: string, raw: unknown) {
  const b = asBody(raw);
  await db.tx(async q => {
    const [cur] = await q<{ property_id: string; name: string }>('SELECT property_id, name FROM floors WHERE id = $1', [id]);
    if (!cur) throw new DomainError(404, 'Etajul nu există.');
    if (b.name !== undefined) await q('UPDATE floors SET name = $2 WHERE id = $1', [id, str(b.name, 80) || cur.name]);
    const dir = num(b.move);
    if (dir) {
      const all = await q<{ id: string }>('SELECT id FROM floors ORDER BY sort, id');
      const i = all.findIndex(f => f.id === id), j = i + Math.sign(dir);
      const same = await q<{ id: string }>('SELECT id FROM floors WHERE property_id = $1', [cur.property_id]);
      if (j >= 0 && j < all.length && same.some(f => f.id === all[j].id)) { [all[i], all[j]] = [all[j], all[i]]; }
      for (const [k, f] of all.entries()) await q('UPDATE floors SET sort = $2 WHERE id = $1', [f.id, k]);
    }
  });
  return loadState(db);
}
export async function deleteFloor(db: Db, id: string) {
  await db.query('DELETE FROM floors WHERE id = $1', [id]);   // rooms on it keep their property, without a floor
  return loadState(db);
}

/* ---------- rooms ---------- */
async function roomFields(q: Q, b: Body, cur?: Record<string, unknown>) {
  const name = str(b.name, 80) ?? (cur?.name as string); if (!name) throw new DomainError(400, 'Scrie numărul sau numele camerei.');
  const pid = str(b.propertyId, 100) ?? (cur?.property_id as string); const [p] = await q('SELECT id FROM properties WHERE id = $1', [pid]);
  if (!p) throw new DomainError(400, 'Alege proprietatea.');
  const fid = b.floorId === undefined ? (cur?.floor_id as string | null) ?? null : str(b.floorId, 100) || null;
  if (fid) { const [f] = await q('SELECT id FROM floors WHERE id = $1 AND property_id = $2', [fid, pid]); if (!f) throw new DomainError(400, 'Etajul nu aparține acestei proprietăți.'); }
  const capacity = num(b.capacity) ?? (cur?.capacity as number) ?? 2, price = num(b.price) ?? (cur?.price as number) ?? 0;
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 50) throw new DomainError(400, 'Capacitatea nu este validă.');
  if (price < 0 || price > 1e6) throw new DomainError(400, 'Prețul nu este valid.');
  return { name, pid, fid, type: str(b.type, 60) ?? (cur?.type as string) ?? 'Cameră', capacity: Math.round(capacity), price: Math.round(price),
    color: str(b.color, 20) ?? (cur?.color as string) ?? '', desc: str(b.desc, 500) ?? (cur?.description as string) ?? '', active: bool(b.active) ?? (cur?.active as boolean) ?? true };
}
export async function createRoom(db: Db, raw: unknown) {
  const b = asBody(raw);
  await db.tx(async q => {
    const f = await roomFields(q, b);
    const [{ n }] = await q<{ n: number }>('SELECT coalesce(max(sort), -1) + 1 AS n FROM rooms');
    await q('INSERT INTO rooms (id, property_id, floor_id, parent_id, name, type, capacity, price, color, description, active, sort) VALUES ($1,$2,$3,NULL,$4,$5,$6,$7,$8,$9,$10,$11)',
      [newId('r_'), f.pid, f.fid, f.name, f.type || 'Cameră', f.capacity, f.price, f.color, f.desc, f.active, n]);
  });
  return loadState(db);
}
export async function updateRoom(db: Db, id: string, raw: unknown) {
  const b = asBody(raw);
  await db.tx(async q => {
    const [cur] = await q<Record<string, unknown>>('SELECT * FROM rooms WHERE id = $1', [id]); if (!cur) throw new DomainError(404, 'Camera nu există.');
    const f = await roomFields(q, b, cur);
    await q('UPDATE rooms SET property_id=$2, floor_id=$3, name=$4, type=$5, capacity=$6, price=$7, color=$8, description=$9, active=$10 WHERE id=$1',
      [id, f.pid, f.fid, f.name, f.type || 'Cameră', f.capacity, f.price, f.color, f.desc, f.active]);
    await q('UPDATE rooms SET property_id=$2, floor_id=$3 WHERE parent_id=$1', [id, f.pid, f.fid]);   // units follow their room
  });
  return loadState(db);
}
export async function deleteRoom(db: Db, id: string) {
  const [{ n }] = await db.query<{ n: number }>('SELECT count(*) AS n FROM reservation_rooms WHERE room_id = $1 OR room_id IN (SELECT id FROM rooms WHERE parent_id = $1)', [id]);
  if (n) throw new DomainError(400, 'Camera are rezervări. Dezactiveaz-o în loc s-o ștergi.');
  await db.tx(async q => {
    await q('DELETE FROM rooms WHERE parent_id = $1', [id]);   // unitățile întâi, apoi camera
    await q('DELETE FROM rooms WHERE id = $1', [id]);
  });
  return loadState(db);
}
/** The calendar order of the top-level rooms, as a list of ids. Rooms not in the list keep their place at the end. */
export async function orderRooms(db: Db, raw: unknown) {
  const b = asBody(raw), ids = Array.isArray(b.ids) && b.ids.every(x => typeof x === 'string') ? (b.ids as string[]) : null;
  if (!ids) throw new DomainError(400, 'Cerere invalidă.');
  await db.tx(async q => {
    const all = (await q<{ id: string }>('SELECT id FROM rooms WHERE parent_id IS NULL ORDER BY sort, id')).map(r => r.id);
    const order = [...ids.filter(id => all.includes(id)), ...all.filter(id => !ids.includes(id))];
    for (const [k, id] of order.entries()) await q('UPDATE rooms SET sort = $2 WHERE id = $1', [id, k]);
  });
  return loadState(db);
}

/* ---------- prices ---------- */
/** Sets (or, with price null, removes) the special price on every night from..to for these rooms. */
export async function setRates(db: Db, raw: unknown): Promise<{ rates: Rates }> {
  const b = asBody(raw);
  const ids = Array.isArray(b.roomIds) && b.roomIds.every(x => typeof x === 'string') ? (b.roomIds as string[]) : [];
  let from = str(b.from) ?? '', to = str(b.to) ?? '';
  const price = b.price === null ? null : num(b.price), wkOnly = bool(b.wkOnly) ?? false;
  if (!ids.length) throw new DomainError(400, 'Alege cel puțin o cameră.');
  if (!isIsoDate(from) || !isIsoDate(to)) throw new DomainError(400, 'Perioada nu este validă.');
  if (to < from) [from, to] = [to, from];
  if (price !== null && !(price !== undefined && price > 0 && price < 1e6)) throw new DomainError(400, 'Scrie prețul pe noapte.');
  const nights: string[] = []; for (let d = from; d <= to; d = addDays(d, 1)) if (!wkOnly || isWkNight(d)) nights.push(d);
  if (nights.length > 800 * 1) throw new DomainError(400, 'Alege o perioadă mai scurtă (cel mult doi ani).');
  await db.tx(async q => {
    const rooms = await q<{ id: string; price: number }>('SELECT id, price FROM rooms WHERE id IN ($1)', [ids]);
    if (rooms.length !== ids.length) throw new DomainError(400, 'Una dintre camere nu există.');
    if (!nights.length) return;
    await q('DELETE FROM rates WHERE room_id IN ($1) AND night IN ($2)', [ids, nights]);
    const rows: unknown[] = []; let values = '';
    rooms.forEach(rm => { if (price === null || price === rm.price) return; nights.forEach(d => { values += (values ? ',' : '') + `($${rows.length + 1},$${rows.length + 2},$${rows.length + 3})`; rows.push(rm.id, d, Math.round(price)); }); });
    for (let i = 0; i < rows.length; i += 999) {
      const chunk = rows.slice(i, i + 999), vals = Array.from({ length: chunk.length / 3 }, (_, k) => `($${k * 3 + 1},$${k * 3 + 2},$${k * 3 + 3})`).join(',');
      await q(`INSERT INTO rates (room_id, night, price) VALUES ${vals}`, chunk);
    }
  });
  const rows = await db.query<{ roomId: string; night: string; price: number }>('SELECT room_id AS `roomId`, night, price FROM rates WHERE room_id IN ($1)', [ids]);
  const rates: Rates = {}; ids.forEach(id => { rates[id] = {}; }); rows.forEach(x => { rates[x.roomId][x.night] = x.price; });
  return { rates };
}

/* ---------- expenses ---------- */
function expenseFields(b: Body, cur?: Record<string, unknown>) {
  const amount = num(b.amount) ?? (cur?.amount as number), date = str(b.date) ?? (cur?.spent_on as string);
  if (!(amount > 0)) throw new DomainError(400, 'Scrie suma cheltuielii.');
  if (!isIsoDate(date)) throw new DomainError(400, 'Alege data.');
  const until = b.until === undefined ? (cur?.until as string | null) ?? null : str(b.until) || null;
  if (until && !isIsoDate(until)) throw new DomainError(400, 'Data de oprire nu este validă.');
  const category = str(b.category, 60) ?? (cur?.category as string) ?? 'Altele';
  return { amount: Math.round(amount * 100) / 100, date, category: EXP_CATS.includes(category) ? category : 'Altele', desc: str(b.desc, 300) ?? (cur?.description as string) ?? '',
    propertyId: b.propertyId === undefined ? (cur?.property_id as string | null) ?? null : str(b.propertyId, 100) || null, recurring: bool(b.recurring) ?? (cur?.recurring as boolean) ?? false, until };
}
const EXP_ROW = 'id, property_id AS `propertyId`, category, description AS `desc`, amount, spent_on AS `date`, recurring, COALESCE(`until`, \'\') AS `until`';
const readExpense = (q: Q, id: string) => q<Expense>(`SELECT ${EXP_ROW} FROM expenses WHERE id = $1`, [id]);
export async function createExpense(db: Db, raw: unknown) {
  const f = expenseFields(asBody(raw));
  return db.tx(async q => {
    if (f.propertyId) { const [p] = await q('SELECT id FROM properties WHERE id = $1', [f.propertyId]); if (!p) throw new DomainError(400, 'Proprietatea nu există.'); }
    const id = newId('e_');
    await q('INSERT INTO expenses (id, property_id, category, description, amount, spent_on, recurring, `until`) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [id, f.propertyId, f.category, f.desc, f.amount, f.date, f.recurring, f.until]);
    const [e] = await readExpense(q, id);
    return { expense: e };
  });
}
export async function updateExpense(db: Db, id: string, raw: unknown) {
  return db.tx(async q => {
    const [cur] = await q<Record<string, unknown>>('SELECT * FROM expenses WHERE id = $1', [id]); if (!cur) throw new DomainError(404, 'Cheltuiala nu există.');
    const f = expenseFields(asBody(raw), cur);
    await q('UPDATE expenses SET property_id=$2, category=$3, description=$4, amount=$5, spent_on=$6, recurring=$7, `until`=$8 WHERE id=$1',
      [id, f.propertyId, f.category, f.desc, f.amount, f.date, f.recurring, f.until]);
    const [e] = await readExpense(q, id);
    return { expense: e };
  });
}
export async function deleteExpense(db: Db, id: string) {
  return db.tx(async q => {
    const rows = await q('SELECT id FROM expenses WHERE id = $1', [id]);
    if (!rows.length) throw new DomainError(404, 'Cheltuiala nu există.');
    await q('DELETE FROM expenses WHERE id = $1', [id]);
    return { ok: true };
  });
}

/* ---------- joining two stays of the same guest into one ---------- */
export async function mergeReservations(db: Db, keepId: string, raw: unknown) {
  const b = asBody(raw), otherId = need(str(b.otherId, 100), 'Cerere invalidă.');
  const order = Array.isArray(b.roomIds) && b.roomIds.every(x => typeof x === 'string') ? (b.roomIds as string[]) : null;
  try {
    await db.tx(async q => {
      type R = { id: string; guest_id: string; check_in: string; check_out: string; pax: number; total: number; status: string; notes: string; invoice_no: string };
      const get = async (id: string) => { const [r] = await q<R>('SELECT id, guest_id, check_in, check_out, pax, total, status, notes, invoice_no FROM reservations WHERE id = $1', [id]); return r; };
      const a = await get(keepId), o = await get(otherId);
      if (!a || !o) throw new DomainError(404, 'Una dintre rezervări nu mai există.');
      if (a.guest_id !== o.guest_id || a.check_in !== o.check_in || a.check_out !== o.check_out) throw new DomainError(400, 'Se pot uni doar rezervările aceluiași oaspete, pe aceleași nopți.');
      if (a.status === 'cancelled' || o.status === 'cancelled') throw new DomainError(400, 'O rezervare anulată nu se poate uni.');
      const ra = (await q<{ room_id: string }>('SELECT room_id FROM reservation_rooms WHERE reservation_id = $1 ORDER BY position', [keepId])).map(x => x.room_id);
      const ro = (await q<{ room_id: string }>('SELECT room_id FROM reservation_rooms WHERE reservation_id = $1 ORDER BY position', [otherId])).map(x => x.room_id);
      const union = [...new Set([...ra, ...ro])], ids = order ? [...order.filter(id => union.includes(id)), ...union.filter(id => !order.includes(id))] : union;
      const notes = o.notes && !a.notes.includes(o.notes) ? [a.notes, o.notes].filter(Boolean).join('\n') : a.notes;
      await q('UPDATE payments SET reservation_id = $1 WHERE reservation_id = $2', [keepId, otherId]);
      await q('DELETE FROM reservations WHERE id = $1', [otherId]);
      await q('UPDATE reservations SET total = $2, pax = $3, notes = $4, status = $5, invoice_no = $6, updated_at = now() WHERE id = $1',
        [keepId, a.total + o.total, a.pax + o.pax, notes, o.status === 'checked_in' ? 'checked_in' : a.status, a.invoice_no || o.invoice_no]);
      await q('DELETE FROM reservation_rooms WHERE reservation_id = $1', [keepId]);
      for (const [i, roomId] of ids.entries()) await q('INSERT INTO reservation_rooms (reservation_id, room_id, position) VALUES ($1,$2,$3)', [keepId, roomId, i]);
    });
  } catch (e) { if (isRoomTaken(e)) throw new DomainError(409, 'Camerele nu se pot uni: una e ocupată de altă rezervare.'); throw e; }
  const s = await loadState(db);
  return { reservation: s.reservations.find(r => r.id === keepId)!, removedId: otherId };
}

export type { AppState };
