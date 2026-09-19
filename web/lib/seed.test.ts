// Datele de probă. Sunt și primul lucru pe care îl vede cineva care deschide aplicația, și baza pentru
// celelalte teste: dacă ele ies strâmbe (o cameră cu două rezervări, o plată mai mare decât totalul),
// nu se mai poate avea încredere în nimic din ce e măsurat peste ele.
import { describe, expect, it } from 'vitest';
import type { AppState } from '@/domain/types';
import { addDays, isIsoDate } from '@/domain/dates';
import { conflict, nights, paid, validateReservation } from '@/domain/rules';
import { METHOD, SRC, STATUS } from '@/domain/labels';
import { buildDemo } from './seed';

const TODAY = '2026-09-10';
const s = buildDemo(TODAY);

/** Ce înseamnă demoul, fără id-urile care se schimbă la fiecare apel. */
const shape = (x: AppState) => {
  const room = new Map(x.rooms.map(r => [r.id, r.name]));
  const guest = new Map(x.guests.map(g => [g.id, `${g.firstName} ${g.lastName}`]));
  return x.reservations.map(r => [guest.get(r.guestId), r.roomIds.map(i => room.get(i)).join('+'), r.checkIn, r.checkOut, r.pax, r.total, r.source, r.status].join('|'));
};

describe('buildDemo', () => {
  it('arată la fel de fiecare dată, pentru aceeași zi', () => {
    expect(shape(buildDemo(TODAY))).toEqual(shape(buildDemo(TODAY)));
    expect(buildDemo(TODAY).reservations).toHaveLength(s.reservations.length);
  });
  it('se așază în jurul zilei primite', () => {
    const other = buildDemo('2026-10-01');
    expect(s.reservations.some(r => r.checkIn === addDays(TODAY, -2))).toBe(true);
    expect(other.reservations.some(r => r.checkIn === addDays('2026-10-01', -2))).toBe(true);
  });

  it('are două vile, camere și oaspeți', () => {
    expect(s.properties.map(p => p.name)).toEqual(['Vila Duduleanu', 'Vila Mateo']);
    expect(s.rooms).toHaveLength(37);
    expect(s.guests.length).toBeGreaterThan(100);
    expect(s.reservations.length).toBeGreaterThan(800);
  });

  it('fiecare rezervare e una pe care aplicația ar accepta-o', () => {
    for (const r of s.reservations) expect(validateReservation(r), r.id).toBeNull();
  });

  it('nicio cameră nu e dată de două ori în aceeași noapte', () => {
    const seen: AppState = { ...s, reservations: [] };
    for (const r of s.reservations) {
      for (const id of r.roomIds) {
        if (r.status !== 'cancelled') expect(conflict(seen, id, r.checkIn, r.checkOut), `${r.id} / ${id}`).toBeNull();
      }
      seen.reservations.push(r);
    }
  });

  it('toate legăturile duc undeva', () => {
    const rooms = new Set(s.rooms.map(r => r.id)), guests = new Set(s.guests.map(g => g.id));
    const props = new Set(s.properties.map(p => p.id)), floors = new Set(s.floors.map(f => f.id));
    for (const r of s.rooms) {
      expect(props.has(r.propertyId)).toBe(true);
      expect(r.floorId === null || floors.has(r.floorId)).toBe(true);
    }
    for (const f of s.floors) expect(props.has(f.propertyId)).toBe(true);
    for (const r of s.reservations) {
      expect(guests.has(r.guestId), r.id).toBe(true);
      expect(r.roomIds.every(id => rooms.has(id)), r.id).toBe(true);
    }
  });

  it('nimeni nu a plătit mai mult decât are de plătit', () => {
    for (const r of s.reservations) expect(paid(r), r.id).toBeLessThanOrEqual(r.total);
  });

  it('sumele, nopțile și datele au sens', () => {
    for (const r of s.reservations) {
      expect(nights(r), r.id).toBeGreaterThan(0);
      expect(r.total, r.id).toBeGreaterThanOrEqual(0);
      expect(r.source in SRC && r.status in STATUS, r.id).toBe(true);
      for (const p of r.payments) {
        expect(p.amount, r.id).toBeGreaterThan(0);
        expect(p.method in METHOD, r.id).toBe(true);
        expect(isIsoDate(p.date), r.id).toBe(true);
      }
    }
  });

  it('prețurile speciale sunt puse pe camere care există, cu sume întregi', () => {
    const rooms = new Set(s.rooms.map(r => r.id));
    for (const [id, nopti] of Object.entries(s.rates)) {
      expect(rooms.has(id)).toBe(true);
      for (const [d, price] of Object.entries(nopti)) {
        expect(isIsoDate(d)).toBe(true);
        expect(Number.isInteger(price) && price > 0).toBe(true);
      }
    }
  });

  it('cheltuielile au dată, sumă și o proprietate care există (sau niciuna, dacă sunt comune)', () => {
    const props = new Set(s.properties.map(p => p.id));
    expect(s.expenses.length).toBeGreaterThan(0);
    for (const e of s.expenses) {
      expect(isIsoDate(e.date), e.id).toBe(true);
      expect(e.amount, e.id).toBeGreaterThan(0);
      expect(e.propertyId === null || props.has(e.propertyId), e.id).toBe(true);
    }
  });

  it('august e plin', () => {
    const noapte = '2026-08-14';
    const ocupate = new Set(s.reservations.filter(r => r.status !== 'cancelled' && r.checkIn <= noapte && r.checkOut > noapte).flatMap(r => r.roomIds));
    expect(ocupate.size).toBe(s.rooms.length);
  });
});
