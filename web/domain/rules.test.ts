import { describe, expect, it } from 'vitest';
import type { AppState, Reservation } from './types';
import { alertFor, conflict, payStatus, quickAction, remaining, stayPrice, validateReservation } from './rules';

const room = (id: string, price = 200) => ({ id, propertyId: 'p', floorId: null, parentId: null, name: id, type: 'Dublă', capacity: 2, price, color: '', desc: '', active: true });
const res = (id: string, roomIds: string[], checkIn: string, checkOut: string, over: Partial<Reservation> = {}): Reservation => ({
  id, guestId: 'g', roomIds, checkIn, checkOut, pax: 2, total: 400, source: 'direct', status: 'confirmed', notes: '', invoiceNo: '', invoiceDate: null, payments: [], createdAt: '', ...over,
});
const state = (reservations: Reservation[], rates: AppState['rates'] = {}): AppState => ({
  properties: [{ id: 'p', name: 'Vila', city: '' }], floors: [], rooms: [room('A'), room('B', 300)], guests: [], reservations, rates, expenses: [],
  settings: { name: '', cui: '', regCom: '', address: '', iban: '', bank: '', phone: '', email: '', vatPayer: false, vatRate: 11, invoiceSeries: 'VS', invoiceNext: 1, checkInTime: '14:00', checkOutTime: '11:00', confirmText: '' }, invoices: [],
});

describe('conflict', () => {
  const s = state([res('r1', ['A'], '2026-09-10', '2026-09-12')]);
  it('sees an overlap', () => expect(conflict(s, 'A', '2026-09-11', '2026-09-13')?.id).toBe('r1'));
  it('lets one leave and the next arrive on the same day', () => {
    expect(conflict(s, 'A', '2026-09-12', '2026-09-14')).toBeNull();
    expect(conflict(s, 'A', '2026-09-08', '2026-09-10')).toBeNull();
  });
  it('ignores other rooms, the reservation itself and cancelled ones', () => {
    expect(conflict(s, 'B', '2026-09-10', '2026-09-12')).toBeNull();
    expect(conflict(s, 'A', '2026-09-10', '2026-09-12', 'r1')).toBeNull();
    expect(conflict(state([res('r1', ['A'], '2026-09-10', '2026-09-12', { status: 'cancelled' })]), 'A', '2026-09-10', '2026-09-12')).toBeNull();
  });
  it('checks every room of a multi-room stay', () => expect(conflict(state([res('r1', ['A', 'B'], '2026-09-10', '2026-09-12')]), 'B', '2026-09-11', '2026-09-12')?.id).toBe('r1'));
});

describe('money', () => {
  it('computes what is left to pay', () => {
    const r = res('r', ['A'], '2026-09-10', '2026-09-12', { total: 500, payments: [{ id: 'x', amount: 200, method: 'cash', date: '2026-09-10', note: '' }] });
    expect(remaining(r)).toBe(300);
    expect(payStatus(r)).toBe('partial');
  });
  it('prices a stay night by night, special prices first', () => {
    const s = state([], { A: { '2026-09-11': 250 } });
    expect(stayPrice(s, ['A', 'B'], '2026-09-10', '2026-09-12')).toBe(200 + 250 + 300 + 300);
  });
});

describe('front desk', () => {
  const today = '2026-09-10';
  it('flags a guest that should have arrived', () => expect(alertFor(res('r', ['A'], '2026-09-09', '2026-09-12'), today)?.level).toBe('warn'));
  it('flags leaving today with money owed', () => expect(alertFor(res('r', ['A'], '2026-09-08', today, { status: 'checked_in' }), today)?.level).toBe('bad'));
  it('offers check-in on the arrival day and check-out on the departure day', () => {
    expect(quickAction(res('r', ['A'], today, '2026-09-12'), today)?.status).toBe('checked_in');
    expect(quickAction(res('r', ['A'], '2026-09-08', today, { status: 'checked_in' }), today)?.status).toBe('checked_out');
  });
});

describe('validateReservation', () => {
  const ok = { roomIds: ['A'], checkIn: '2026-09-10', checkOut: '2026-09-12', pax: 2, total: 400, source: 'direct', status: 'confirmed' };
  it('accepts a normal booking', () => expect(validateReservation(ok)).toBeNull());
  it('rejects bad input with a message', () => {
    expect(validateReservation({ ...ok, checkOut: '2026-09-10' })).toMatch(/după check-in/);
    expect(validateReservation({ ...ok, roomIds: [] })).toMatch(/cameră/);
    expect(validateReservation({ ...ok, checkIn: '2026-02-30' })).toMatch(/nu sunt valide/);
    expect(validateReservation({ ...ok, pax: 0 })).toMatch(/persoane/);
  });
});
