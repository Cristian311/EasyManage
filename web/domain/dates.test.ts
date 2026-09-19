// Datele sunt text 'YYYY-MM-DD' în ora locală. Aici verificăm că aritmetica ține la capete de lună,
// la ani bisecți și la schimbarea orei, fiindcă de ele atârnă toate celelalte calcule.
import { describe, expect, it } from 'vitest';
import { addDays, diffDays, fmtD, fmtDL, fromIso, iso, isIsoDate, isWkNight, lei, money, pad, todayIso } from './dates';

/** Node scrie uneori separatorul de mii ca spațiu îngust; pentru comparație îl aducem la spațiu normal. */
const norm = (s: string) => s.replace(/[  ]/g, ' ');

describe('pad, iso, fromIso', () => {
  it('completează cu zero', () => expect([pad(1), pad(9), pad(10)]).toEqual(['01', '09', '10']));
  it('face dus-întors fără să piardă ziua', () => expect(iso(fromIso('2026-09-10'))).toBe('2026-09-10'));
  it('citește data ca miezul nopții local, nu UTC', () => {
    const d = fromIso('2026-09-10');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 8, 10, 0]);
  });
});

describe('addDays', () => {
  it('trece peste sfârșitul lunii', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');       // 2026 nu e bisect
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');       // 2028 e bisect
  });
  it('trece peste sfârșitul anului, în ambele sensuri', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
  it('cu 0 lasă data neschimbată', () => expect(addDays('2026-09-10', 0)).toBe('2026-09-10'));
  it('nu se pierde la schimbarea orei', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');       // noaptea în care se dă ora înainte
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');       // noaptea în care se dă ora înapoi
  });
});

describe('diffDays', () => {
  it('numără nopțile dintre două date', () => expect(diffDays('2026-09-10', '2026-09-12')).toBe(2));
  it('e 0 pentru aceeași zi și negativ înapoi', () => {
    expect(diffDays('2026-09-10', '2026-09-10')).toBe(0);
    expect(diffDays('2026-09-12', '2026-09-10')).toBe(-2);
  });
  it('trece corect peste 29 februarie și peste schimbarea orei', () => {
    expect(diffDays('2028-02-28', '2028-03-01')).toBe(2);
    expect(diffDays('2026-03-28', '2026-03-30')).toBe(2);
    expect(diffDays('2026-10-24', '2026-10-26')).toBe(2);
  });
  it('un an întreg are 365 de zile, unul bisect 366', () => {
    expect(diffDays('2026-01-01', '2027-01-01')).toBe(365);
    expect(diffDays('2028-01-01', '2029-01-01')).toBe(366);
  });
});

describe('isIsoDate', () => {
  it('acceptă o dată reală', () => expect(isIsoDate('2026-09-10')).toBe(true));
  it('respinge o zi care nu există', () => {
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('2026-00-10')).toBe(false);
  });
  it('respinge alt format sau altceva decât text', () => {
    for (const x of ['2026-9-10', '10-09-2026', '2026/09/10', '2026-09-10T00:00:00', '', ' 2026-09-10', 20260910, null, undefined, {}])
      expect(isIsoDate(x)).toBe(false);
  });
  it('todayIso dă o dată validă', () => expect(isIsoDate(todayIso())).toBe(true));
});

describe('afișare', () => {
  it('scrie ziua pe scurt și pe lung, în română', () => {
    expect(fmtD('2026-09-10')).toBe('10 sep');
    expect(fmtDL('2026-09-10')).toBe('Joi, 10 sep 2026');
  });
  it('scrie sumele cu separator de mii', () => {
    expect(norm(money(1234))).toBe('1.234 RON');
    expect(norm(money(0))).toBe('0 RON');
    expect(norm(money(1234.5))).toBe('1.234,5 RON');
    expect(norm(money(1234.567))).toBe('1.234,57 RON');
    expect(norm(lei(1234.6))).toBe('1.235');
  });
});

describe('isWkNight', () => {
  it('doar vineri și sâmbătă sunt nopți de weekend', () => {
    expect(isWkNight('2026-09-11')).toBe(true);    // vineri
    expect(isWkNight('2026-09-12')).toBe(true);    // sâmbătă
    expect(isWkNight('2026-09-13')).toBe(false);   // duminică
    expect(isWkNight('2026-09-10')).toBe(false);   // joi
  });
});
