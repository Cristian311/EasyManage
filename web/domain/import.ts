// Importul de rezervări dintr-un tabel (CSV): ce coloane recunoaște, cum citește datele și ce refuză.
// Fără bază de date: primește rândurile și starea, întoarce ce s-ar întâmpla cu fiecare rând.
import type { AppState, Source } from './types';
import { addDays, diffDays, isIsoDate } from './dates';
import { conflictAny, guestName } from './rules';

export interface ImportRow {
  line: number;                 // rândul din fișier, cum îl vede omul în Excel (antetul e rândul 1)
  guest: string; phone: string; rooms: string; roomIds: string[];
  checkIn: string; checkOut: string; pax: number; total: number; advance: number; source: Source; notes: string;
  guestId: string | null;       // oaspete găsit deja în program
  errors: string[];
}

// numele coloanelor, cum le scriu oamenii; fără diacritice și fără majuscule
const HEADERS: Record<string, string[]> = {
  guest: ['oaspete', 'nume', 'client', 'nume oaspete', 'nume si prenume', 'guest', 'name'],
  phone: ['telefon', 'tel', 'phone', 'mobil'],
  rooms: ['camera', 'camere', 'room', 'rooms'],
  checkIn: ['sosire', 'check-in', 'checkin', 'check in', 'de la', 'data sosirii', 'arrival'],
  checkOut: ['plecare', 'check-out', 'checkout', 'check out', 'pana la', 'data plecarii', 'departure'],
  pax: ['persoane', 'pers', 'pax', 'nr persoane', 'adulti'],
  total: ['total', 'total (lei)', 'pret', 'suma', 'valoare', 'price'],
  advance: ['avans', 'incasat', 'incasat (lei)', 'platit', 'paid'],
  source: ['sursa', 'canal', 'source'],
  notes: ['observatii', 'note', 'mentiuni', 'notes'],
};
const SOURCES: Record<string, Source> = {
  direct: 'direct', booking: 'booking', 'booking.com': 'booking', travelminit: 'travelminit', airbnb: 'airbnb',
  telefon: 'phone', phone: 'phone', tel: 'phone', alta: 'other', 'alta sursa': 'other', other: 'other',
};

export const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');

/** 2026-08-14, 14.08.2026, 14/08/2026 sau 14-08-2026 → 2026-08-14; altfel gol. */
export function readDate(v: string): string {
  const s = v.trim();
  if (isIsoDate(s)) return s;
  const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(s);
  if (!m) return '';
  const out = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return isIsoDate(out) ? out : '';
}

