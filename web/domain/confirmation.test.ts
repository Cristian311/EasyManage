import { describe, expect, it } from 'vitest';
import type { AppState, Reservation } from './types';
import { confirmationText, waLink, waNumber } from './confirmation';

const room = (id: string) => ({ id, propertyId: 'p', floorId: null, parentId: null, name: id, type: 'Dublă', capacity: 2, price: 200, color: '', desc: '', active: true });
const res = (over: Partial<Reservation> = {}): Reservation => ({
  id: 'r', guestId: 'g', roomIds: ['11M'], checkIn: '2026-09-10', checkOut: '2026-09-13', pax: 2, total: 600, source: 'direct', status: 'confirmed', notes: '', invoiceNo: '', invoiceDate: null,
  payments: [{ id: 'x', amount: 200, method: 'transfer', date: '2026-09-01', note: '' }], createdAt: '', ...over,
});
const state: AppState = {
  properties: [{ id: 'p', name: 'Vila Duduleanu', city: 'Brașov' }], floors: [], rooms: [room('11M'), room('12M')],
  guests: [{ id: 'g', firstName: 'Mihai', lastName: 'Popescu', phone: '0722 111 222', email: '', country: 'România', notes: '' }], reservations: [], rates: {}, expenses: [], invoices: [],
  settings: { name: 'Velora Stay SRL', cui: 'RO1', regCom: '', address: '', iban: 'RO49AAAA', bank: 'BT', phone: '0268 123 456', email: '', vatPayer: true, vatRate: 11, invoiceSeries: 'VS', invoiceNext: 1,
    checkInTime: '14:00', checkOutTime: '11:00', confirmText: 'Anulare gratuită cu 7 zile înainte.' },
};

describe('confirmation', () => {
  it('writes the whole story in plain Romanian', () => {
    const t = confirmationText(state, res());
    expect(t).toContain('Bună ziua, Mihai Popescu!');
    expect(t).toContain('la Vila Duduleanu, Brașov:');
    expect(t).toContain('• Camera 11M');
    expect(t).toContain('• Sosire: Joi, 10 sep 2026, de la ora 14:00');
    expect(t).toContain('• Plecare: Dum, 13 sep 2026, până la ora 11:00');
    expect(t).toContain('• 3 nopți, 2 persoane');
    expect(t).toContain('• Avans încasat: 200 RON');
    expect(t).toContain('• Rest de plată: 400 RON');
    expect(t).toContain('RO49AAAA (BT)');
    expect(t).toContain('Anulare gratuită');
    expect(t.endsWith('Velora Stay SRL · 0268 123 456')).toBe(true);
    expect(t).not.toMatch(/undefined|\n\n\n/);
  });
  it('adapts when things are missing or different', () => {
    const bare = { ...state, properties: [], settings: { ...state.settings, iban: '', confirmText: '', phone: '' } };
    const t = confirmationText(bare, res({ roomIds: ['11M', '12M'], payments: [], total: 1200 }));
    expect(t).toContain('la Velora Stay SRL:');
    expect(t).toContain('• Camerele 11M + 12M');
    expect(t).not.toContain('Avans');
    expect(t).not.toContain('transfer');
    expect(t.endsWith('Vă așteptăm cu drag!\nVelora Stay SRL')).toBe(true);
    expect(confirmationText(state, res({ payments: [{ id: 'x', amount: 600, method: 'cash', date: '2026-09-01', note: '' }] }))).toContain('• Achitat integral');
  });
  it('turns phone numbers into wa.me links', () => {
    expect(waNumber('0722 111 222')).toBe('40722111222');
    expect(waNumber('+49 170 123456')).toBe('49170123456');
    expect(waNumber('0040 722 111 222')).toBe('40722111222');
    expect(waNumber('')).toBeNull(); expect(waNumber('12')).toBeNull();
    expect(waLink('0722 111 222', 'Bună ziua & bun venit')).toBe('https://wa.me/40722111222?text=Bun%C4%83%20ziua%20%26%20bun%20venit');
    expect(waLink('abc', 'x')).toBeNull();
  });
});
