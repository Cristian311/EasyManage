import { describe, expect, it } from 'vitest';
import type { AppState, Reservation } from './types';
import { invoiceNo, invoiceTotals, lineTotals, stayLines, validateInvoice } from './invoice';

const room = (id: string) => ({ id, propertyId: 'p', floorId: null, parentId: null, name: id, type: 'Dublă', capacity: 2, price: 200, color: '', desc: '', active: true });
const res = (over: Partial<Reservation> = {}): Reservation => ({
  id: 'r', guestId: 'g', roomIds: ['A'], checkIn: '2026-09-10', checkOut: '2026-09-13', pax: 2, total: 600, source: 'direct', status: 'confirmed', notes: '', invoiceNo: '', invoiceDate: null, payments: [], createdAt: '', ...over,
});
const state: AppState = {
  properties: [], floors: [], rooms: [room('A'), room('B')], guests: [], reservations: [], rates: {}, expenses: [], invoices: [],
  settings: { name: '', cui: '', regCom: '', address: '', iban: '', bank: '', phone: '', email: '', vatPayer: true, vatRate: 11, invoiceSeries: 'VS', invoiceNext: 7, checkInTime: '14:00', checkOutTime: '11:00', confirmText: '' },
};

describe('invoice', () => {
  it('numbers with the series and four digits', () => expect(invoiceNo({ series: 'VS', number: 7 })).toBe('VS-0007'));

  it('takes the VAT out of a price that includes it', () => {
    expect(lineTotals({ desc: 'x', qty: 3, unit: 'nopți', price: 222, vat: 11 })).toEqual({ net: 600, vat: 66, total: 666 });
    expect(lineTotals({ desc: 'x', qty: 1, unit: 'buc', price: 100, vat: 0 })).toEqual({ net: 100, vat: 0, total: 100 });
    expect(invoiceTotals([{ desc: 'a', qty: 1, unit: 'buc', price: 111, vat: 11 }, { desc: 'b', qty: 2, unit: 'buc', price: 50, vat: 0 }])).toEqual({ subtotal: 200, vat: 11, total: 211 });
  });

  it('describes the stay per night when the total splits evenly, otherwise as one item', () => {
    const [a] = stayLines(state, res(), 11);
    expect(a).toEqual({ desc: 'Cazare camera A, 10 sep – 13 sep 2026', qty: 3, unit: 'nopți', price: 200, vat: 11 });
    const [b] = stayLines(state, res({ total: 1000, roomIds: ['A', 'B'] }), 0);
    expect(b.qty).toBe(1); expect(b.price).toBe(1000); expect(b.desc).toMatch(/camerele A \+ B, 3 nopți/);
  });

  it('refuses an empty customer, an empty invoice and nonsense lines', () => {
    const ok = { customer: { name: 'Ion', cui: '', regCom: '', address: '' }, issuedOn: '2026-09-10', dueOn: null, lines: [{ desc: 'Cazare', qty: 1, unit: 'buc', price: 100, vat: 0 }] };
    expect(validateInvoice(ok)).toBeNull();
    expect(validateInvoice({ ...ok, customer: { ...ok.customer, name: ' ' } })).toMatch(/clientului/);
    expect(validateInvoice({ ...ok, lines: [] })).toMatch(/un rând/);
    expect(validateInvoice({ ...ok, lines: [{ ...ok.lines[0], qty: 0 }] })).toMatch(/Cantitatea/);
    expect(validateInvoice({ ...ok, dueOn: '2026-09-01' })).toMatch(/Scadența/);
  });
});
