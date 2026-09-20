// Reading and changing data. Every change checks the rules first (clear messages), then the database
// constraint catches anything that slipped through (two receptionists booking the same room at once).
import type { Db, Q } from './db';
import type { AppState, Expense, Floor, Guest, Method, Payment, Property, Reservation, Room, Source, Status } from '@/domain/types';
import { fmtD, isIsoDate, todayIso } from '@/domain/dates';
import { METHOD, SRC, STATUS } from '@/domain/labels';
import { validateReservation } from '@/domain/rules';
import { DomainError, isRoomTaken } from './errors';
import { newId } from './ids';

const RES_COLS = `r.id, r.guest_id AS \`guestId\`, r.check_in AS \`checkIn\`, r.check_out AS \`checkOut\`, r.pax,
  r.total AS total, r.source, r.status, r.kind, r.notes, r.invoice_no AS \`invoiceNo\`, r.invoice_date AS \`invoiceDate\`, r.created_at AS \`createdAt\``;
type ResRow = Omit<Reservation, 'roomIds' | 'payments'>;
type PayRow = Payment & { reservationId: string };
const PAY_COLS = 'id, reservation_id AS `reservationId`, amount, method, paid_on AS `date`, note';

export const GUEST_COLS = 'id, first_name AS `firstName`, last_name AS `lastName`, phone, email, country, notes, birth_date AS `birthDate`, ' +
  'birth_place AS `birthPlace`, citizenship, address, id_type AS `idType`, id_series AS `idSeries`, id_number AS `idNumber`';

export async function loadState(db: Db): Promise<AppState> {
  const [properties, floors, rooms, guests, res, rr, pays, rates, expenses] = await Promise.all([
    db.query<Property>('SELECT id, name, city FROM properties ORDER BY sort, created_at, id'),
    db.query<Floor>('SELECT id, property_id AS `propertyId`, name FROM floors ORDER BY sort, id'),
    db.query<Room>('SELECT id, property_id AS `propertyId`, floor_id AS `floorId`, parent_id AS `parentId`, name, type, capacity, price, color, ' +
      'description AS `desc`, active FROM rooms ORDER BY sort, id'),
    db.query<Guest>(`SELECT ${GUEST_COLS} FROM guests ORDER BY created_at, id`),
    db.query<ResRow>(`SELECT ${RES_COLS} FROM reservations r ORDER BY r.check_in, r.id`),
    db.query<{ reservationId: string; roomId: string }>('SELECT reservation_id AS `reservationId`, room_id AS `roomId` FROM reservation_rooms ORDER BY reservation_id, position'),
    db.query<PayRow>(`SELECT ${PAY_COLS} FROM payments ORDER BY paid_on, created_at`),
    db.query<{ roomId: string; night: string; price: number }>('SELECT room_id AS `roomId`, night, price FROM rates'),
    db.query<Expense>('SELECT id, property_id AS `propertyId`, category, description AS `desc`, amount, spent_on AS `date`, ' +
      'recurring, COALESCE(`until`, \'\') AS `until` FROM expenses ORDER BY spent_on, id'),
  ]);
  const byId = new Map<string, Reservation>();
  const reservations = res.map(r => { const x: Reservation = { ...r, roomIds: [], payments: [] }; byId.set(r.id, x); return x; });
  rr.forEach(x => byId.get(x.reservationId)?.roomIds.push(x.roomId));
  pays.forEach(({ reservationId, ...p }) => byId.get(reservationId)?.payments.push(p));
  const rateMap: AppState['rates'] = {};
  rates.forEach(x => { (rateMap[x.roomId] ??= {})[x.night] = x.price; });
  return { properties, floors, rooms, guests, reservations, rates: rateMap, expenses };
}

async function getReservation(q: Q, id: string): Promise<Reservation | null> {
  const [r] = await q<ResRow>(`SELECT ${RES_COLS} FROM reservations r WHERE r.id = $1`, [id]);
  if (!r) return null;
  const rooms = await q<{ roomId: string }>('SELECT room_id AS `roomId` FROM reservation_rooms WHERE reservation_id = $1 ORDER BY position', [id]);
  const pays = await q<PayRow>(`SELECT ${PAY_COLS} FROM payments WHERE reservation_id = $1 ORDER BY paid_on, created_at`, [id]);
  return { ...r, roomIds: rooms.map(x => x.roomId), payments: pays.map(({ reservationId: _, ...p }) => p) };
}

