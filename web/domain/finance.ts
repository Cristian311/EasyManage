// Money for one month: what came in, what went out, what is left. Pure functions over the data.
import type { AppState, Expense, Method, Reservation, Source } from './types';
import { addDays, diffDays, iso, pad, MONTHS_L } from './dates';
import { nights, remaining, roomById } from './rules';

/** Estimated platform commission, taken off the price of the stay. */
export const COMM: Partial<Record<Source, number>> = { booking: .15, travelminit: .12, airbnb: .03 };
export const EXP_CATS = ['Salarii', 'Utilități', 'Curățenie', 'Întreținere și reparații', 'Consumabile', 'Comisioane', 'Taxe și impozite', 'Marketing', 'Altele'];

export const monthName = (m: string) => { const [y, mo] = m.split('-').map(Number); return `${MONTHS_L[mo - 1]} ${y}`; };
export const addMonths = (m: string, k: number) => { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1 + k, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
export const monthEnd = (m: string) => { const [y, mo] = m.split('-').map(Number); return iso(new Date(y, mo, 0)); };
const resProp = (s: AppState, r: Reservation) => roomById(s, r.roomIds[0])?.propertyId;

/** Expenses that count in a month: dated ones inside it, recurring ones from their start until they are stopped. */
export function expensesIn(s: AppState, m: string, prop: string): Expense[] {
  const a = m + '-01', b = monthEnd(m);
  return s.expenses.filter(e => (prop === 'all' || e.propertyId === prop) && (e.recurring ? e.date <= b && (!e.until || e.until >= a) : e.date >= a && e.date <= b));
}

export interface MonthFin {
  earned: number; cashed: number; spent: number; comm: number; profit: number; outstanding: number; occ: number; roomNights: number;
  bySrc: Partial<Record<Source, { res: number; n: number; v: number }>>; byMethod: Partial<Record<Method, number>>;
  pays: { r: Reservation; pm: Reservation['payments'][number] }[]; exps: Expense[];
}
export function finMonth(s: AppState, m: string, prop: string): MonthFin {
  const a = m + '-01', b = addDays(monthEnd(m), 1), days = diffDays(a, b);
  const rooms = s.rooms.filter(r => r.active && !s.rooms.some(u => u.parentId === r.id) && (prop === 'all' || r.propertyId === prop));
  let earned = 0, roomNights = 0, comm = 0, cashed = 0, outstanding = 0;
  const bySrc: MonthFin['bySrc'] = {}, byMethod: MonthFin['byMethod'] = {}, pays: MonthFin['pays'] = [];
  s.reservations.forEach(r => {
    if (prop !== 'all' && resProp(s, r) !== prop) return;
    r.payments.forEach(pm => { if (pm.date >= a && pm.date < b) { pays.push({ r, pm }); cashed += Number(pm.amount); byMethod[pm.method] = (byMethod[pm.method] || 0) + Number(pm.amount); } });
    if (r.status === 'cancelled') return;
    // the nights of this month, as a share of the whole stay
    const s0 = r.checkIn > a ? r.checkIn : a, s1 = r.checkOut < b ? r.checkOut : b, n = diffDays(s0, s1);
    if (n > 0) {
      const share = Number(r.total) * n / nights(r), k = r.roomIds.length;
      earned += share; roomNights += n * k; comm += share * (COMM[r.source] || 0);
      const x = (bySrc[r.source] ??= { res: 0, n: 0, v: 0 }); x.res++; x.n += n * k; x.v += share;
    }
    if (r.checkIn >= a && r.checkIn < b) outstanding += remaining(r);
  });
  const exps = expensesIn(s, m, prop), spent = exps.reduce((t, e) => t + Number(e.amount), 0);
  return { earned, cashed, spent, comm, profit: cashed - spent - comm, outstanding, occ: rooms.length ? roomNights / (rooms.length * days) : 0, roomNights, bySrc, byMethod, pays, exps };
}

/** Rooms in use on each day of the month, for the occupancy line. */
export function occupancyByDay(s: AppState, m: string, prop: string) {
  const a = m + '-01', b = addDays(monthEnd(m), 1), n = diffDays(a, b), used = Array<number>(n).fill(0);
  const rooms = s.rooms.filter(r => r.active && !s.rooms.some(u => u.parentId === r.id) && (prop === 'all' || r.propertyId === prop)).length;
  s.reservations.forEach(r => {
    if (r.status === 'cancelled' || (prop !== 'all' && resProp(s, r) !== prop)) return; const k = r.roomIds.length;
    for (let d = r.checkIn > a ? r.checkIn : a; d < r.checkOut && d < b; d = addDays(d, 1)) used[diffDays(a, d)] += k;
  });
  return { a, n, rooms, used };
}
