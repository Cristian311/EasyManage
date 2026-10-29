// Administrare: proprietăți, etaje, camere, prețuri, cheltuieli și unirea a două sejururi.
// Rulează pe un MySQL adevărat (cel din XAMPP), ca să prindă și ce spune schema, nu doar aplicația.
// Baza se golește și se umple din nou înainte de fiecare test, deci ordinea testelor nu contează.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AppState } from '@/domain/types';
import { tinyState } from '@/domain/fixtures';
import { type Db } from './db';
import { freshDb, resetTo } from './testdb';
import { createReservation, loadState } from './repo';
import { DomainError } from './errors';
import {
  createExpense, createFloor, createProperty, createRoom, deleteExpense, deleteFloor, deleteProperty, deleteRoom,
  mergeReservations, orderRooms, setRates, updateExpense, updateFloor, updateProperty, updateRoom,
} from './repo-admin';

let db: Db;
beforeAll(async () => { db = await freshDb(); }, 120_000);
beforeEach(() => resetTo(db, tinyState()));
afterAll(() => db.close());

const status = async (p: Promise<unknown>) => { try { await p; return 200; } catch (e) { return e instanceof DomainError ? e.status : 500; } };
const tops = (s: AppState) => s.rooms.filter(r => !r.parentId).map(r => r.id);

describe('proprietăți', () => {
  it('creează una nouă, cu numele curățat de spații', async () => {
    const s = await createProperty(db, { name: '  Vila Trei  ', city: 'Sinaia' });
    expect(s.properties.map(p => p.name)).toContain('Vila Trei');
    expect(s.properties.at(-1)).toMatchObject({ name: 'Vila Trei', city: 'Sinaia' });
  });
  it('cere un nume și un corp care are sens', async () => {
    await expect(createProperty(db, { name: '   ' })).rejects.toThrow(/numele proprietății/);
    expect(await status(createProperty(db, 'nu e obiect'))).toBe(400);
    expect(await status(createProperty(db, ['nici așa']))).toBe(400);
  });
  it('redenumește, iar un nume gol lasă numele vechi', async () => {
    expect((await updateProperty(db, 'p1', { name: 'Vila Patru' })).properties.find(p => p.id === 'p1')?.name).toBe('Vila Patru');
    expect((await updateProperty(db, 'p1', { name: '' })).properties.find(p => p.id === 'p1')?.name).toBe('Vila Patru');
    expect(await status(updateProperty(db, 'nu_exista', { name: 'X' }))).toBe(404);
  });
  it('nu șterge o proprietate care mai are camere', async () => {
    await expect(deleteProperty(db, 'p1')).rejects.toThrow(/Mută sau șterge/);
  });
  it('șterge una goală', async () => {
    const s = await createProperty(db, { name: 'Vila Trei' });
    const id = s.properties.find(p => p.name === 'Vila Trei')!.id;
    expect((await deleteProperty(db, id)).properties.map(p => p.id)).toEqual(['p1', 'p2']);
  });
  it('nu rămâne fără nicio proprietate', async () => {
    await deleteRoom(db, 'r4');
    await deleteRoom(db, 'rx');
    expect((await deleteProperty(db, 'p2')).properties.map(p => p.id)).toEqual(['p1']);
    await expect(deleteProperty(db, 'p1')).rejects.toThrow(/cel puțin o proprietate/);
  });
});

describe('etaje', () => {
  it('creează un etaj și întoarce id-ul lui', async () => {
    const { id, state } = await createFloor(db, { name: 'Mansardă', propertyId: 'p1' });
    expect(state.floors.find(f => f.id === id)).toMatchObject({ name: 'Mansardă', propertyId: 'p1' });
  });
  it('cere nume și o proprietate care există', async () => {
    await expect(createFloor(db, { propertyId: 'p1' })).rejects.toThrow(/numele etajului/);
    await expect(createFloor(db, { name: 'X' })).rejects.toThrow(/Alege proprietatea/);
    await expect(createFloor(db, { name: 'X', propertyId: 'nu_exista' })).rejects.toThrow(/Proprietatea nu există/);
  });
  it('mută etajul cu o poziție, dar numai în cadrul proprietății lui', async () => {
    const order = async () => (await loadState(db)).floors.map(f => f.id);
    expect(await order()).toEqual(['f1', 'f2', 'f3']);
    await updateFloor(db, 'f2', { move: -1 });
    expect(await order()).toEqual(['f2', 'f1', 'f3']);
    await updateFloor(db, 'f1', { move: 1 });     // f3 e la altă vilă: nu se schimbă nimic
    expect(await order()).toEqual(['f2', 'f1', 'f3']);
  });
  it('redenumește, iar 404 dacă nu există', async () => {
    expect((await updateFloor(db, 'f1', { name: 'Demisol' })).floors.find(f => f.id === 'f1')?.name).toBe('Demisol');
    expect(await status(updateFloor(db, 'nu_exista', { name: 'X' }))).toBe(404);
  });
  it('la ștergerea etajului, camerele rămân la proprietate, fără etaj', async () => {
    const s = await deleteFloor(db, 'f1');
    expect(s.floors.map(f => f.id)).toEqual(['f2', 'f3']);
    expect(s.rooms.filter(r => r.id === 'r1' || r.id === 'r2').map(r => [r.propertyId, r.floorId])).toEqual([['p1', null], ['p1', null]]);
  });
});

