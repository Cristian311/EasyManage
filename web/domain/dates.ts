// Dates travel as 'YYYY-MM-DD' strings in local time. A stay is [checkIn, checkOut): the night of checkIn up to
// the morning of checkOut, so one guest can leave and the next arrive in the same room on the same day.

export const pad = (n: number) => String(n).padStart(2, '0');
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromIso = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s: string, n: number) => { const d = fromIso(s); d.setDate(d.getDate() + n); return iso(d); };
export const diffDays = (a: string, b: string) => Math.round((fromIso(b).getTime() - fromIso(a).getTime()) / 86400000);
export const todayIso = () => iso(new Date());
export const isIsoDate = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(fromIso(s)) === s;

export const MONTHS = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec'];
export const MONTHS_L = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];
export const DOWS = ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm'];

export const fmtD = (s: string) => { const d = fromIso(s); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
export const fmtDL = (s: string) => { const d = fromIso(s); return `${DOWS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
/** The heading over a day's rows: "Azi", "Mâine", "Ieri", otherwise the full date. */
export const dayHeading = (s: string, today = todayIso()) => {
  const n = diffDays(today, s);
  return n === 0 ? 'Azi' : n === 1 ? 'Mâine' : n === -1 ? 'Ieri' : fmtDL(s);
};
export const money = (n: number) => (Math.round(n) === n ? n : Number(n.toFixed(2))).toLocaleString('ro-RO') + ' RON';
export const lei = (n: number) => Math.round(n).toLocaleString('ro-RO');

/** Friday and Saturday nights are the weekend nights for pricing. */
export const isWkNight = (d: string) => { const w = fromIso(d).getDay(); return w === 5 || w === 6; };
