// Restul regulilor: prețuri pe noapte, alertele de la recepție, ordinea camerelor pe calendar
// și camerele alăturate (creștere, micșorare, unire).
import { describe, expect, it } from 'vitest';
import type { AppState, Reservation } from './types';
import { ALL, guest, pay, res, room, state } from './fixtures';
import {
  addOutcome, alertFor, bookableRooms, columns, conflictAny, contiguous, mergeCandidate, neighbours, nights,
  orderedTops, payStatus, quickAction, rateFor, remaining, roomLabel, shortProp, sortByColumns, validateReservation,
} from './rules';

/** Patru camere una lângă alta, ca să se vadă clar ce e alăturat și ce nu. */
const line = (reservations: Reservation[] = []): AppState =>
  state(reservations, { rooms: [room('A'), room('B'), room('C'), room('D')], guests: [guest('g'), guest('g2', { firstName: 'Ion', lastName: 'Rus' })] });

/** Două vile, etaje, o cameră împărțită în trei unități și o cameră fără etaj. */
const villas = (): AppState => ({
  properties: [{ id: 'p1', name: 'Vila Duduleanu', city: '' }, { id: 'p2', name: 'Vila Mateo', city: '' }],
  floors: [{ id: 'f1', propertyId: 'p1', name: 'Parter' }, { id: 'f2', propertyId: 'p1', name: 'Etaj 1' }, { id: 'f3', propertyId: 'p2', name: 'Parter' }],
  rooms: [
    room('b', { propertyId: 'p2', floorId: 'f3' }),
    room('a2', { propertyId: 'p1', floorId: 'f2' }),
    room('a1', { propertyId: 'p1', floorId: 'f1' }),
    room('a0', { propertyId: 'p1', floorId: null, active: false }),
    room('u1', { propertyId: 'p1', floorId: 'f1', parentId: 'a1' }),
    room('u2', { propertyId: 'p1', floorId: 'f1', parentId: 'a1' }),
    room('u3', { propertyId: 'p1', floorId: 'f1', parentId: 'a1' }),
  ],
  guests: [guest('g')], reservations: [], rates: {}, expenses: [],
});

describe('prețuri', () => {
  const s = state([], { rates: { A: { '2026-09-11': 250 } } });
  it('ia prețul special al nopții, altfel prețul camerei', () => {
    expect(rateFor(s, 'A', '2026-09-11')).toBe(250);
    expect(rateFor(s, 'A', '2026-09-10')).toBe(200);
    expect(rateFor(s, 'B', '2026-09-11')).toBe(300);
  });
  it('o cameră care nu există costă 0, nu aruncă', () => expect(rateFor(s, 'nope', '2026-09-10')).toBe(0));
});

describe('bani și nopți', () => {
  it('numără nopțile sejurului', () => expect(nights(res('r', ['A'], '2026-09-10', '2026-09-13'))).toBe(3));
  it('fără nicio plată e neplătit', () => {
    const r = res('r', ['A'], '2026-09-10', '2026-09-12', { total: 500 });
    expect(payStatus(r)).toBe('unpaid');
    expect(remaining(r)).toBe(500);
  });
  it('plătit integral, iar ce s-a dat în plus nu face restul negativ', () => {
    const r = res('r', ['A'], '2026-09-10', '2026-09-12', { total: 500, payments: [pay(600)] });
    expect(payStatus(r)).toBe('paid');
    expect(remaining(r)).toBe(0);
  });
  it('scrie camerele rezervării', () => expect(roomLabel(line(), res('r', ['A', 'C'], '2026-09-10', '2026-09-12'))).toBe('A + C'));
});

describe('conflictAny', () => {
  const s = line([res('r1', ['B'], '2026-09-10', '2026-09-12')]);
  it('găsește prima cameră ocupată din listă', () => expect(conflictAny(s, ['A', 'B', 'C'], '2026-09-11', '2026-09-13')?.id).toBe('r1'));
  it('nu se plânge când toate sunt libere', () => expect(conflictAny(s, ['A', 'C'], '2026-09-11', '2026-09-13')).toBeNull());
});