describe('camere', () => {
  it('creează o cameră cu valorile implicite pentru ce nu e trimis', async () => {
    const s = await createRoom(db, { name: '999', propertyId: 'p2' });
    expect(s.rooms.at(-1)).toMatchObject({ name: '999', propertyId: 'p2', floorId: null, type: 'Cameră', capacity: 2, price: 0, active: true });
  });
  it('rotunjește capacitatea și prețul', async () => {
    const s = await createRoom(db, { name: '998', propertyId: 'p2', capacity: 3, price: 199.6 });
    expect(s.rooms.at(-1)).toMatchObject({ capacity: 3, price: 200 });
  });
  it('cere nume și o proprietate care există', async () => {
    await expect(createRoom(db, { propertyId: 'p1' })).rejects.toThrow(/numărul sau numele camerei/);
    await expect(createRoom(db, { name: 'X', propertyId: 'nu_exista' })).rejects.toThrow(/Alege proprietatea/);
  });
  it('nu acceptă un etaj de la altă proprietate', async () => {
    await expect(createRoom(db, { name: 'X', propertyId: 'p2', floorId: 'f1' })).rejects.toThrow(/Etajul nu aparține/);
  });
  it('nu acceptă o capacitate sau un preț imposibile', async () => {
    for (const capacity of [0, 51, 2.5]) await expect(createRoom(db, { name: 'X', propertyId: 'p1', capacity })).rejects.toThrow(/Capacitatea/);
    for (const price of [-1, 2e6]) await expect(createRoom(db, { name: 'X', propertyId: 'p1', price })).rejects.toThrow(/Prețul/);
  });
  it('modificarea păstrează ce nu a fost trimis', async () => {
    const s = await updateRoom(db, 'r1', { price: 260 });
    expect(s.rooms.find(r => r.id === 'r1')).toMatchObject({ name: '101', propertyId: 'p1', floorId: 'f1', capacity: 2, price: 260, active: true });
    expect(await status(updateRoom(db, 'nu_exista', { price: 1 }))).toBe(404);
  });
  it('când camera împărțită se mută, unitățile ei o urmează', async () => {
    const s = await updateRoom(db, 'rs', { propertyId: 'p2', floorId: '' });
    expect(s.rooms.filter(r => ['rs', 'ru1', 'ru2'].includes(r.id)).map(r => [r.id, r.propertyId, r.floorId]))
      .toEqual([['rs', 'p2', null], ['ru1', 'p2', null], ['ru2', 'p2', null]]);
  });
  it('nu șterge o cameră cu rezervări, dar șterge una liberă împreună cu unitățile ei', async () => {
    await expect(deleteRoom(db, 'r1')).rejects.toThrow(/Dezactiveaz-o/);
    const s = await deleteRoom(db, 'rs');
    expect(s.rooms.map(r => r.id)).not.toContain('rs');
    expect(s.rooms.map(r => r.id)).not.toContain('ru1');
    expect(s.rooms.map(r => r.id)).not.toContain('ru2');
  });
  it('nu șterge camera împărțită dacă are rezervări pe una dintre unități', async () => {
    await createReservation(db, { guestId: 'g1', roomIds: ['ru1'], checkIn: '2026-12-01', checkOut: '2026-12-03', pax: 2, total: 400 });
    await expect(deleteRoom(db, 'rs')).rejects.toThrow(/Dezactiveaz-o/);
  });
  it('orderRooms rearanjează camerele; cele netrimise rămân la coadă', async () => {
    expect(tops(await loadState(db))).toEqual(['r1', 'r2', 'r3', 'rs', 'r4', 'rx']);
    expect(tops(await orderRooms(db, { ids: ['r4', 'r3', 'nu_exista'] }))).toEqual(['r4', 'r3', 'r1', 'r2', 'rs', 'rx']);
    expect(await status(orderRooms(db, { ids: 'nu e listă' }))).toBe(400);
  });
});