/** „1.250,50”, „1250.5”, „1 250 lei” → număr; gol → 0; altceva → NaN. */
export function readNumber(v: string): number {
  let s = v.replace(/lei|ron|\s/gi, '');
  if (!s) return 0;
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');      // virgula e zecimala, punctele sunt mii
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');           // 1.250 = o mie două sute cincizeci
  else s = s.replace(/,/g, '');
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

/** Ce coloană din fișier ține fiecare câmp. */
export function mapHeaders(header: string[]): Partial<Record<keyof typeof HEADERS, number>> {
  const out: Partial<Record<string, number>> = {};
  header.forEach((h, i) => { const p = plain(h); for (const [k, names] of Object.entries(HEADERS)) if (out[k] === undefined && names.includes(p)) out[k] = i; });
  return out;
}

export const REQUIRED: [keyof typeof HEADERS, string][] = [['guest', 'Oaspete'], ['rooms', 'Camera'], ['checkIn', 'Sosire'], ['checkOut', 'Plecare']];

/**
 * Citește rândurile și spune, pentru fiecare, dacă poate intra. Un rând se verifică și față de cele de
 * dinaintea lui din același fișier, nu doar față de ce e deja în program.
 */
export function planImport(table: string[][], s: AppState): { rows: ImportRow[]; problem: string | null } {
  if (table.length < 2) return { rows: [], problem: 'Fișierul nu are rânduri. Prima linie trebuie să fie antetul, iar rezervările vin dedesubt.' };
  const col = mapHeaders(table[0]);
  const missing = REQUIRED.filter(([k]) => col[k] === undefined).map(([, l]) => l);
  if (missing.length) return { rows: [], problem: `Lipsesc coloanele: ${missing.join(', ')}. Descarcă modelul și pune datele în el.` };

  const roomByName = new Map(s.rooms.filter(r => !r.parentId).map(r => [plain(r.name), r]));
  const guestByKey = new Map(s.guests.map(g => [plain(guestName(g)), g]));
  let shadow: AppState = s;      // starea, plus rândurile bune de până acum

  const rows = table.slice(1).map((cells, i): ImportRow => {
    const get = (k: keyof typeof HEADERS) => (col[k] === undefined ? '' : (cells[col[k]!] ?? '').trim());
    const errors: string[] = [];
    const guest = get('guest').replace(/\s+/g, ' ');
    if (!guest) errors.push('lipsește numele oaspetelui');

    const names = get('rooms').split(/[+,&]|\bsi\b/i).map(x => x.trim()).filter(Boolean);
    const found = names.map(n => roomByName.get(plain(n)));
    if (!names.length) errors.push('lipsește camera');
    names.forEach((n, k) => { if (!found[k]) errors.push(`camera „${n}” nu există în program`); else if (!found[k]!.active) errors.push(`camera „${n}” e dezactivată`); });
    const roomIds = [...new Set(found.filter(Boolean).map(r => r!.id))];

    const checkIn = readDate(get('checkIn')), checkOut = readDate(get('checkOut'));
    if (!checkIn) errors.push(`data sosirii „${get('checkIn')}” nu e o dată (scrie 14.08.2026)`);
    if (!checkOut) errors.push(`data plecării „${get('checkOut')}” nu e o dată`);
    if (checkIn && checkOut && checkOut <= checkIn) errors.push('plecarea trebuie să fie după sosire');
    if (checkIn && checkOut && diffDays(checkIn, checkOut) > 365) errors.push('șederea e mai lungă de un an');

    const pax = get('pax') ? readNumber(get('pax')) : 1, total = readNumber(get('total')), advance = readNumber(get('advance'));
    if (!Number.isInteger(pax) || pax < 1) errors.push(`numărul de persoane „${get('pax')}” nu e valid`);
    if (Number.isNaN(total) || total < 0) errors.push(`totalul „${get('total')}” nu e un număr`);
    if (Number.isNaN(advance) || advance < 0) errors.push(`avansul „${get('advance')}” nu e un număr`);
    else if (!Number.isNaN(total) && advance > total) errors.push('avansul e mai mare decât totalul');

    const srcText = plain(get('source'));
    const source = srcText ? SOURCES[srcText] : 'direct';
    if (!source) errors.push(`sursa „${get('source')}” nu e cunoscută (direct, booking, airbnb, travelminit, telefon, alta)`);

    if (!errors.length) {
      const c = conflictAny(shadow, roomIds, checkIn, checkOut);
      if (c) {
        const who = guestName(shadow.guests.find(g => g.id === c.guestId)) || 'altă rezervare';
        errors.push(`camera e ocupată de ${who} (${c.checkIn} – ${c.checkOut})`);
      }
    }
    const row: ImportRow = {
      line: i + 2, guest, phone: get('phone'), rooms: names.join(' + '), roomIds, checkIn, checkOut,
      pax: Number.isInteger(pax) ? pax : 1, total: Number.isNaN(total) ? 0 : total, advance: Number.isNaN(advance) ? 0 : advance,
      source: source ?? 'direct', notes: get('notes').slice(0, 2000), guestId: guestByKey.get(plain(guest))?.id ?? null, errors,
    };
    if (!errors.length) {
      shadow = { ...shadow, reservations: [...shadow.reservations, {
        id: `import_${i}`, guestId: row.guestId ?? `nou_${i}`, roomIds, checkIn, checkOut, pax: row.pax, total: row.total, source: row.source,
        status: 'confirmed', notes: '', invoiceNo: '', invoiceDate: null, payments: [], createdAt: '',
      }], guests: row.guestId ? shadow.guests : [...shadow.guests, { id: `nou_${i}`, firstName: guest, lastName: '', phone: '', email: '', country: '', notes: '' }] };
    }
    return row;
  });
  return { rows, problem: null };
}

/** Modelul de descărcat: antetul și două rânduri de exemplu. */
export const sampleCsv = (room = '101', today = '2026-09-01') => [
  'Oaspete;Telefon;Camera;Sosire;Plecare;Persoane;Total;Avans;Sursa;Observatii',
  `Ion Popescu;0722 123 456;${room};${fmt(addDays(today, 10))};${fmt(addDays(today, 13))};2;750;200;Telefon;Vine seara târziu`,
  `Maria Ionescu;;${room};${fmt(addDays(today, 13))};${fmt(addDays(today, 15))};2;500;;Booking;`,
].join('\r\n') + '\r\n';
const fmt = (iso: string) => iso.split('-').reverse().join('.');
