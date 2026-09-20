import { describe, expect, it } from 'vitest';
import { icsGuestName, parseIcs } from './ical';

const cal = (body: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//test//\r\n${body}END:VCALENDAR\r\n`;
const ev = (lines: string[]) => `BEGIN:VEVENT\r\n${lines.join('\r\n')}\r\nEND:VEVENT\r\n`;

describe('parseIcs', () => {
  it('citește evenimentele pe zile întregi, cum le dau Booking și Airbnb', () => {
    const out = parseIcs(cal(ev(['DTSTART;VALUE=DATE:20300110', 'DTEND;VALUE=DATE:20300113', 'UID:abc@booking.com', 'SUMMARY:CLOSED - Not available'])
      + ev(['UID:x2', 'SUMMARY:Reserved', 'DTEND;VALUE=DATE:20300202', 'DTSTART;VALUE=DATE:20300201'])));
    expect(out).toEqual([
      { uid: 'abc@booking.com', start: '2030-01-10', end: '2030-01-13', summary: 'CLOSED - Not available' },
      { uid: 'x2', start: '2030-02-01', end: '2030-02-02', summary: 'Reserved' },
    ]);
  });
  it('ia ziua și din datele cu oră, lipește rândurile rupte și scoate barele din text', () => {
    const [e] = parseIcs(cal(ev(['DTSTART:20300110T140000Z', 'DTEND;TZID=Europe/Bucharest:20300112T110000', 'UID:lung', 'SUMMARY:Popescu\\, Ion\r\n  si familia'])));
    expect(e).toEqual({ uid: 'lung', start: '2030-01-10', end: '2030-01-12', summary: 'Popescu, Ion si familia' });
  });
  it('fără sfârșit, sau cu sfârșitul înaintea începutului, e o singură noapte; fără UID primește unul din date', () => {
    const out = parseIcs(cal(ev(['DTSTART;VALUE=DATE:20300110']) + ev(['DTSTART;VALUE=DATE:20300110', 'DTEND;VALUE=DATE:20300105', 'UID:u'])));
    expect(out.map(e => [e.uid, e.start, e.end])).toEqual([['2030-01-10_2030-01-11', '2030-01-10', '2030-01-11'], ['u', '2030-01-10', '2030-01-11']]);
  });
  it('sare peste evenimentele fără dată bună și merge și cu rânduri terminate doar cu \\n', () => {
    expect(parseIcs('BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:a\nDTSTART:prostii\nEND:VEVENT\nBEGIN:VEVENT\nUID:b\nDTSTART:20301301\nEND:VEVENT\nEND:VCALENDAR')).toEqual([]);
    expect(parseIcs(cal(''))).toEqual([]);
  });
  it('o pagină de eroare nu e un calendar gol', () => {
    expect(() => parseIcs('<html>404 Not Found</html>')).toThrow(/nu duce la un calendar/);
  });
});

describe('icsGuestName', () => {
  it('textele generice ale site-urilor devin „Rezervare <site>”, un nume adevărat rămâne', () => {
    expect(icsGuestName('CLOSED - Not available', 'Booking.com')).toBe('Rezervare Booking.com');
    expect(icsGuestName('Reserved', 'Airbnb')).toBe('Rezervare Airbnb');
    expect(icsGuestName('', 'Airbnb')).toBe('Rezervare Airbnb');
    expect(icsGuestName('  Ion   Popescu ', 'Booking.com')).toBe('Ion Popescu');
  });
});
