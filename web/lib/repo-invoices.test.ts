// Invoices against a real PostgreSQL (PGlite in memory): numbering, the link to the stay, cancelling.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addDays, todayIso } from '@/domain/dates';
import { invoiceNo } from '@/domain/invoice';
import { createDb, type Db } from './db';
import { seedDemo } from './seed';
import { createReservation, loadState } from './repo';
import { cancelInvoice, createInvoice, loadSettings, updateSettings } from './repo-invoices';
import { DomainError } from './errors';

let db: Db, roomId: string, guestId: string;
const far = addDays(todayIso(), 500);
const status = async (p: Promise<unknown>) => { try { await p; return 200; } catch (e) { return e instanceof DomainError ? e.status : 500; } };
const customer = { name: 'SC Alfa SRL', cui: 'RO123', regCom: '', address: 'Brașov' };
const line = { desc: 'Cazare', qty: 2, unit: 'nopți', price: 222, vat: 11 };

beforeAll(async () => {
  db = await createDb('memory://');
  await seedDemo(db);
  const s = await loadState(db);
  roomId = s.rooms[0].id; guestId = s.guests[0].id;
});
afterAll(() => db.close());

describe('invoices', () => {
  it('the demo has the firm and the invoices of the stays that were already numbered', async () => {
    const s = await loadState(db);
    expect(s.settings.name).toBe('Velora Stay SRL');
    expect(s.invoices.length).toBeGreaterThan(0);
    expect(s.invoices.every(i => s.reservations.find(r => r.id === i.reservationId)?.invoiceNo === invoiceNo(i))).toBe(true);
    expect(s.settings.invoiceNext).toBe(Math.max(...s.invoices.map(i => i.number)) + 1);
  });

  it('numbers in order, stamps the stay, refuses a second invoice, frees it when cancelled', async () => {
    const { reservation } = await createReservation(db, { guestId, roomIds: [roomId], checkIn: far, checkOut: addDays(far, 2), pax: 2, total: 444 });
    const before = await loadSettings(db.query);
    const a = await createInvoice(db, { reservationId: reservation.id, customer, lines: [line] });
    expect(a.invoice.number).toBe(before.invoiceNext);
    expect(a.invoice).toMatchObject({ subtotal: 400, vat: 44, total: 444, status: 'issued' });
    expect(a.reservation?.invoiceNo).toBe(invoiceNo(a.invoice));
    expect((await loadSettings(db.query)).invoiceNext).toBe(before.invoiceNext + 1);
    expect(await status(createInvoice(db, { reservationId: reservation.id, customer, lines: [line] }))).toBe(400);
    const c = await cancelInvoice(db, a.invoice.id);
    expect(c.invoice.status).toBe('cancelled'); expect(c.reservation?.invoiceNo).toBe('');
    const b = await createInvoice(db, { reservationId: reservation.id, customer, lines: [line] });
    expect(b.invoice.number).toBe(a.invoice.number + 1);
  });

  it('an invoice without a stay, and the checks on the input', async () => {
    const { invoice } = await createInvoice(db, { customer: { name: 'Ion Popescu' }, lines: [{ desc: 'Mic dejun', qty: 4, price: 35 }] });
    expect(invoice.reservationId).toBeNull(); expect(invoice.total).toBe(140); expect(invoice.lines[0].unit).toBe('buc');
    expect(await status(createInvoice(db, { customer: { name: '' }, lines: [line] }))).toBe(400);
    expect(await status(createInvoice(db, { customer, lines: [] }))).toBe(400);
    expect(await status(createInvoice(db, { reservationId: 'nope', customer, lines: [line] }))).toBe(404);
  });

  it('settings: the series and the next number cannot go back over existing invoices', async () => {
    const s = await loadSettings(db.query);
    expect(await status(updateSettings(db, { invoiceNext: 1 }))).toBe(400);
    expect(await status(updateSettings(db, { invoiceSeries: 'bad series!' }))).toBe(400);
    const { settings } = await updateSettings(db, { invoiceSeries: 'PF', invoiceNext: 10, vatPayer: false });
    expect(settings).toMatchObject({ invoiceSeries: 'PF', invoiceNext: 10, vatPayer: false });
    const { invoice } = await createInvoice(db, { customer, lines: [line] });
    expect(invoiceNo(invoice)).toBe('PF-0010'); expect(invoice.vat).toBe(0); expect(invoice.total).toBe(444);
    await updateSettings(db, { invoiceSeries: s.invoiceSeries, invoiceNext: s.invoiceNext, vatPayer: true });
  });
});
