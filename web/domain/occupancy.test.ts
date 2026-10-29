import { describe, expect, it } from 'vitest';
import type { Reservation } from './types';
import { res, room, state } from './fixtures';
import { occupancyByMonth, yearTotal } from './occupancy';

// două camere, deci 62 de nopți-cameră în ianuarie (2 × 31)
const s = (reservations: Reservation[] = []) => state(reservations, { rooms: [room('A'), room('B')] });
const jan = (rows: ReturnType<typeof occupancyByMonth>) => rows[0];

describe('occupancyByMonth', () => {
  it('socotește nopți-cameră, nu rezervări: 2 camere × 3 nopți = 6 din 62', () => {
    const rows = occupancyByMonth(s([res('r', ['A', 'B'], '2030-01-10', '2030-01-13', { total: 900 })]), 2030);
    expect(jan(rows)).toMatchObject({ rooms: 2, nights: 62, sold: 6, arrivals: 1, revenue: 900 });
    expect(jan(rows).occupancy).toBeCloseTo((6 / 62) * 100, 2);
    expect(jan(rows).adr).toBe(150);              // 900 lei / 6 nopți-cameră
    expect(jan(rows).revpar).toBeCloseTo(900 / 62, 2);
  });

  it('o ședere peste două luni își lasă nopțile și banii în fiecare lună', () => {
    const rows = occupancyByMonth(s([res('r', ['A'], '2030-01-30', '2030-02-03', { total: 400 })]), 2030);
    expect([rows[0].sold, rows[1].sold]).toEqual([2, 2]);
    expect([rows[0].revenue, rows[1].revenue]).toEqual([200, 200]);
    expect([rows[0].arrivals, rows[1].arrivals]).toEqual([1, 0]);   // sosirea se numără o dată, în luna în care vine
  });

  it('anulările nu intră; o cameră blocată scade din ce se putea vinde, fără să fie vânzare', () => {
    const rows = occupancyByMonth(s([
      res('x', ['A'], '2030-01-05', '2030-01-08', { status: 'cancelled', total: 900 }),
      res('b', ['B'], '2030-01-05', '2030-01-10', { kind: 'block', total: 0, notes: 'zugrăvit' }),
      res('ok', ['A'], '2030-01-20', '2030-01-22', { total: 300 }),
    ]), 2030);
    expect(jan(rows)).toMatchObject({ blocked: 5, nights: 57, sold: 2, revenue: 300, arrivals: 1 });
  });

  it('nopțile din alt an sau de la altă vilă rămân afară', () => {
    const two = state([res('r', ['A'], '2030-12-30', '2031-01-02', { total: 300 })], { rooms: [room('A'), room('B')] });
    expect(occupancyByMonth(two, 2030)[11].sold).toBe(2);
    expect(occupancyByMonth(two, 2031)[0].sold).toBe(1);
    expect(occupancyByMonth(two, 2030, 'alta-vila').every(r => r.rooms === 0 && r.occupancy === 0)).toBe(true);
  });

  it('un an gol dă douăsprezece luni cu zero, fără împărțiri la zero', () => {
    const rows = occupancyByMonth(s(), 2030);
    expect(rows).toHaveLength(12);
    expect(rows.every(r => r.sold === 0 && r.occupancy === 0 && r.adr === 0 && r.revpar === 0)).toBe(true);
  });
});

describe('yearTotal', () => {
  it('adună lunile și socotește din nou ocuparea și prețul mediu', () => {
    const rows = occupancyByMonth(s([res('a', ['A'], '2030-01-10', '2030-01-12', { total: 400 }), res('b', ['B'], '2030-07-01', '2030-07-03', { total: 600 })]), 2030);
    const t = yearTotal(rows);
    expect(t).toMatchObject({ sold: 4, revenue: 1000, arrivals: 2, nights: 2 * 365 });
    expect(t.adr).toBe(250);
    expect(t.occupancy).toBe(0.55);                 // procentele se rotunjesc la două zecimale
  });
  it('fără rânduri nu crapă', () => {
    expect(yearTotal([])).toMatchObject({ sold: 0, occupancy: 0, adr: 0, revpar: 0, rooms: 0 });
  });
});