describe('prețuri pe noapte', () => {
  it('pune prețul pe fiecare noapte din interval, chiar dacă e scris invers', async () => {
    const { rates } = await setRates(db, { roomIds: ['r1'], from: '2026-10-12', to: '2026-10-10', price: 500 });
    expect(Object.keys(rates.r1).sort()).toEqual(['2026-10-10', '2026-10-11', '2026-10-12']);
    expect(rates.r1['2026-10-11']).toBe(500);
  });
  it('cu wkOnly atinge doar vineri și sâmbătă', async () => {
    const { rates } = await setRates(db, { roomIds: ['r2'], from: '2026-10-05', to: '2026-10-11', price: 400, wkOnly: true });
    expect(Object.keys(rates.r2).sort()).toEqual(['2026-10-09', '2026-10-10']);   // vineri și sâmbătă
  });
  it('un preț egal cu cel de bază nu se mai ține minte ca preț special', async () => {
    const { rates } = await setRates(db, { roomIds: ['r3'], from: '2026-10-20', to: '2026-10-21', price: 250 });
    expect(rates.r3).toEqual({});
  });
  it('price null șterge prețurile speciale din interval', async () => {
    await setRates(db, { roomIds: ['r1'], from: '2026-10-10', to: '2026-10-12', price: 500 });
    const { rates } = await setRates(db, { roomIds: ['r1'], from: '2026-10-10', to: '2026-10-11', price: null });
    expect(Object.keys(rates.r1)).toEqual(['2026-10-12']);
  });
  it('pune același preț pe mai multe camere deodată', async () => {
    const { rates } = await setRates(db, { roomIds: ['r1', 'r2'], from: '2026-11-20', to: '2026-11-20', price: 333 });
    expect([rates.r1['2026-11-20'], rates.r2['2026-11-20']]).toEqual([333, 333]);
  });
  it('refuză fără camere, cu date greșite, cu preț greșit sau pe o cameră inexistentă', async () => {
    await expect(setRates(db, { roomIds: [], from: '2026-10-10', to: '2026-10-11', price: 300 })).rejects.toThrow(/cel puțin o cameră/);
    await expect(setRates(db, { roomIds: ['r1'], from: '2026-02-30', to: '2026-10-11', price: 300 })).rejects.toThrow(/Perioada/);
    await expect(setRates(db, { roomIds: ['r1'], from: '2026-10-10', to: '2026-10-11', price: 0 })).rejects.toThrow(/prețul pe noapte/);
    await expect(setRates(db, { roomIds: ['nu_exista'], from: '2026-10-10', to: '2026-10-11', price: 300 })).rejects.toThrow(/camere nu există/);
  });
  it('refuză o perioadă mai lungă de doi ani', async () => {
    await expect(setRates(db, { roomIds: ['r1'], from: '2026-01-01', to: '2028-06-01', price: 300 })).rejects.toThrow(/perioadă mai scurtă/);
  });
});

describe('cheltuieli', () => {
  it('creează una, cu suma rotunjită la bani', async () => {
    const { expense } = await createExpense(db, { amount: 123.456, date: '2026-09-15', category: 'Utilități', desc: 'Curent', propertyId: 'p1' });
    expect(expense).toMatchObject({ amount: 123.46, date: '2026-09-15', category: 'Utilități', desc: 'Curent', propertyId: 'p1', recurring: false, until: '' });
  });
  it('o categorie necunoscută devine "Altele"', async () => {
    const { expense } = await createExpense(db, { amount: 50, date: '2026-09-15', category: 'Bilete la operă' });
    expect(expense.category).toBe('Altele');
  });
  it('refuză suma zero, data lipsă sau greșită și o proprietate care nu există', async () => {
    await expect(createExpense(db, { amount: 0, date: '2026-09-15' })).rejects.toThrow(/suma cheltuielii/);
    await expect(createExpense(db, { amount: 10, date: '2026-02-30' })).rejects.toThrow(/Alege data/);
    await expect(createExpense(db, { amount: 10, date: '2026-09-15', until: 'candva' })).rejects.toThrow(/Data de oprire/);
    await expect(createExpense(db, { amount: 10, date: '2026-09-15', propertyId: 'nu_exista' })).rejects.toThrow(/Proprietatea nu există/);
  });
  it('modificarea păstrează ce nu a fost trimis', async () => {
    const { expense } = await createExpense(db, { amount: 700, date: '2026-08-01', category: 'Salarii', desc: 'Recepție', recurring: true });
    const up = await updateExpense(db, expense.id, { until: '2026-12-31' });
    expect(up.expense).toMatchObject({ amount: 700, date: '2026-08-01', category: 'Salarii', desc: 'Recepție', recurring: true, until: '2026-12-31' });
    expect(await status(updateExpense(db, 'nu_exista', { amount: 5, date: '2026-09-01' }))).toBe(404);
  });
  it('se șterge o singură dată', async () => {
    const { expense } = await createExpense(db, { amount: 10, date: '2026-09-15' });
    expect(await deleteExpense(db, expense.id)).toEqual({ ok: true });
    expect(await status(deleteExpense(db, expense.id))).toBe(404);
  });
});

