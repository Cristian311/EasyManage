// Serviciile în plus (mic dejun, pat suplimentar, taxă), pe un MySQL adevărat.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { tinyState } from '@/domain/fixtures';
import { remaining } from '@/domain/rules';
import { type Db } from './db';
import { freshDb, resetTo } from './testdb';
import { DomainError } from './errors';
import { addExtra, addPayment, createReservation, deleteExtra, loadState } from './repo';
import { draftFor } from './invoices';
import { saveCompany } from './settings';

let db: Db;
beforeAll(async () => { db = await freshDb(); }, 120_000);
afterAll(() => db.close());
beforeEach(() => resetTo(db, tinyState()));

const status = async (p: Promise<unknown>) => { try { await p; return 200; } catch (e) { return e instanceof DomainError ? e.status : 500; } };
const make = () => createReservation(db, { guestName: 'Ana Pop', roomIds: ['r4'], checkIn: '2030-07-10', checkOut: '2030-07-12', pax: 2, total: 400, advance: 100 });

describe('servicii pe lângă cazare', () => {
  it('urcă totalul rezervării, deci restul de plată se schimbă singur', async () => {
    const { reservation } = await make();
    expect(remaining(reservation)).toBe(300);
    const out = await addExtra(db, reservation.id, { label: 'Mic dejun', qty: 4, unitPrice: 35 });
    expect(Number(out.reservation.total)).toBe(540);
    expect(remaining(out.reservation)).toBe(440);
    expect(out.reservation.extras).toHaveLength(1);
    expect(out.reservation.extras[0]).toMatchObject({ label: 'Mic dejun', qty: 4, unitPrice: 35 });
  });

  it('mai multe servicii se adună și vin cu starea, în ordinea adăugării', async () => {
    const { reservation } = await make();
    await addExtra(db, reservation.id, { label: 'Mic dejun', qty: 2, unitPrice: 35 });
    await addExtra(db, reservation.id, { label: 'Pat suplimentar', qty: 1, unitPrice: 60 });
    const r = (await loadState(db)).reservations.find(x => x.id === reservation.id)!;
    expect(r.extras.map(e => e.label)).toEqual(['Mic dejun', 'Pat suplimentar']);
    expect(Number(r.total)).toBe(530);
  });

  it('scoaterea dă banii înapoi din total, iar totalul nu scade niciodată sub zero', async () => {
    const { reservation } = await make();
    const { reservation: withExtra } = await addExtra(db, reservation.id, { label: 'Parcare', qty: 2, unitPrice: 20 });
    expect(Number(withExtra.total)).toBe(440);
    const { reservation: after } = await deleteExtra(db, reservation.id, withExtra.extras[0].id);
    expect(Number(after.total)).toBe(400);
    expect(after.extras).toEqual([]);
    expect(await status(deleteExtra(db, reservation.id, 'nu_exista'))).toBe(404);
  });

  it('zecimalele nu se pierd: 3 × 16,50 lei', async () => {
    const { reservation } = await make();
    const { reservation: r } = await addExtra(db, reservation.id, { label: 'Taxă de stațiune', qty: 3, unitPrice: 16.5 });
    expect(Number(r.total)).toBe(449.5);
  });

  it('refuză rândurile fără noimă și rezervarea care nu există', async () => {
    const { reservation } = await make();
    expect(await status(addExtra(db, reservation.id, { label: '  ', qty: 1, unitPrice: 10 }))).toBe(400);
    expect(await status(addExtra(db, reservation.id, { label: 'X', qty: 0, unitPrice: 10 }))).toBe(400);
    expect(await status(addExtra(db, reservation.id, { label: 'X', qty: -1, unitPrice: 10 }))).toBe(400);
    expect(await status(addExtra(db, reservation.id, { label: 'X', qty: 1, unitPrice: -5 }))).toBe(400);
    expect(await status(addExtra(db, 'nu_exista', { label: 'X', qty: 1, unitPrice: 10 }))).toBe(404);
  });

  it('serviciile pleacă odată cu rezervarea, fără să lase rânduri orfane', async () => {
    const { reservation } = await make();
    await addExtra(db, reservation.id, { label: 'Mic dejun', qty: 2, unitPrice: 35 });
    await db.query('DELETE FROM reservations WHERE id = $1', [reservation.id]);
    expect((await db.query<{ n: number }>('SELECT COUNT(*) AS n FROM reservation_extras'))[0].n).toBe(0);
  });

  it('pe factură intră ca linii separate, iar cazarea rămâne cât era fără ele', async () => {
    const { reservation } = await make();
    await addExtra(db, reservation.id, { label: 'Mic dejun', qty: 4, unitPrice: 35 });
    await saveCompany(db, { name: 'Vila SRL', taxId: 'RO1', address: 'Str. 1' });
    const draft = await draftFor(db, reservation.id);
    expect(draft.lines).toHaveLength(2);
    expect(draft.lines[0].qty * draft.lines[0].unitPrice).toBeCloseTo(400, 2);     // cazarea, fără servicii
    expect(draft.lines[1]).toMatchObject({ description: 'Mic dejun', qty: 4, unitPrice: 35 });
  });

  it('încasările merg mai departe peste total, iar plata acoperă și serviciile', async () => {
    const { reservation } = await make();
    await addExtra(db, reservation.id, { label: 'Mic dejun', qty: 4, unitPrice: 35 });
    const { reservation: paid } = await addPayment(db, reservation.id, { amount: 440, method: 'cash' });
    expect(remaining(paid)).toBe(0);
  });
});
