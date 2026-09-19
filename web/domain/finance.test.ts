// Banii pe o lună: ce s-a câștigat, ce s-a încasat, ce s-a cheltuit. Partea cea mai ușor de greșit este
// sejurul care trece dintr-o lună în alta: se împarte pe nopți, iar bucățile trebuie să dea exact totalul.
import { describe, expect, it } from 'vitest';
import type { AppState } from './types';
import { expense, guest, pay, res, room } from './fixtures';
import { COMM, addMonths, expensesIn, finMonth, monthEnd, monthName, occupancyByDay } from './finance';

// două vile: A și B în prima, C în a doua; toate camerele la 200 lei
const base = (over: Partial<AppState> = {}): AppState => ({
  properties: [{ id: 'p1', name: 'Vila Unu', city: '' }, { id: 'p2', name: 'Vila Doi', city: '' }],
  floors: [],
  rooms: [room('A', { propertyId: 'p1' }), room('B', { propertyId: 'p1' }), room('C', { propertyId: 'p2' })],
  guests: [guest('g')], reservations: [], rates: {}, expenses: [], ...over,
});

describe('luni', () => {
  it('trece dintr-un an în altul, în ambele sensuri', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-01', 13)).toBe('2027-02');
    expect(addMonths('2026-03', 0)).toBe('2026-03');
  });
  it('știe câte zile are luna, inclusiv februarie bisect', () => {
    expect(monthEnd('2026-02')).toBe('2026-02-28');
    expect(monthEnd('2028-02')).toBe('2028-02-29');
    expect(monthEnd('2026-09')).toBe('2026-09-30');
    expect(monthEnd('2026-12')).toBe('2026-12-31');
  });
  it('scrie numele lunii în română', () => expect(monthName('2026-08')).toBe('August 2026'));
});

describe('expensesIn', () => {
  const s = base({
    expenses: [
      expense({ id: 'e1', date: '2026-09-15', amount: 500, propertyId: 'p1' }),
      expense({ id: 'e2', date: '2026-08-06', amount: 300, propertyId: 'p1' }),
      expense({ id: 'e3', date: '2026-08-01', amount: 7000, recurring: true }),                          // fără proprietate: comună
      expense({ id: 'e4', date: '2026-08-01', amount: 1000, recurring: true, until: '2026-08-31' }),     // oprită din septembrie
      expense({ id: 'e5', date: '2026-10-01', amount: 200, recurring: true }),                           // începe abia în octombrie
    ],
  });
  const ids = (m: string, prop = 'all') => expensesIn(s, m, prop).map(e => e.id).sort();

  it('ia cheltuielile datate doar în luna lor', () => {
    expect(ids('2026-09')).toContain('e1');
    expect(ids('2026-08')).not.toContain('e1');
    expect(ids('2026-10')).not.toContain('e1');
  });
  it('ține cheltuiala recurentă din luna de început până când e oprită', () => {
    expect(ids('2026-07')).not.toContain('e3');
    expect(ids('2026-08')).toContain('e3');
    expect(ids('2026-09')).toContain('e3');
    expect(ids('2026-08')).toContain('e4');
    expect(ids('2026-09')).not.toContain('e4');
    expect(ids('2026-09')).not.toContain('e5');
  });
  it('filtrează pe proprietate; cheltuielile comune nu intră în filtrul unei proprietăți', () => {
    expect(ids('2026-09', 'p1')).toEqual(['e1']);
    expect(ids('2026-09', 'p2')).toEqual([]);
  });
});