/* ---------- reading the request body without trusting it ---------- */
type Body = Record<string, unknown>;
const asBody = (v: unknown): Body => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new DomainError(400, 'Cerere invalidă.'); return v as Body; };
const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v) ? +v : undefined);
const idList = (v: unknown) => (Array.isArray(v) && v.every(x => typeof x === 'string') ? (v as string[]) : undefined);

/** The first active stay that already holds one of these rooms on these nights, for a readable message. */
async function findConflict(q: Q, roomIds: string[], checkIn: string, checkOut: string, exceptId: string | null) {
  if (!roomIds.length) return null;
  const [c] = await q<{ guest: string; room: string; checkIn: string; checkOut: string }>(
    'SELECT TRIM(CONCAT(g.first_name, \' \', g.last_name)) AS guest, rm.name AS room, r.check_in AS `checkIn`, r.check_out AS `checkOut`' +
    `  FROM reservation_rooms rr JOIN reservations r ON r.id = rr.reservation_id JOIN guests g ON g.id = r.guest_id JOIN rooms rm ON rm.id = rr.room_id
      WHERE rr.room_id IN ($4) AND r.status <> 'cancelled' AND r.check_in < $2 AND r.check_out > $1 AND r.id <> $3
      ORDER BY r.check_in LIMIT 1`, [checkIn, checkOut, exceptId ?? '', roomIds]);
  return c ? `Camera ${c.room} este ocupată de ${c.guest} (${fmtD(c.checkIn)} – ${fmtD(c.checkOut)}).` : null;
}

async function checkRooms(q: Q, roomIds: string[]) {
  if (!roomIds.length) return;
  const rows = await q<{ id: string; name: string; active: boolean }>('SELECT id, name, active FROM rooms WHERE id IN ($1)', [roomIds]);
  if (rows.length !== roomIds.length) throw new DomainError(400, 'Una dintre camere nu există.');
  const off = rows.find(r => !r.active); if (off) throw new DomainError(400, `Camera ${off.name} este dezactivată.`);
}

async function insertRooms(q: Q, id: string, roomIds: string[]) {
  for (const [i, roomId] of roomIds.entries()) await q('INSERT INTO reservation_rooms (reservation_id, room_id, position) VALUES ($1, $2, $3)', [id, roomId, i]);
}

/** Runs a change; if the database says the room is taken, answers 409 with a plain message. */
async function guarded<T>(fn: () => Promise<T>): Promise<T> {
  try { return await fn(); }
  catch (e) {
    if (isRoomTaken(e)) throw new DomainError(409, 'Camera tocmai a fost ocupată de altă rezervare în perioada aleasă. Reîncarcă și alege altă cameră.');
    throw e;
  }
}