describe('alertFor', () => {
  const today = '2026-09-10';
  it('nu are ce spune despre o rezervare anulată sau despre un oaspete plecat', () => {
    expect(alertFor(res('r', ['A'], '2026-09-09', '2026-09-12', { status: 'cancelled' }), today)).toBeNull();
    expect(alertFor(res('r', ['A'], '2026-09-08', '2026-09-09', { status: 'checked_out' }), today)).toBeNull();
  });
  it('înainte de ora 14 spune doar că sosește azi', () => {
    expect(alertFor(res('r', ['A'], today, '2026-09-12'), today, 13)?.text).toBe('Sosește azi, încă nu e cazat');
  });
  it('de la ora 14 atrage atenția că a trecut ora de check-in', () => {
    expect(alertFor(res('r', ['A'], today, '2026-09-12'), today, 14)?.text).toBe('A trecut ora de check-in (14:00) și nu e cazat');
  });
  it('spune de când trebuia să sosească, dacă e din zilele trecute', () => {
    expect(alertFor(res('r', ['A'], '2026-09-08', '2026-09-12'), today, 9)?.text).toBe('Trebuia să sosească pe 8 sep și nu e cazat');
  });
  it('pleacă azi cu rest de plată', () => {
    const r = res('r', ['A'], '2026-09-08', today, { status: 'checked_in', total: 500, payments: [pay(200)] });
    expect(alertFor(r, today)).toEqual({ level: 'bad', text: 'Pleacă azi cu rest de plată 300 RON' });
  });
  it('pleacă azi cu totul plătit: nimic de semnalat', () => {
    expect(alertFor(res('r', ['A'], '2026-09-08', today, { status: 'checked_in', total: 500, payments: [pay(500)] }), today)).toBeNull();
  });
  it('a depășit ziua plecării și e încă cazat', () => {
    expect(alertFor(res('r', ['A'], '2026-09-05', '2026-09-09', { status: 'checked_in' }), today)?.text).toBe('Trebuia să plece pe 9 sep');
  });
});

describe('quickAction', () => {
  const today = '2026-09-10';
  it('cazează și o rezervare în așteptare', () => expect(quickAction(res('r', ['A'], today, '2026-09-12', { status: 'pending' }), today)?.label).toBe('Cazează'));
  it('nu oferă nimic înainte de ziua sosirii sau după plecare', () => {
    expect(quickAction(res('r', ['A'], '2026-09-11', '2026-09-13'), today)).toBeNull();
    expect(quickAction(res('r', ['A'], '2026-09-05', '2026-09-08', { status: 'checked_out' }), today)).toBeNull();
    expect(quickAction(res('r', ['A'], today, '2026-09-12', { status: 'cancelled' }), today)).toBeNull();
  });
  it('un oaspete cazat pleacă doar din ziua plecării', () => {
    expect(quickAction(res('r', ['A'], '2026-09-08', '2026-09-12', { status: 'checked_in' }), today)).toBeNull();
    expect(quickAction(res('r', ['A'], '2026-09-08', today, { status: 'checked_in' }), today)?.label).toBe('Pleacă');
  });
});

describe('ordinea camerelor', () => {
  it('întâi proprietatea, apoi etajul, camerele fără etaj la urmă', () => {
    expect(orderedTops(villas()).map(r => r.id)).toEqual(['a1', 'a2', 'a0', 'b']);
  });
  it('o cameră împărțită apare pe calendar prin unitățile ei', () => {
    expect(columns(villas(), ALL).map(c => [c.room.id, c.parent?.id ?? null, c.pos]))
      .toEqual([['u1', 'a1', 'unit-first'], ['u2', 'a1', 'unit-mid'], ['u3', 'a1', 'unit-last'], ['a2', null, ''], ['a0', null, ''], ['b', null, '']]);
  });
  it('filtrează pe proprietate și pe etaj', () => {
    expect(columns(villas(), { prop: 'p2', floor: 'all' }).map(c => c.room.id)).toEqual(['b']);
    expect(columns(villas(), { prop: 'p1', floor: 'f2' }).map(c => c.room.id)).toEqual(['a2']);
  });
  it('camerele dezactivate nu se pot rezerva', () => {
    expect(bookableRooms(villas(), ALL).map(r => r.id)).toEqual(['u1', 'u2', 'u3', 'a2', 'b']);
  });
  it('pune ids în ordinea de pe calendar și scoate duplicatele', () => {
    expect(sortByColumns(villas(), ALL, ['b', 'u2', 'a2', 'u2'])).toEqual(['u2', 'a2', 'b']);
  });
});

describe('shortProp', () => {
  it('taie cuvântul generic de la început', () => {
    expect(shortProp({ id: 'p', name: 'Vila Duduleanu', city: '' })).toBe('Duduleanu');
    expect(shortProp({ id: 'p', name: 'Pensiunea Trei Brazi', city: '' })).toBe('Trei Brazi');
  });
  it('lasă numele în pace dacă nu începe așa', () => {
    expect(shortProp({ id: 'p', name: 'Mateo Resort', city: '' })).toBe('Mateo');
    expect(shortProp({ id: 'p', name: 'Vila', city: '' })).toBe('Vila');
  });
  it('fără proprietate întoarce text gol', () => expect(shortProp(undefined)).toBe(''));
});

