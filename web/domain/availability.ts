// „Am loc între 12 și 15 august?” — întrebarea de la telefon, cu răspunsul pe o singură pagină.
import { addDays, diffDays } from './dates';
import { bookableRooms, conflict, floorById, propById, resGuest, stayPrice } from './rules';
import type { AppState, Room } from './types';

export interface FreeRoom { room: Room; property: string; floor: string; price: number; perNight: number }
export interface BusyRoom { room: Room; property: string; guest: string; blocked: boolean; freeFrom: string | null }
export interface Availability { nights: number; free: FreeRoom[]; busy: BusyRoom[]; beds: number }

/** Prima zi din care camera e liberă, căutând înainte de la o dată dată. Null dacă e ocupată cât vedem. */
export function freeFrom(s: AppState, roomId: string, from: string, limit = 120): string | null {
  let d = from;
  for (let i = 0; i < limit; i++) {
    const c = conflict(s, roomId, d, addDays(d, 1));       // o singură noapte
    if (!c) return d;
    d = c.checkOut;
  }
  return null;
}

/**
 * Ce e liber pe toate nopțile din [from, to), cu prețul întregii șederi. O cameră e liberă numai dacă e liberă
 * toate nopțile: dacă e ocupată o singură noapte la mijloc, nu ajută pe cineva care vrea toată perioada.
 */
export function availability(s: AppState, from: string, to: string, propId = 'all', pax = 0): Availability {
  const nights = Math.max(0, diffDays(from, to));
  const free: FreeRoom[] = [], busy: BusyRoom[] = [];
  if (nights <= 0) return { nights: 0, free, busy, beds: 0 };

  for (const room of bookableRooms(s, { prop: propId, floor: 'all' })) {
    const property = propById(s, room.propertyId)?.name ?? '';
    const taken = conflict(s, room.id, from, to);
    if (taken) {
      busy.push({
        room, property, blocked: taken.kind === 'block',
        guest: taken.kind === 'block' ? (taken.notes || 'blocată') : resGuest(s, taken),
        freeFrom: freeFrom(s, room.id, from),
      });
      continue;
    }
    if (pax > 0 && room.capacity < pax) continue;          // prea mică pentru câți vin
    const price = stayPrice(s, [room.id], from, to);
    free.push({ room, property, floor: floorById(s, room.floorId)?.name ?? '', price, perNight: nights ? Math.round((price / nights) * 100) / 100 : 0 });
  }
  return { nights, free, busy, beds: free.reduce((t, f) => t + f.room.capacity, 0) };
}
