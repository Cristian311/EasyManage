// Mesajul de confirmare pentru oaspete și linkurile care îl deschid în WhatsApp sau în programul de email.
// Nimic nu se trimite de pe server: se deschide aplicația omului, cu textul gata scris, iar el apasă „Trimite”.
import type { AppState, Reservation } from './types';
import { fmtLong, lei2 } from './invoice';
import { guestById, nights, paid, propById, remaining, roomById, roomLabel } from './rules';

export const DEFAULT_TEMPLATE = `Bună ziua, {prenume}!

Vă confirmăm rezervarea la {pensiune}:
• sosire: {sosire}
• plecare: {plecare} ({nopti})
• cameră: {camere}, {persoane}
• total: {total}{avans}

Vă așteptăm cu drag!`;

export const PLACEHOLDERS: [string, string][] = [
  ['{prenume}', 'prenumele oaspetelui'], ['{nume}', 'numele întreg'], ['{pensiune}', 'numele pensiunii'],
  ['{sosire}', 'data sosirii'], ['{plecare}', 'data plecării'], ['{nopti}', '„3 nopți”'], ['{camere}', 'camera sau camerele'],
  ['{persoane}', '„2 persoane”'], ['{total}', 'totalul'], ['{avans}', 'avansul și restul, dacă s-a plătit ceva'], ['{rest}', 'restul de plată'],
];

/** Valorile care intră în șablon pentru o rezervare. */
export function messageVars(s: AppState, r: Reservation, sender: string): Record<string, string> {
  const g = guestById(s, r.guestId), n = nights(r), p = paid(r), rest = remaining(r);
  const prop = propById(s, roomById(s, r.roomIds[0])?.propertyId ?? null);
  return {
    prenume: g?.firstName ?? '', nume: g ? `${g.firstName} ${g.lastName}`.trim() : '',
    pensiune: sender.trim() || prop?.name || 'pensiunea noastră',
    sosire: fmtLong(r.checkIn), plecare: fmtLong(r.checkOut),
    nopti: `${n} ${n === 1 ? 'noapte' : 'nopți'}`,
    camere: roomLabel(s, r), persoane: `${r.pax} ${r.pax === 1 ? 'persoană' : 'persoane'}`,
    total: lei2(Number(r.total)), rest: lei2(rest),
    avans: p > 0 ? `\n• avans primit: ${lei2(p)}, rest de plată: ${lei2(rest)}` : '',
  };
}

/** Pune valorile în șablon. Ce nu cunoaște lasă cum e, ca greșeala de tipar să se vadă. */
export const fillTemplate = (tpl: string, vars: Record<string, string>) =>
  tpl.replace(/\{([a-zăâîșț_]+)\}/gi, (m, k: string) => (k.toLowerCase() in vars ? vars[k.toLowerCase()] : m));

/**
 * Numărul așa cum îl vrea WhatsApp: numai cifre, cu prefixul țării. „0722 123 456” devine 40722123456.
 * Întoarce gol dacă nu seamănă a număr de telefon.
 */
export function waPhone(phone: string): string {
  let d = phone.replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '4' + d;            // număr românesc scris de la 0
  d = d.replace(/\D/g, '');
  return d.length >= 9 && d.length <= 15 ? d : '';
}

export const waLink = (phone: string, text: string) => { const p = waPhone(phone); return p ? `https://wa.me/${p}?text=${encodeURIComponent(text)}` : ''; };
export const mailLink = (email: string, subject: string, body: string) =>
  (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) ? `mailto:${email.trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : '');
