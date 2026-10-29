import { describe, expect, it } from 'vitest';
import { guest, res, room, state } from './fixtures';
import { cleaningList } from './housekeeping';

const D = '2026-09-12';
const s = (reservations = [
  res('out', ['A'], '2026-09-10', D, { guestId: 'g' }),
  res('in', ['A'], D, '2026-09-15', { guestId: 'h', pax: 3, notes: 'pat de copil' }),
  res('stay', ['B'], '2026-09-11', '2026-09-14', { guestId: 'g', notes: 'fără pernă de puf' }),
  res('only-in', ['C'], D, '2026-09-13', { guestId: 'h', notes: 'Adusă automat din calendarul Booking.com. Completează numele, persoanele și prețul.' }),
  res('only-out', ['E'], '2026-09-09', D, { guestId: 'g' }),
  res('anulata', ['F'], '2026-09-10', D, { guestId: 'g', status: 'cancelled' }),
  res('alta-zi', ['F'], '2026-09-20', '2026-09-22', { guestId: 'g' }),
]) => state(reservations, {
  rooms: ['A', 'B', 'C', 'E', 'F'].map(id => room(id)).concat(room('Oprita', { active: false })),
  guests: [guest('g'), guest('h', { firstName: 'Ion', lastName: 'Rus' })],
});

describe('cleaningList', () => {
  it('pune întâi camerele în care pleacă cineva și vine altcineva, apoi plecările, sosirile și cei care rămân', () => {
    expect(cleaningList(s(), D).map(r => [r.room, r.kind])).toEqual([['A', 'turn'], ['E', 'out'], ['C', 'in'], ['B', 'stay']]);
  });
  it('spune cine pleacă, cine vine, câți și până când, cu observațiile celui care vine', () => {
    expect(cleaningList(s(), D)[0]).toMatchObject({ room: 'A', leaving: 'Ana Pop', arriving: 'Ion Rus', pax: 3, notes: 'pat de copil', until: '2026-09-15', property: 'Vila Unu' });
    expect(cleaningList(s(), D).find(r => r.room === 'B')).toMatchObject({ leaving: '', arriving: '', notes: 'fără pernă de puf', until: '2026-09-14' });
  });
  it('nota pusă automat la rezervările venite de pe site nu ajunge pe foaia menajerei', () => {
    expect(cleaningList(s(), D).find(r => r.room === 'C')!.notes).toBe('');
  });
  it('camerele goale, rezervările anulate și alte zile nu apar; o zi fără nimic dă o listă goală', () => {
    expect(cleaningList(s(), D).some(r => r.room === 'F')).toBe(false);
    expect(cleaningList(s(), '2027-01-01')).toEqual([]);
  });
  it('se poate cere pentru o singură vilă', () => {
    expect(cleaningList(s(), D, 'alta-vila')).toEqual([]);
    expect(cleaningList(s(), D, 'p')).toHaveLength(4);
  });
});
