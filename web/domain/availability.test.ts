import { describe, expect, it } from 'vitest';
import { availability, freeFrom } from './availability';
import { res, room, state } from './fixtures';
import type { Reservation } from './types';

// A la 200 lei, B la 300, C mică (1 loc) și o cameră oprită care nu se vinde
const s = (reservations: Reservation[] = []) => state(reservations, {
  rooms: [room('A'), room('B', { price: 300 }), room('C', { capacity: 1 }), room('Oprita', { active: false })],
});

describe('availability', () => {
  it('spune ce e liber pe toate nopțile, cu prețul șederii și pe noapte', () => {
    const a = availability(s(), '2030-06-10', '2030-06-13');
    expect(a.nights).toBe(3);
    expect(a.free.map(f => [f.room.id, f.price, f.perNight])).toEqual([['A', 600, 200], ['B', 900, 300], ['C', 600, 200]]);
    expect(a.beds).toBe(5);
    expect(a.busy).toEqual([]);
  });

  it('o cameră ocupată fie și o singură noapte din mijloc nu e liberă', () => {
    const a = availability(s([res('r', ['A'], '2030-06-11', '2030-06-12', { guestId: 'g' })]), '2030-06-10', '2030-06-13');
    expect(a.free.map(f => f.room.id)).toEqual(['B', 'C']);
    expect(a.busy[0]).toMatchObject({ guest: 'Ana Pop', blocked: false, freeFrom: '2030-06-10' });
  });

  it('ziua de plecare nu se socotește: camera e liberă chiar din ziua aceea', () => {
    const a = availability(s([res('r', ['A'], '2030-06-05', '2030-06-10', { guestId: 'g' })]), '2030-06-10', '2030-06-12');
    expect(a.free.map(f => f.room.id)).toContain('A');
  });

  it('camerele blocate apar ca ocupate, cu motivul, nu cu un nume de oaspete', () => {
    const a = availability(s([res('b', ['A'], '2030-06-10', '2030-06-12', { kind: 'block', notes: 'zugrăvit', guestId: 'g' })]), '2030-06-10', '2030-06-12');
    expect(a.busy[0]).toMatchObject({ blocked: true, guest: 'zugrăvit' });
  });

  it('anulările nu ocupă, camerele oprite nu se vând, iar filtrul de persoane lasă afară camerele mici', () => {
    const a = availability(s([res('x', ['A'], '2030-06-10', '2030-06-12', { status: 'cancelled', guestId: 'g' })]), '2030-06-10', '2030-06-12', 'all', 2);
    expect(a.free.map(f => f.room.id)).toEqual(['A', 'B']);          // C are un singur loc, „Oprita” nu se vinde deloc
    expect(a.busy).toEqual([]);
  });

  it('perioada goală sau întoarsă pe dos nu dă nimic, fără să crape', () => {
    expect(availability(s(), '2030-06-10', '2030-06-10')).toMatchObject({ nights: 0, free: [], busy: [], beds: 0 });
    expect(availability(s(), '2030-06-10', '2030-06-01').nights).toBe(0);
  });
});

describe('freeFrom', () => {
  it('sare peste rezervările lipite una de alta și spune prima zi liberă', () => {
    const d = s([res('a', ['A'], '2030-06-10', '2030-06-12', { guestId: 'g' }), res('b', ['A'], '2030-06-12', '2030-06-15', { guestId: 'g' })]);
    expect(freeFrom(d, 'A', '2030-06-10')).toBe('2030-06-15');
    expect(freeFrom(d, 'A', '2030-06-20')).toBe('2030-06-20');
  });
});
