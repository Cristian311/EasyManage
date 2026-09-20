// Lista de curățenie a unei zile: ce camere se eliberează, în care vine cineva și unde doar se face ordine.
import type { AppState, Reservation } from './types';
import { bookableRooms, floorById, isActiveRes, isStay, propById, resGuest } from './rules';

export type CleanKind = 'turn' | 'out' | 'in' | 'stay';
export interface CleanRow {
  roomId: string; room: string; type: string; property: string; floor: string; kind: CleanKind;
  leaving: string;                 // cine pleacă azi
  arriving: string; pax: number;   // cine vine azi și câți
  notes: string;                   // observațiile celui care vine, sau ale celui care rămâne
  until: string;                   // până când stă cel care vine sau rămâne
}

/** De la cel mai urgent la cel mai puțin: întâi camerele în care vine cineva după ce pleacă altcineva. */
export const CLEAN_ORDER: CleanKind[] = ['turn', 'out', 'in', 'stay'];
export const CLEAN_L: Record<CleanKind, string> = {
  turn: 'Pleacă și vine altcineva — curățenie completă, întâi aici',
  out: 'Pleacă — curățenie completă',
  in: 'Vine — verifică să fie gata',
  stay: 'Rămâne — ordine, la cerere',
};

export function cleaningList(s: AppState, day: string, propId = 'all'): CleanRow[] {
  const act = s.reservations.filter(r => isActiveRes(r) && isStay(r)), rows: CleanRow[] = [];
  for (const rm of bookableRooms(s, { prop: propId, floor: 'all' })) {
    const on = (f: (r: Reservation) => boolean) => act.find(r => r.roomIds.includes(rm.id) && f(r));
    const out = on(r => r.checkOut === day), inn = on(r => r.checkIn === day), stay = on(r => r.checkIn < day && r.checkOut > day);
    const kind: CleanKind | null = out && inn ? 'turn' : out ? 'out' : inn ? 'in' : stay ? 'stay' : null;
    if (!kind) continue;
    const next = inn ?? stay;
    rows.push({
      roomId: rm.id, room: rm.name, type: rm.type, property: propById(s, rm.propertyId)?.name ?? '', floor: floorById(s, rm.floorId)?.name ?? '', kind,
      leaving: out ? resGuest(s, out) : '', arriving: inn ? resGuest(s, inn) : '', pax: next?.pax ?? 0, notes: next && !next.notes.startsWith('Adusă automat') ? next.notes : '', until: next?.checkOut ?? '',
    });
  }
  return rows.sort((a, b) => CLEAN_ORDER.indexOf(a.kind) - CLEAN_ORDER.indexOf(b.kind));   // sort stabil: în grup rămâne ordinea camerelor
}
