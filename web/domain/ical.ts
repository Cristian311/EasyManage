// Citirea unui calendar .ics (Booking, Airbnb, Travelminit). Doar ce ne trebuie: evenimentele cu zi de început și de sfârșit.
import { addDays, isIsoDate } from './dates';

export interface IcsEvent { uid: string; start: string; end: string; summary: string }

/** Rândurile lungi sunt rupte și continuate cu un spațiu sau tab la început; le lipim la loc. */
const unfold = (text: string) => text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '');
const unescape = (v: string) => v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();
/** 20260901 sau 20260901T140000Z -> 2026-09-01. Ora nu contează: o noapte începe în ziua sosirii. */
function day(v: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(v.trim());
  const d = m ? `${m[1]}-${m[2]}-${m[3]}` : '';
  return isIsoDate(d) ? d : null;
}

/** Aruncă o eroare dacă textul nu e un calendar, ca o pagină de eroare să nu fie luată drept „nicio rezervare”. */
export function parseIcs(text: string): IcsEvent[] {
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('Linkul nu duce la un calendar (.ics).');
  const out: IcsEvent[] = [];
  let cur: Partial<IcsEvent> | null = null;
  for (const line of unfold(text).split('\n')) {
    const i = line.indexOf(':'); if (i < 0) continue;
    const name = line.slice(0, i).split(';')[0].toUpperCase(), value = line.slice(i + 1);
    if (name === 'BEGIN' && value.toUpperCase() === 'VEVENT') cur = {};
    else if (name === 'END' && value.toUpperCase() === 'VEVENT') {
      if (cur?.start) {
        const end = cur.end && cur.end > cur.start ? cur.end : addDays(cur.start, 1);
        out.push({ uid: (cur.uid || `${cur.start}_${end}`).slice(0, 255), start: cur.start, end, summary: cur.summary ?? '' });
      }
      cur = null;
    } else if (cur) {
      if (name === 'UID') cur.uid = value.trim().replace(/[^\x21-\x7e]/g, '_');
      else if (name === 'DTSTART') cur.start = day(value) ?? undefined;
      else if (name === 'DTEND') cur.end = day(value) ?? undefined;
      else if (name === 'SUMMARY') cur.summary = unescape(value);
    }
  }
  return out;
}

/** Calendarul unei camere, pentru site-uri: doar nopțile ocupate, fără nume și fără bani. */
export function toIcs(events: { uid: string; start: string; end: string }[], calName: string, stampIso: string): string {
  const d = (s: string) => s.replace(/-/g, ''), esc = (s: string) => s.replace(/([,;\\])/g, '\\$1').replace(/\s+/g, ' ');
  const stamp = stampIso.replace(/[-:]/g, '').replace(/\.\d+/, '').replace(/Z?$/, 'Z');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Velora Stay//RO', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(calName)}`,
    ...events.flatMap(e => ['BEGIN:VEVENT', `UID:${e.uid}@velora`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d(e.start)}`, `DTEND;VALUE=DATE:${d(e.end)}`, 'SUMMARY:Ocupat', 'END:VEVENT']),
    'END:VCALENDAR', ''].join('\r\n');
}

/** Numele sub care apare rezervarea la noi: Airbnb și Booking nu dau numele oaspetelui în calendar. */
export function icsGuestName(summary: string, sourceLabel: string): string {
  const s = summary.replace(/\s+/g, ' ').trim();
  const generic = !s || /^(closed|not available|reserved|blocked|unavailable|airbnb|booking)/i.test(s);
  return (generic ? `Rezervare ${sourceLabel}` : s).slice(0, 120);
}