describe('unirea a două sejururi', () => {
  const guestId = 'g2', dates = { checkIn: '2026-11-01', checkOut: '2026-11-03' };
  const two = async () => {
    const a = await createReservation(db, { guestId, roomIds: ['r2'], pax: 2, total: 440, notes: 'Liniște', ...dates });
    const b = await createReservation(db, { guestId, roomIds: ['r3'], pax: 1, total: 500, notes: 'Pat suplimentar', advance: 100, ...dates });
    return [a.reservation, b.reservation] as const;
  };

  it('adună camerele, banii, persoanele, notițele și plățile', async () => {
    const [a, b] = await two();
    const m = await mergeReservations(db, a.id, { otherId: b.id, roomIds: ['r3', 'r2'] });
    expect(m.removedId).toBe(b.id);
    expect(m.reservation).toMatchObject({ id: a.id, total: 940, pax: 3, roomIds: ['r3', 'r2'], notes: 'Liniște\nPat suplimentar' });
    expect(m.reservation.payments.map(p => p.amount)).toEqual([100]);
    expect((await loadState(db)).reservations.find(r => r.id === b.id)).toBeUndefined();
  });
  it('fără o ordine anume, camerele rămân în ordinea în care erau', async () => {
    const [a, b] = await two();
    expect((await mergeReservations(db, a.id, { otherId: b.id })).reservation.roomIds).toEqual(['r2', 'r3']);
  });
  it('dacă unul dintre oaspeți e deja cazat, rezervarea unită rămâne cazată', async () => {
    const [a, b] = await two();
    await db.query('UPDATE reservations SET status = $2 WHERE id = $1', [b.id, 'checked_in']);
    expect((await mergeReservations(db, a.id, { otherId: b.id })).reservation.status).toBe('checked_in');
  });
  it('după unire, camerele rămân ocupate pentru altcineva', async () => {
    const [a, b] = await two();
    await mergeReservations(db, a.id, { otherId: b.id });
    expect(await status(createReservation(db, { guestId: 'g1', roomIds: ['r3'], pax: 2, total: 100, ...dates }))).toBe(409);
  });
  it('refuză alt oaspete, alte nopți, o rezervare anulată sau una care nu există', async () => {
    const [a, b] = await two();
    const other = await createReservation(db, { guestId: 'g1', roomIds: ['r4'], pax: 2, total: 360, ...dates });
    await expect(mergeReservations(db, a.id, { otherId: other.reservation.id })).rejects.toThrow(/aceluiași oaspete/);

    const later = await createReservation(db, { guestId, roomIds: ['r4'], pax: 2, total: 360, checkIn: '2026-11-05', checkOut: '2026-11-07' });
    await expect(mergeReservations(db, a.id, { otherId: later.reservation.id })).rejects.toThrow(/aceleași nopți/);

    await db.query('UPDATE reservations SET status = $2 WHERE id = $1', [b.id, 'cancelled']);
    await expect(mergeReservations(db, a.id, { otherId: b.id })).rejects.toThrow(/anulată nu se poate uni/);

    expect(await status(mergeReservations(db, a.id, { otherId: 'nu_exista' }))).toBe(404);
    expect(await status(mergeReservations(db, a.id, {}))).toBe(400);
  });
});

describe('starea completă', () => {
  it('se citește cu tot ce ține de ea', async () => {
    const s = await loadState(db);
    expect(s.properties.map(p => p.id)).toEqual(['p1', 'p2']);
    expect(s.floors.map(f => f.id)).toEqual(['f1', 'f2', 'f3']);
    expect(tops(s)).toEqual(['r1', 'r2', 'r3', 'rs', 'r4', 'rx']);
    expect(s.rooms.find(r => r.id === 'rx')?.active).toBe(false);
    expect(s.reservations).toHaveLength(1);
    expect(s.reservations[0]).toMatchObject({ roomIds: ['r1'], checkIn: '2026-09-10', checkOut: '2026-09-12', total: 400, pax: 2 });
    expect(s.reservations[0].payments.map(p => p.amount)).toEqual([200]);
  });
});
