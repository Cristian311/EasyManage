// Completări la rezervări: ce se întâmplă cu cereri stricate, cu oaspeți și camere care nu există,
// cu ștergerea și cu plățile. Pe MySQL adevărat, ca și restul.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { tinyState } from '@/domain/fixtures';
import { todayIso } from '@/domain/dates';
import type { Db } from './db';
import { freshDb, resetTo } from './testdb';
import { addPayment, createReservation, deleteReservation, loadState, updateReservation } from './repo';
import { DomainError } from './errors';

let db: Db;
beforeAll(async () => { db = await freshDb(); }, 120_000);
beforeEach(() => resetTo(db, tinyState()));      // fiecare test pleacă de la aceleași date
afterAll(() => db.close());

const status = async (p: Promise<unknown>) => { try { await p; return 200; } catch (e) { return e instanceof DomainError ? e.status : 500; } };
const book = (over: Record<string, unknown> = {}) =>
  createReservation(db, { guestId: 'g1', roomIds: ['r2'], checkIn: '2026-12-01', checkOut: '2026-12-03', pax: 2, total: 440, ...over });

describe('cereri pe care nu le înghite', () => {
  it('un corp care nu e obiect e cerere invalidă', async () => {
    for (const body of [null, 'text', 42, ['a']]) expect(await status(createReservation(db, body)), String(body)).toBe(400);
  });
  it('cere un oaspete, fie ales, fie scris', async () => {
    await expect(book({ guestId: undefined })).rejects.toThrow(/numele oaspetelui/);
  });
  it('nu acceptă un oaspete care nu există', async () => {
    await expect(book({ guestId: 'nu_exista' })).rejects.toThrow(/Oaspetele nu mai există/);
  });
  it('nu acceptă o cameră care nu există sau una dezactivată', async () => {
    await expect(book({ roomIds: ['nu_exista'] })).rejects.toThrow(/camere nu există/);
    await expect(book({ roomIds: ['rx'] })).rejects.toThrow(/Camera P2 este dezactivată/);
  });
  it('nu acceptă un avans negativ sau o metodă de plată necunoscută', async () => {
    await expect(book({ advance: -10 })).rejects.toThrow(/Avansul/);
    await expect(book({ advance: 100, advanceMethod: 'bitcoin' })).rejects.toThrow(/Avansul/);
  });
  it('primește numerele și ca text, cum le trimite un formular', async () => {
    const { reservation } = await book({ pax: '3', total: '540', advance: '40' });
    expect(reservation).toMatchObject({ pax: 3, total: 540 });
    expect(reservation.payments.map(p => p.amount)).toEqual([40]);
  });
});

describe('oaspete nou', () => {
  it('îi desparte numele în prenume și nume și îi ține telefonul', async () => {
    const { guest } = await book({ guestId: undefined, guestName: '  Maria  Ionescu Pop ', guestPhone: '0722 123 456' });
    expect(guest).toMatchObject({ firstName: 'Maria', lastName: 'Ionescu Pop', phone: '0722 123 456', country: 'România' });
    expect((await loadState(db)).guests.map(g => g.id)).toContain(guest!.id);
  });
});

describe('modificare', () => {
  it('404 pentru o rezervare care nu mai există', async () => {
    expect(await status(updateReservation(db, 'nu_exista', { pax: 3 }))).toBe(404);
  });
  it('schimbă doar ce i se trimite', async () => {
    const { reservation } = await book({ notes: 'Etaj înalt' });
    const up = await updateReservation(db, reservation.id, { pax: 1 });
    expect(up.reservation).toMatchObject({ pax: 1, total: 440, notes: 'Etaj înalt', roomIds: ['r2'], checkIn: '2026-12-01' });
  });
  it('nu mută rezervarea la un oaspete care nu există', async () => {
    const { reservation } = await book();
    await expect(updateReservation(db, reservation.id, { guestId: 'nu_exista' })).rejects.toThrow(/Oaspetele nu există/);
    expect((await updateReservation(db, reservation.id, { guestId: 'g2' })).reservation.guestId).toBe('g2');
  });
  it('data facturii se pune la primul număr și se șterge odată cu el', async () => {
    const { reservation } = await book();
    expect(reservation.invoiceDate).toBeNull();
    const cu = await updateReservation(db, reservation.id, { invoiceNo: 'VS-2026-0001' });
    expect(cu.reservation.invoiceDate).toBe(todayIso());
    const fara = await updateReservation(db, reservation.id, { invoiceNo: '' });
    expect(fara.reservation.invoiceDate).toBeNull();
  });
  it('trece prin aceleași reguli ca la creare', async () => {
    const { reservation } = await book();
    await expect(updateReservation(db, reservation.id, { checkOut: '2026-12-01' })).rejects.toThrow(/după check-in/);
    await expect(updateReservation(db, reservation.id, { pax: 0 })).rejects.toThrow(/persoane/);
    await expect(updateReservation(db, reservation.id, { status: 'no_show' })).rejects.toThrow(/Statusul/);
  });
});

describe('anulare și ștergere', () => {
  it('o rezervare anulată poate sta peste alta: nu ocupă nimic', async () => {
    await book();
    const c = await book({ status: 'cancelled', total: 0 });
    expect(c.reservation.status).toBe('cancelled');
  });
  it('se șterge o singură dată, cu tot cu plăți', async () => {
    const { reservation } = await book({ advance: 100 });
    expect(await deleteReservation(db, reservation.id)).toEqual({ ok: true });
    expect(await status(deleteReservation(db, reservation.id))).toBe(404);
    const s = await loadState(db);
    expect(s.reservations.find(r => r.id === reservation.id)).toBeUndefined();
    expect(s.reservations.flatMap(r => r.payments).map(p => p.amount)).toEqual([200]);   // a rămas doar plata din datele de start
  });
  it('după ștergere, camera e liberă din nou', async () => {
    const { reservation } = await book();
    expect(await status(book())).toBe(409);
    await deleteReservation(db, reservation.id);
    expect(await status(book())).toBe(200);
  });
});

describe('plăți', () => {
  it('adaugă plata cu data de azi, dacă nu i se dă alta', async () => {
    const { reservation } = await book();
    const r = await addPayment(db, reservation.id, { amount: 200, method: 'transfer', note: 'Avans' });
    expect(r.reservation.payments[0]).toMatchObject({ amount: 200, method: 'transfer', note: 'Avans', date: todayIso() });
  });
  it('refuză suma zero sau negativă, metoda necunoscută și data greșită', async () => {
    const { reservation } = await book();
    for (const body of [{ amount: 0 }, { amount: -5 }, { amount: 'mult' }, { amount: 100, method: 'bitcoin' }, { amount: 100, date: '2026-02-30' }])
      expect(await status(addPayment(db, reservation.id, body)), JSON.stringify(body)).toBe(400);
  });
  it('nu se încasează pe o rezervare anulată', async () => {
    const { reservation } = await book();
    await updateReservation(db, reservation.id, { status: 'cancelled' });
    await expect(addPayment(db, reservation.id, { amount: 100 })).rejects.toThrow(/anulată/);
  });
  it('404 pentru o rezervare care nu există', async () => {
    expect(await status(addPayment(db, 'nu_exista', { amount: 100 }))).toBe(404);
  });
});
