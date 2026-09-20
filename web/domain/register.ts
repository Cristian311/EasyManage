// Fișa de cazare și registrul turiștilor: ce rânduri intră și cum se scrie actul. Fără bază de date, fără interfață.
import type { AppState, Guest } from './types';
import { diffDays } from './dates';
import { guestById, guestName, roomLabel } from './rules';

const SHORT: Record<string, string> = { 'Carte de identitate': 'CI', 'Pașaport': 'Pașaport', 'Permis de conducere': 'Permis' };

/** „CI VX 123456”, sau gol dacă actul nu a fost trecut. */
export const idDoc = (g?: Guest) => (g?.idNumber ? [SHORT[g.idType ?? ''] ?? g.idType, g.idSeries, g.idNumber].filter(Boolean).join(' ') : '');

/** Ce îi mai lipsește oaspetelui ca fișa să fie completă. */
export function missingForForm(g?: Guest): string[] {
  if (!g) return ['oaspetele'];
  const out: string[] = [];
  if (!g.idNumber) out.push('actul de identitate');
  if (!g.birthDate) out.push('data nașterii');
  if (!g.citizenship) out.push('cetățenia');
  if (!g.address) out.push('domiciliul');
  return out;
}

/** Rândul tehnic care ține locul oaspetelui la camerele blocate; nu e o persoană. */
export const BLOCK_GUEST = 'g_blocat';

export interface RegisterRow {
  no: number; reservationId: string; name: string; doc: string; citizenship: string; address: string;
  checkIn: string; checkOut: string; nights: number; rooms: string; pax: number;
}

/** Sosirile dintr-o perioadă (capetele incluse), fără rezervările anulate, în ordinea sosirii. */
export function registerRows(s: AppState, from: string, to: string): RegisterRow[] {
  const [a, b] = from <= to ? [from, to] : [to, from];
  return s.reservations
    .filter(r => r.status !== 'cancelled' && r.kind !== 'block' && r.checkIn >= a && r.checkIn <= b)
    .sort((x, y) => x.checkIn.localeCompare(y.checkIn) || x.id.localeCompare(y.id))
    .map((r, i) => {
      const g = guestById(s, r.guestId);
      return {
        no: i + 1, reservationId: r.id, name: guestName(g), doc: idDoc(g), citizenship: g?.citizenship ?? '', address: g?.address ?? '',
        checkIn: r.checkIn, checkOut: r.checkOut, nights: diffDays(r.checkIn, r.checkOut), rooms: roomLabel(s, r), pax: r.pax,
      };
    });
}
