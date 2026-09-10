// Business rules, pure functions over the data. The same code runs in the browser (instant feedback)
// and on the server (the final word, together with the database constraint).
import type { AppState, Guest, PayStatus, Property, Reservation, Room, ViewFilter } from './types';
import { addDays, diffDays, fmtD, isIsoDate, money } from './dates';
import { SRC, STATUS } from './labels';

export const roomById = (s: AppState, id: string) => s.rooms.find(r => r.id === id);
export const guestById = (s: AppState, id: string) => s.guests.find(g => g.id === id);
export const propById = (s: AppState, id: string | null) => s.properties.find(p => p.id === id);
export const floorById = (s: AppState, id: string | null) => s.floors.find(f => f.id === id);
export const guestName = (g?: Guest) => (g ? `${g.firstName} ${g.lastName}`.trim() : '—');
export const resGuest = (s: AppState, r: Reservation) => guestName(guestById(s, r.guestId));
export const roomLabel = (s: AppState, r: Reservation) => r.roomIds.map(id => roomById(s, id)?.name || '—').join(' + ');

export const paid = (r: Reservation) => r.payments.reduce((t, p) => t + Number(p.amount || 0), 0);
export const remaining = (r: Reservation) => Math.max(0, Number(r.total) - paid(r));
export const nights = (r: Reservation) => diffDays(r.checkIn, r.checkOut);
export const payStatus = (r: Reservation): PayStatus => { const p = paid(r); return p <= 0 ? 'unpaid' : p >= Number(r.total) ? 'paid' : 'partial'; };
export const isActiveRes = (r: Reservation) => r.status !== 'cancelled';

/** Price of one room for one night: the special price if there is one, otherwise the base price. */
export const rateFor = (s: AppState, roomId: string, d: string) => s.rates[roomId]?.[d] ?? roomById(s, roomId)?.price ?? 0;
/** Price of a stay: every room, every night from a (inclusive) to b (exclusive). */
export function stayPrice(s: AppState, ids: string[], a: string, b: string) {
  let t = 0;
  for (let d = a; d < b; d = addDays(d, 1)) ids.forEach(id => { t += rateFor(s, id, d); });
  return t;
}

/** Double booking: two active stays overlap when a.in < b.out and b.in < a.out. Back-to-back is fine. */
export function conflict(s: AppState, roomId: string, checkIn: string, checkOut: string, exceptId: string | null = null) {
  return s.reservations.find(r => r.id !== exceptId && isActiveRes(r) && r.roomIds.includes(roomId) && checkIn < r.checkOut && r.checkIn < checkOut) ?? null;
}
export function conflictAny(s: AppState, roomIds: string[], checkIn: string, checkOut: string, exceptId: string | null = null) {
  for (const id of roomIds) { const c = conflict(s, id, checkIn, checkOut, exceptId); if (c) return c; }
  return null;
}

/** Alerts shown on the block: the receptionist should see these without opening anything. */
export function alertFor(r: Reservation, today: string, hour = new Date().getHours()) {
  if (!isActiveRes(r)) return null;
  const notIn = r.status === 'confirmed' || r.status === 'pending';
  if (notIn && r.checkIn <= today && r.checkOut > today)
    return { level: 'warn' as const, text: r.checkIn < today ? `Trebuia să sosească pe ${fmtD(r.checkIn)} și nu e cazat` : hour >= 14 ? 'A trecut ora de check-in (14:00) și nu e cazat' : 'Sosește azi, încă nu e cazat' };
  if (r.status === 'checked_in' && r.checkOut < today) return { level: 'bad' as const, text: `Trebuia să plece pe ${fmtD(r.checkOut)}` };
  if (r.checkOut === today && r.status !== 'checked_out' && remaining(r) > 0) return { level: 'bad' as const, text: `Pleacă azi cu rest de plată ${money(remaining(r))}` };
  return null;
}

/** The one-click action available on the block today. */
export function quickAction(r: Reservation, today: string) {
  if (!isActiveRes(r)) return null;
  if ((r.status === 'confirmed' || r.status === 'pending') && r.checkIn <= today && r.checkOut > today) return { label: 'Cazează', status: 'checked_in' as const, cls: '' };
  if (r.status === 'checked_in' && r.checkOut <= today) return { label: 'Pleacă', status: 'checked_out' as const, cls: 'leave' };
  return null;
}

/** Top-level rooms in display order: property, then floor (rooms without a floor last), then manual order. */
export function orderedTops(s: AppState) {
  const pIdx = new Map(s.properties.map((x, i) => [x.id, i])), fIdx = new Map(s.floors.map((x, i) => [x.id, i]));
  return s.rooms.filter(r => !r.parentId).map((r, i) => ({ r, i }))
    .sort((a, b) => (pIdx.get(a.r.propertyId) ?? 99) - (pIdx.get(b.r.propertyId) ?? 99)
      || (fIdx.get(a.r.floorId ?? '') ?? 999) - (fIdx.get(b.r.floorId ?? '') ?? 999) || a.i - b.i)
    .map(x => x.r);
}
export interface Column { room: Room; parent: Room | null; pos: '' | 'unit-first' | 'unit-mid' | 'unit-last' }
/** Calendar columns: the filtered rooms; a split room contributes its units instead of itself. */
export function columns(s: AppState, v: ViewFilter): Column[] {
  const out: Column[] = [];
  orderedTops(s).filter(r => (v.prop === 'all' || r.propertyId === v.prop) && (v.floor === 'all' || r.floorId === v.floor)).forEach(p => {
    const units = s.rooms.filter(u => u.parentId === p.id);
    if (units.length) units.forEach((u, i) => out.push({ room: u, parent: p, pos: i === 0 ? 'unit-first' : i === units.length - 1 ? 'unit-last' : 'unit-mid' }));
    else out.push({ room: p, parent: null, pos: '' });
  });
  return out;
}
export const bookableRooms = (s: AppState, v: ViewFilter) => columns(s, v).map(c => c.room).filter(r => r.active);

/** "Vila Duduleanu" -> "Duduleanu", for tight places. */
export function shortProp(p?: Property) {
  if (!p) return '';
  const w = p.name.trim().split(/\s+/);
  return w.length > 1 && /^(vila|pensiunea|casa|hotel|cabana)$/i.test(w[0]) ? w.slice(1).join(' ') : w[0];
}

export interface ReservationFields { roomIds: string[]; checkIn: string; checkOut: string; pax: number; total: number; source: string; status: string }
/** Checks that do not need the database. Returns the message for the receptionist, or null when all is fine. */
export function validateReservation(x: ReservationFields): string | null {
  if (!x.roomIds.length) return 'Alege cel puțin o cameră.';
  if (new Set(x.roomIds).size !== x.roomIds.length) return 'O cameră apare de două ori în rezervare.';
  if (!isIsoDate(x.checkIn) || !isIsoDate(x.checkOut)) return 'Datele de check-in și check-out nu sunt valide.';
  if (x.checkOut <= x.checkIn) return 'Check-out trebuie să fie după check-in.';
  if (diffDays(x.checkIn, x.checkOut) > 366) return 'O rezervare poate avea cel mult 366 de nopți.';
  if (!Number.isInteger(x.pax) || x.pax < 1 || x.pax > 99) return 'Numărul de persoane nu este valid.';
  if (!Number.isFinite(x.total) || x.total < 0) return 'Prețul total nu este valid.';
  if (!(x.source in SRC)) return 'Sursa rezervării nu este validă.';
  if (!(x.status in STATUS)) return 'Statusul rezervării nu este valid.';
  return null;
}