describe('finMonth', () => {
  it('împarte sejurul între luni, pe nopți, iar bucățile dau exact totalul', () => {
    const s = base({ reservations: [res('r1', ['A'], '2026-08-30', '2026-09-02', { total: 300 })] });   // 3 nopți: 2 în august, 1 în septembrie
    expect(finMonth(s, '2026-08', 'all').earned).toBe(200);
    expect(finMonth(s, '2026-09', 'all').earned).toBe(100);
    expect(finMonth(s, '2026-08', 'all').earned + finMonth(s, '2026-09', 'all').earned).toBe(300);
  });

  it('scade comisionul platformei din venit', () => {
    const s = base({ reservations: [res('r1', ['A'], '2026-09-10', '2026-09-12', { total: 1000, source: 'booking' })] });
    const f = finMonth(s, '2026-09', 'all');
    expect(f.comm).toBeCloseTo(1000 * COMM.booking!, 6);
    expect(f.profit).toBeCloseTo(f.cashed - f.spent - f.comm, 6);
  });
  it('nu pune comision pe rezervările directe', () => {
    const s = base({ reservations: [res('r1', ['A'], '2026-09-10', '2026-09-12', { total: 1000, source: 'direct' })] });
    expect(finMonth(s, '2026-09', 'all').comm).toBe(0);
  });

  it('rezervarea anulată nu aduce venit, dar banii deja primiți rămân încasați', () => {
    const s = base({
      reservations: [res('r1', ['A'], '2026-09-10', '2026-09-12', { total: 1000, status: 'cancelled', payments: [pay(200, { date: '2026-09-05' })] })],
    });
    const f = finMonth(s, '2026-09', 'all');
    expect(f.earned).toBe(0);
    expect(f.roomNights).toBe(0);
    expect(f.cashed).toBe(200);
  });

  it('numără plățile după data lor, nu după data sejurului', () => {
    const s = base({
      reservations: [res('r1', ['A'], '2026-10-05', '2026-10-07', { total: 400, payments: [pay(150, { date: '2026-09-20', method: 'transfer' }), pay(250, { date: '2026-10-05', method: 'card' })] })],
    });
    expect(finMonth(s, '2026-09', 'all').cashed).toBe(150);
    expect(finMonth(s, '2026-09', 'all').byMethod).toEqual({ transfer: 150 });
    expect(finMonth(s, '2026-10', 'all').cashed).toBe(250);
    expect(finMonth(s, '2026-10', 'all').pays.map(p => p.pm.amount)).toEqual([250]);
  });

  it('restul de încasat se pune pe luna sosirii', () => {
    const s = base({
      reservations: [
        res('r1', ['A'], '2026-09-10', '2026-09-12', { total: 1000, payments: [pay(400, { date: '2026-09-10' })] }),
        res('r2', ['B'], '2026-08-28', '2026-09-03', { total: 600 }),                                    // sosește în august
      ],
    });
    expect(finMonth(s, '2026-09', 'all').outstanding).toBe(600);   // doar r1
    expect(finMonth(s, '2026-08', 'all').outstanding).toBe(600);   // doar r2
  });

  it('strânge nopțile și venitul pe surse', () => {
    const s = base({
      reservations: [
        res('r1', ['A', 'B'], '2026-09-10', '2026-09-12', { total: 800, source: 'booking' }),
        res('r2', ['C'], '2026-09-10', '2026-09-13', { total: 600, source: 'direct' }),
      ],
    });
    const f = finMonth(s, '2026-09', 'all');
    expect(f.bySrc.booking).toEqual({ res: 1, n: 4, v: 800 });     // 2 nopți × 2 camere
    expect(f.bySrc.direct).toEqual({ res: 1, n: 3, v: 600 });
    expect(f.roomNights).toBe(7);
  });

  it('gradul de ocupare ține cont de camerele active și de cele împărțite în unități', () => {
    const s = base({ reservations: [res('r1', ['A'], '2026-09-10', '2026-09-13', { total: 600 })] });    // 3 nopți
    expect(finMonth(s, '2026-09', 'all').occ).toBeCloseTo(3 / (3 * 30), 6);

    const off = base({ rooms: [...base().rooms.slice(0, 2), room('C', { propertyId: 'p2', active: false })], reservations: s.reservations });
    expect(finMonth(off, '2026-09', 'all').occ).toBeCloseTo(3 / (2 * 30), 6);   // camera dezactivată iese din calcul

    const split = base({ rooms: [...base().rooms, room('A1', { propertyId: 'p1', parentId: 'A' }), room('A2', { propertyId: 'p1', parentId: 'A' })], reservations: [] });
    expect(finMonth(split, '2026-09', 'all').occ).toBe(0);
    expect(finMonth(split, '2026-09', 'all').roomNights).toBe(0);
    // A e împărțită, deci nu se numără ea, ci unitățile ei: 2 + B + C = 4 camere
    const busy = { ...split, reservations: [res('r1', ['A1'], '2026-09-10', '2026-09-11', { total: 200 })] };
    expect(finMonth(busy, '2026-09', 'all').occ).toBeCloseTo(1 / (4 * 30), 6);
  });

  it('filtrează pe proprietate după prima cameră a rezervării', () => {
    const s = base({
      reservations: [
        res('r1', ['A'], '2026-09-10', '2026-09-12', { total: 400, payments: [pay(400, { date: '2026-09-10' })] }),
        res('r2', ['C'], '2026-09-10', '2026-09-12', { total: 500, payments: [pay(500, { date: '2026-09-10' })] }),
      ],
      expenses: [expense({ id: 'e1', date: '2026-09-05', amount: 100, propertyId: 'p1' })],
    });
    const f1 = finMonth(s, '2026-09', 'p1');
    expect([f1.earned, f1.cashed, f1.spent]).toEqual([400, 400, 100]);
    const f2 = finMonth(s, '2026-09', 'p2');
    expect([f2.earned, f2.cashed, f2.spent]).toEqual([500, 500, 0]);
    expect(finMonth(s, '2026-09', 'all').cashed).toBe(900);
  });

  it('o lună fără nimic dă zerouri, nu erori', () => {
    const f = finMonth(base(), '2026-09', 'all');
    expect([f.earned, f.cashed, f.spent, f.comm, f.profit, f.outstanding, f.occ, f.roomNights]).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(f.pays).toEqual([]);
  });
});

describe('occupancyByDay', () => {
  it('are câte o valoare pentru fiecare zi a lunii', () => {
    const o = occupancyByDay(base(), '2026-09', 'all');
    expect([o.a, o.n, o.rooms]).toEqual(['2026-09-01', 30, 3]);
    expect(o.used).toHaveLength(30);
    expect(occupancyByDay(base(), '2026-02', 'all').n).toBe(28);
    expect(occupancyByDay(base(), '2028-02', 'all').n).toBe(29);
  });
  it('numără doar nopțile din lună și câte o unitate pentru fiecare cameră', () => {
    const s = base({
      reservations: [
        res('r1', ['A'], '2026-08-30', '2026-09-02', { total: 300 }),          // doar noaptea de 1 septembrie
        res('r2', ['B', 'C'], '2026-09-01', '2026-09-03', { total: 800 }),     // 2 camere × 2 nopți
        res('r3', ['A'], '2026-09-01', '2026-09-05', { total: 800, status: 'cancelled' }),
      ],
    });
    const { used } = occupancyByDay(s, '2026-09', 'all');
    expect(used[0]).toBe(3);   // 1 sep: r1 (1) + r2 (2)
    expect(used[1]).toBe(2);   // 2 sep: doar r2
    expect(used[2]).toBe(0);   // 3 sep: plecare dimineața, camera e liberă
  });
});