export async function createReservation(db: Db, raw: unknown) {
  const b = asBody(raw);
  const x = {
    roomIds: idList(b.roomIds) ?? [], checkIn: str(b.checkIn) ?? '', checkOut: str(b.checkOut) ?? '',
    pax: num(b.pax) ?? 1, total: num(b.total) ?? 0, source: (str(b.source) || 'direct') as Source, status: (str(b.status) || 'confirmed') as Status,
    notes: str(b.notes) ?? '', guestId: str(b.guestId, 100), guestName: str(b.guestName, 200), guestPhone: str(b.guestPhone, 60) ?? '',
    advance: num(b.advance) ?? 0, advanceMethod: (str(b.advanceMethod) || 'cash') as Method,
  };
  const err = validateReservation(x); if (err) throw new DomainError(400, err);
  if (!x.guestId && !x.guestName) throw new DomainError(400, 'Alege sau scrie numele oaspetelui.');
  if (x.advance < 0 || !(x.advanceMethod in METHOD)) throw new DomainError(400, 'Avansul nu este valid.');
  return guarded(() => db.tx(async q => {
    await checkRooms(q, x.roomIds);
    if (x.status !== 'cancelled') { const c = await findConflict(q, x.roomIds, x.checkIn, x.checkOut, null); if (c) throw new DomainError(409, c); }
    let guest: Guest | null = null, guestId = x.guestId;
    if (guestId) { const [g] = await q('SELECT id FROM guests WHERE id = $1', [guestId]); if (!g) throw new DomainError(400, 'Oaspetele nu mai există.'); }
    else {
      const parts = x.guestName!.split(/\s+/);
      guest = { id: newId('g_'), firstName: parts[0], lastName: parts.slice(1).join(' '), phone: x.guestPhone, email: '', country: 'România', notes: '' };
      await q('INSERT INTO guests (id, first_name, last_name, phone, email, country, notes) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [guest.id, guest.firstName, guest.lastName, guest.phone, guest.email, guest.country, guest.notes]);
      guestId = guest.id;
    }
    const id = newId('res_');
    await q(`INSERT INTO reservations (id, guest_id, check_in, check_out, pax, total, source, status, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, guestId, x.checkIn, x.checkOut, x.pax, x.total, x.source, x.status, x.notes]);
    await insertRooms(q, id, x.roomIds);
    if (x.advance > 0) await q('INSERT INTO payments (id, reservation_id, amount, method, paid_on, note) VALUES ($1,$2,$3,$4,$5,$6)', [newId('pay_'), id, x.advance, x.advanceMethod, todayIso(), 'Avans']);
    return { reservation: (await getReservation(q, id))!, guest };
  }));
}

/** Changes any of: rooms, dates, people, price, source, status, notes, invoice number, guest. */
export async function updateReservation(db: Db, id: string, raw: unknown) {
  const b = asBody(raw);
  return guarded(() => db.tx(async q => {
    const cur = await getReservation(q, id); if (!cur) throw new DomainError(404, 'Rezervarea nu mai există.');
    const next = {
      ...cur,
      roomIds: b.roomIds !== undefined ? idList(b.roomIds) ?? [] : cur.roomIds,
      checkIn: b.checkIn !== undefined ? str(b.checkIn) ?? '' : cur.checkIn,
      checkOut: b.checkOut !== undefined ? str(b.checkOut) ?? '' : cur.checkOut,
      pax: b.pax !== undefined ? num(b.pax) ?? NaN : cur.pax,
      total: b.total !== undefined ? num(b.total) ?? NaN : cur.total,
      source: b.source !== undefined ? (str(b.source) as Source) : cur.source,
      status: b.status !== undefined ? (str(b.status) as Status) : cur.status,
      notes: b.notes !== undefined ? str(b.notes) ?? '' : cur.notes,
      invoiceNo: b.invoiceNo !== undefined ? str(b.invoiceNo, 100) ?? '' : cur.invoiceNo,
      guestId: b.guestId !== undefined ? str(b.guestId, 100) ?? '' : cur.guestId,
    };
    const err = validateReservation(next); if (err) throw new DomainError(400, err);
    const roomsChanged = next.roomIds.join() !== cur.roomIds.join(), datesChanged = next.checkIn !== cur.checkIn || next.checkOut !== cur.checkOut;
    if (roomsChanged) await checkRooms(q, next.roomIds);
    if (next.status !== 'cancelled' && (roomsChanged || datesChanged || cur.status === 'cancelled')) {
      const c = await findConflict(q, next.roomIds, next.checkIn, next.checkOut, id); if (c) throw new DomainError(409, c);
    }
    if (next.guestId !== cur.guestId) { const [g] = await q('SELECT id FROM guests WHERE id = $1', [next.guestId]); if (!g) throw new DomainError(400, 'Oaspetele nu există.'); }
    const invoiceDate = next.invoiceNo === cur.invoiceNo ? cur.invoiceDate : next.invoiceNo ? todayIso() : null;
    // the old rooms go first, so moving to other rooms and other nights at once is not seen as a clash with itself
    if (roomsChanged || datesChanged) await q('DELETE FROM reservation_rooms WHERE reservation_id = $1', [id]);
    await q(`UPDATE reservations SET guest_id=$2, check_in=$3, check_out=$4, pax=$5, total=$6, source=$7, status=$8, notes=$9, invoice_no=$10, invoice_date=$11, updated_at=now()
      WHERE id=$1`, [id, next.guestId, next.checkIn, next.checkOut, next.pax, next.total, next.source, next.status, next.notes, next.invoiceNo, invoiceDate]);
    if (roomsChanged || datesChanged) await insertRooms(q, id, next.roomIds);
    return { reservation: (await getReservation(q, id))! };
  }));
}

export async function deleteReservation(db: Db, id: string) {
  return db.tx(async q => {
    const rows = await q('SELECT id FROM reservations WHERE id = $1', [id]);
    if (!rows.length) throw new DomainError(404, 'Rezervarea nu mai există.');
    await q('DELETE FROM reservations WHERE id = $1', [id]);   // camerele, nopțile și plățile pleacă odată cu ea
    return { ok: true };
  });
}

export async function addPayment(db: Db, id: string, raw: unknown) {
  const b = asBody(raw);
  const amount = num(b.amount), method = (str(b.method) || 'cash') as Method, note = str(b.note, 300) ?? '';
  const date = str(b.date) || todayIso();
  if (!amount || amount <= 0) throw new DomainError(400, 'Introdu o sumă mai mare ca zero.');
  if (!(method in METHOD)) throw new DomainError(400, 'Metoda de plată nu este validă.');
  if (!isIsoDate(date)) throw new DomainError(400, 'Data plății nu este validă.');
  return db.tx(async q => {
    const cur = await getReservation(q, id); if (!cur) throw new DomainError(404, 'Rezervarea nu mai există.');
    if (cur.status === 'cancelled') throw new DomainError(400, 'Rezervarea este anulată.');
    await q('INSERT INTO payments (id, reservation_id, amount, method, paid_on, note) VALUES ($1,$2,$3,$4,$5,$6)', [newId('pay_'), id, amount, method, date, note]);
    return { reservation: (await getReservation(q, id))! };
  });
}

/** Datele unui oaspete: nume, contact și actul de pe fișa de cazare. Se schimbă numai ce e trimis. */
export async function updateGuest(db: Db, id: string, raw: unknown): Promise<{ guest: Guest }> {
  const b = asBody(raw);
  return db.tx(async q => {
    const [cur] = await q<Guest>(`SELECT ${GUEST_COLS} FROM guests WHERE id = $1`, [id]);
    if (!cur) throw new DomainError(404, 'Oaspetele nu mai există.');
    const pick = (k: keyof Guest, max: number) => (b[k] === undefined ? (cur[k] as string | undefined) ?? '' : str(b[k], max) ?? '');
    const firstName = pick('firstName', 120);
    if (!firstName) throw new DomainError(400, 'Scrie numele oaspetelui.');
    const birthDate = b.birthDate === undefined ? cur.birthDate ?? null : str(b.birthDate) || null;
    if (birthDate && (!isIsoDate(birthDate) || birthDate > todayIso())) throw new DomainError(400, 'Data nașterii nu este validă.');
    const g: Guest = {
      id, firstName, lastName: pick('lastName', 120), phone: pick('phone', 60), email: pick('email', 160), country: pick('country', 80),
      notes: pick('notes', 2000), birthDate, birthPlace: pick('birthPlace', 120), citizenship: pick('citizenship', 80), address: pick('address', 300),
      idType: pick('idType', 30), idSeries: pick('idSeries', 20).toUpperCase(), idNumber: pick('idNumber', 30),
    };
    await q(`UPDATE guests SET first_name=$2, last_name=$3, phone=$4, email=$5, country=$6, notes=$7, birth_date=$8, birth_place=$9,
      citizenship=$10, address=$11, id_type=$12, id_series=$13, id_number=$14 WHERE id=$1`,
      [id, g.firstName, g.lastName, g.phone, g.email, g.country, g.notes, g.birthDate, g.birthPlace, g.citizenship, g.address, g.idType, g.idSeries, g.idNumber]);
    return { guest: g };
  });
}

export const LABELS = { STATUS, SRC };
