// Cât de plină a fost pensiunea, lună de lună. Se socotește pe nopți-cameră: o cameră ocupată o noapte = 1.
import { addDays, diffDays } from './dates';
import { bookableRooms, isActiveRes } from './rules';
import type { AppState } from './types';

export interface MonthRow {
  month: string;        // '2026-09'
  rooms: number;        // câte camere se puteau vinde
  nights: number;       // nopți-cameră disponibile în lună (fără cele blocate)
  blocked: number;      // nopți-cameră scoase din vânzare (reparații)
  sold: number;         // nopți-cameră vândute
  occupancy: number;    // 0–100
  revenue: number;      // lei din nopțile lunii
  adr: number;          // prețul mediu al unei nopți vândute
  revpar: number;       // venit pe cameră disponibilă
  arrivals: number;     // câte rezervări încep în lună
}

export const daysInMonth = (m: string) => { const [y, mm] = m.split('-').map(Number); return new Date(y, mm, 0).getDate(); };
export const monthsOfYear = (year: number) => Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Anul întreg, lună cu lună. Camerele disponibile sunt cele active de acum: programul nu ține minte de când
 * există fiecare cameră, deci lunile dinainte de a o adăuga o socotesc oricum disponibilă.
 */
export function occupancyByMonth(s: AppState, year: number, propId = 'all'): MonthRow[] {
  const ids = new Set(bookableRooms(s, { prop: propId, floor: 'all' }).map(r => r.id));
  const months = monthsOfYear(year);
  const acc = new Map(months.map(m => [m, { sold: 0, blocked: 0, revenue: 0, arrivals: 0 }]));

  for (const r of s.reservations) {
    if (!isActiveRes(r)) continue;
    const mine = r.roomIds.filter(id => ids.has(id));
    if (!mine.length) continue;
    const n = Math.max(1, diffDays(r.checkIn, r.checkOut));
    const block = r.kind === 'block';
    const perNight = block ? 0 : Number(r.total) / (n * r.roomIds.length);
    const start = acc.get(r.checkIn.slice(0, 7));
    if (start && !block) start.arrivals++;
    for (let d = r.checkIn; d < r.checkOut; d = addDays(d, 1)) {
      const a = acc.get(d.slice(0, 7));
      if (!a) continue;
      if (block) a.blocked += mine.length;
      else { a.sold += mine.length; a.revenue += perNight * mine.length; }
    }
  }

  return months.map(month => {
    const a = acc.get(month)!, rooms = ids.size;
    const nights = Math.max(0, rooms * daysInMonth(month) - a.blocked);
    return {
      month, rooms, nights, blocked: a.blocked, sold: a.sold,
      occupancy: nights ? r2((a.sold / nights) * 100) : 0,
      revenue: r2(a.revenue),
      adr: a.sold ? r2(a.revenue / a.sold) : 0,
      revpar: nights ? r2(a.revenue / nights) : 0,
      arrivals: a.arrivals,
    };
  });
}

/** Totalul anului, socotit din rânduri, ca numerele de jos să se potrivească cu cele de sus. */
export function yearTotal(rows: MonthRow[]): MonthRow {
  const sum = (k: 'nights' | 'blocked' | 'sold' | 'revenue' | 'arrivals') => rows.reduce((t, r) => t + r[k], 0);
  const nights = sum('nights'), sold = sum('sold'), revenue = r2(sum('revenue'));
  return {
    month: 'total', rooms: rows[0]?.rooms ?? 0, nights, blocked: sum('blocked'), sold,
    occupancy: nights ? r2((sold / nights) * 100) : 0, revenue,
    adr: sold ? r2(revenue / sold) : 0, revpar: nights ? r2(revenue / nights) : 0, arrivals: sum('arrivals'),
  };
}
