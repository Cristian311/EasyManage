// Data for tests: builders that fill in everything a test does not care about, so each test shows
// only what it is actually about.
import type { AppState, Expense, Floor, Guest, Payment, Property, Reservation, Room, ViewFilter } from './types';

/** The calendar with no filter on. */
export const ALL: ViewFilter = { prop: 'all', floor: 'all' };

export const room = (id: string, over: Partial<Room> = {}): Room => ({
  id, propertyId: 'p', floorId: null, parentId: null, name: id, type: 'Dublă', capacity: 2, price: 200, color: '', desc: '', active: true, ...over,
});
export const guest = (id: string, over: Partial<Guest> = {}): Guest => ({
  id, firstName: 'Ana', lastName: 'Pop', phone: '0722 000 000', email: '', country: 'România', notes: '', ...over,
});
export const pay = (amount: number, over: Partial<Payment> = {}): Payment => ({ id: `pay_${amount}`, amount, method: 'cash', date: '2026-09-10', note: '', ...over });
export const res = (id: string, roomIds: string[], checkIn: string, checkOut: string, over: Partial<Reservation> = {}): Reservation => ({
  id, guestId: 'g', roomIds, checkIn, checkOut, pax: 2, total: 400, source: 'direct', status: 'confirmed', notes: '', invoiceNo: '', invoiceDate: null, payments: [], createdAt: '', ...over,
});
export const expense = (over: Partial<Expense> = {}): Expense => ({ id: 'e', propertyId: null, category: 'Altele', desc: '', amount: 100, date: '2026-09-10', recurring: false, until: '', ...over });

/** One villa, room A at 200 lei and room B at 300, one guest. */
export const state = (reservations: Reservation[] = [], over: Partial<AppState> = {}): AppState => ({
  properties: [{ id: 'p', name: 'Vila Unu', city: 'Brașov' }],
  floors: [], rooms: [room('A'), room('B', { price: 300 })], guests: [guest('g')],
  reservations, rates: {}, expenses: [], ...over,
});

/** Two villas with floors, a split room, a deactivated room and one booking: enough to exercise the database. */
export function tinyState(): AppState {
  const properties: Property[] = [{ id: 'p1', name: 'Vila Unu', city: 'Brașov' }, { id: 'p2', name: 'Vila Doi', city: 'Râșnov' }];
  const floors: Floor[] = [{ id: 'f1', propertyId: 'p1', name: 'Parter' }, { id: 'f2', propertyId: 'p1', name: 'Etaj 1' }, { id: 'f3', propertyId: 'p2', name: 'Parter' }];
  const rooms = [
    room('r1', { propertyId: 'p1', floorId: 'f1', name: '101', price: 200 }),
    room('r2', { propertyId: 'p1', floorId: 'f1', name: '102', price: 220 }),
    room('r3', { propertyId: 'p1', floorId: 'f2', name: '201', price: 250 }),
    room('rs', { propertyId: 'p1', floorId: 'f2', name: 'Apartament', type: 'Apartament', capacity: 4, price: 400 }),
    room('ru1', { propertyId: 'p1', floorId: 'f2', name: 'Ap A', parentId: 'rs' }),
    room('ru2', { propertyId: 'p1', floorId: 'f2', name: 'Ap B', parentId: 'rs' }),
    room('r4', { propertyId: 'p2', floorId: 'f3', name: 'P1', price: 180 }),
    room('rx', { propertyId: 'p2', floorId: 'f3', name: 'P2', price: 180, active: false }),
  ];
  const guests = [guest('g1'), guest('g2', { firstName: 'Ion', lastName: 'Rus' })];
  const reservations = [res('res1', ['r1'], '2026-09-10', '2026-09-12', { guestId: 'g1', total: 400, payments: [pay(200)] })];
  return { properties, floors, rooms, guests, reservations, rates: {}, expenses: [] };
}