describe('validateReservation', () => {
  const ok = { roomIds: ['A'], checkIn: '2026-09-10', checkOut: '2026-09-12', pax: 2, total: 400, source: 'direct', status: 'confirmed' };
  it('prinde aceeași cameră trecută de două ori', () => expect(validateReservation({ ...ok, roomIds: ['A', 'A'] })).toMatch(/de două ori/));
  it('acceptă 366 de nopți, dar nu 367', () => {
    expect(validateReservation({ ...ok, checkIn: '2026-01-01', checkOut: '2027-01-02' })).toBeNull();
    expect(validateReservation({ ...ok, checkIn: '2026-01-01', checkOut: '2027-01-03' })).toMatch(/366/);
  });
  it('prinde un număr de persoane imposibil', () => {
    expect(validateReservation({ ...ok, pax: 2.5 })).toMatch(/persoane/);
    expect(validateReservation({ ...ok, pax: 100 })).toMatch(/persoane/);
  });
  it('prinde un preț imposibil', () => {
    expect(validateReservation({ ...ok, total: -1 })).toMatch(/Prețul total/);
    expect(validateReservation({ ...ok, total: NaN })).toMatch(/Prețul total/);
    expect(validateReservation({ ...ok, total: 0 })).toBeNull();
  });
  it('prinde o sursă sau un status pe care aplicația nu le cunoaște', () => {
    expect(validateReservation({ ...ok, source: 'expedia' })).toMatch(/Sursa/);
    expect(validateReservation({ ...ok, status: 'no_show' })).toMatch(/Statusul/);
  });
});

describe('camere alăturate', () => {
  it('contiguous: ordinea nu contează, golurile da', () => {
    expect(contiguous([])).toBe(true);
    expect(contiguous([2])).toBe(true);
    expect(contiguous([3, 1, 2])).toBe(true);
    expect(contiguous([1, 1, 2])).toBe(true);
    expect(contiguous([1, 3])).toBe(false);
  });

  it('neighbours: ce e la stânga și la dreapta sejurului', () => {
    const r = res('r1', ['B', 'C'], '2026-09-10', '2026-09-12');
    const n = neighbours(line([r]), ALL, r);
    expect([n.left?.id, n.right?.id, n.first?.id, n.last?.id, n.span]).toEqual(['A', 'D', 'B', 'C', 2]);
  });
  it('neighbours: la capete nu mai e nimic', () => {
    const r = res('r1', ['A', 'B', 'C', 'D'], '2026-09-10', '2026-09-12');
    const n = neighbours(line([r]), ALL, r);
    expect([n.left, n.right, n.span]).toEqual([null, null, 4]);
  });
  it('neighbours: o cameră care nu e pe calendar nu dă vecini', () => {
    const r = res('r1', ['X'], '2026-09-10', '2026-09-12');
    expect(neighbours(line([r]), ALL, r)).toEqual({ left: null, right: null, first: undefined, last: undefined, span: 1 });
  });

  describe('mergeCandidate', () => {
    const a = res('r1', ['B'], '2026-09-10', '2026-09-12');
    it('găsește sejurul alăturat al aceluiași oaspete, pe aceleași nopți', () => {
      const b = res('r2', ['C'], '2026-09-10', '2026-09-12');
      expect(mergeCandidate(line([a, b]), ALL, a)?.id).toBe('r2');
    });
    it('nu unește camere care nu sunt alăturate', () => {
      const b = res('r2', ['D'], '2026-09-10', '2026-09-12');
      expect(mergeCandidate(line([a, b]), ALL, a)).toBeNull();
    });
    it('nu unește alt oaspete, alte nopți sau o rezervare anulată', () => {
      expect(mergeCandidate(line([a, res('r2', ['C'], '2026-09-10', '2026-09-12', { guestId: 'g2' })]), ALL, a)).toBeNull();
      expect(mergeCandidate(line([a, res('r2', ['C'], '2026-09-10', '2026-09-13')]), ALL, a)).toBeNull();
      expect(mergeCandidate(line([a, res('r2', ['C'], '2026-09-10', '2026-09-12', { status: 'cancelled' })]), ALL, a)).toBeNull();
    });
  });

  describe('addOutcome', () => {
    const r = res('r1', ['B'], '2026-09-10', '2026-09-12');
    const s = line([r]);
    const R = (id: string) => s.rooms.find(x => x.id === id)!;
    it('aceleași camere, aceleași nopți: nu e nimic de făcut', () => {
      expect(addOutcome(s, ALL, r, [R('B')], '2026-09-10', '2026-09-12')).toEqual({ kind: 'none', ids: [] });
    });
    it('o cameră alăturată pe aceleași nopți se adaugă la rezervare', () => {
      expect(addOutcome(s, ALL, r, [R('C')], '2026-09-10', '2026-09-12')).toEqual({ kind: 'merge', ids: ['C'] });
    });
    it('o cameră mai încolo devine rezervare separată', () => {
      expect(addOutcome(s, ALL, r, [R('D')], '2026-09-10', '2026-09-12')).toEqual({ kind: 'new', ids: ['D'] });
    });
    it('alte nopți înseamnă tot o rezervare nouă', () => {
      expect(addOutcome(s, ALL, r, [R('C')], '2026-09-12', '2026-09-14')).toEqual({ kind: 'new', ids: ['C'] });
    });
  });
});
