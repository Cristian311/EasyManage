// Graficele sunt doar text SVG. Aici verificăm că nu scapă text nescăpat în pagină, că scara e citibilă
// și că nu crapă pe o lună goală.
import { describe, expect, it } from 'vitest';
import { drawDaily, drawMonthly, drawOcc, drawSrc, esc, kfmt, type Money, type Tips } from './charts';

const M: Money = { lei: v => `${Math.round(v)} RON`, k: 1, unit: '' };
const norm = (s: string) => s.replace(/[  ]/g, ' ');

describe('esc', () => {
  it('scapă caracterele care ar rupe SVG-ul', () => {
    expect(esc('<b>"Vila" & \'co\'</b>')).toBe('&lt;b&gt;&quot;Vila&quot; &amp; &#39;co&#39;&lt;/b&gt;');
  });
  it('null și undefined devin text gol', () => expect([esc(null), esc(undefined)]).toEqual(['', '']));
});

describe('kfmt', () => {
  it('scrie sumele scurt pe axă', () => {
    expect(kfmt(0)).toBe('0');
    expect(kfmt(999)).toBe('999');
    expect(kfmt(1000)).toBe('1k');
    expect(kfmt(12400)).toBe('12k');
    expect(norm(kfmt(1_500_000))).toBe('1,5 mil');
  });
});

describe('drawMonthly', () => {
  const data = [{ m: '2026-08', cashed: 12000, spent: 5000, profit: 6000 }, { m: '2026-09', cashed: 9000, spent: 4000, profit: 4500 }];
  it('desenează câte o pereche de coloane și un indiciu pe lună', () => {
    const tips: Tips = [];
    const svg = drawMonthly(600, data, '2026-09', M, tips);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(tips).toHaveLength(2);
    expect(tips[0]).toContain('August 2026');
    expect(svg).toContain('data-m="2026-09"');
    expect((svg.match(/class="vz-s1"/g) ?? [])).toHaveLength(2);
  });
  it('marchează luna curentă', () => {
    const svg = drawMonthly(600, data, '2026-09', M, []);
    expect(svg).toContain('class="vz-x cur">Sep');
    expect(svg).toContain('class="vz-x ">Aug');
  });
  it('nu crapă fără date', () => expect(drawMonthly(600, [], '2026-09', M, []).startsWith('<svg')).toBe(true));
});

describe('drawDaily', () => {
  const pays = [{ pm: { date: '2026-09-03', amount: 500 } }, { pm: { date: '2026-09-03', amount: 250 } }, { pm: { date: '2026-10-01', amount: 999 } }];
  it('are câte un indiciu pentru fiecare zi a lunii și adună plățile zilei', () => {
    const tips: Tips = [];
    const svg = drawDaily(600, '2026-09', pays, '2026-09-15', M, tips);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(tips).toHaveLength(30);
    expect(tips[2]).toContain('750 RON');      // 3 septembrie: 500 + 250
    expect(tips[2]).toContain('2 plăți');
    expect(tips[0]).toContain('0 RON');
  });
  it('nu numără plățile din altă lună', () => {
    const tips: Tips = [];
    drawDaily(600, '2026-09', pays, '2026-09-15', M, tips);
    expect(tips.filter(t => t.includes('999 RON'))).toHaveLength(0);
  });
  it('o încasare așteptată după ziua de azi e desenată altfel decât una făcută', () => {
    const viitor = [{ pm: { date: '2026-09-20', amount: 400 } }];
    expect(drawDaily(600, '2026-09', viitor, '2026-09-15', M, [])).toContain('vz-s1 fut');
    expect(drawDaily(600, '2026-09', viitor, '2026-09-30', M, [])).not.toContain('vz-s1 fut');
  });
  it('o lună fără plăți nu crapă', () => expect(drawDaily(600, '2026-09', [], '2026-09-15', M, []).startsWith('<svg')).toBe(true));
});

describe('drawOcc', () => {
  it('întoarce și punctele, ca pagina să poată urmări cursorul', () => {
    const { html, data } = drawOcc(600, { a: '2026-09-01', n: 30, rooms: 4, used: Array(30).fill(2) });
    expect(html.startsWith('<svg')).toBe(true);
    expect(data.pts).toHaveLength(30);
    expect(data.step).toBeCloseTo((600 - 52 - 14) / 29, 6);
    expect(data.pts[0][0]).toBe(52);                 // marginea din stânga
    expect(data.pts[0][1]).toBeCloseTo(109, 6);      // jumătate de ocupare, la mijlocul înălțimii
  });
  it('fără camere, linia stă pe zero în loc să împartă la zero', () => {
    const { data } = drawOcc(600, { a: '2026-09-01', n: 5, rooms: 0, used: [0, 0, 0, 0, 0] });
    expect(data.pts.every(p => p[1] === 202)).toBe(true);
    expect(data.pts.every(p => Number.isFinite(p[1]))).toBe(true);
  });
  it('ocuparea peste cap nu trece de 100%', () => {
    const { data } = drawOcc(600, { a: '2026-09-01', n: 2, rooms: 2, used: [5, 2] });
    expect(data.pts[0][1]).toBe(data.pts[1][1]);
  });
});

describe('drawSrc', () => {
  const bySrc = { direct: { res: 3, n: 9, v: 3000 }, booking: { res: 5, n: 12, v: 7000 } };
  it('pune sursele în ordinea banilor aduși', () => {
    const tips: Tips = [];
    const svg = drawSrc(600, bySrc, M, tips);
    expect(svg.indexOf('Booking.com')).toBeLessThan(svg.indexOf('Direct'));
    expect(tips).toHaveLength(2);
    expect(tips[0]).toContain('5 rezervări · 12 nopți');
  });
  it('arată comisionul acolo unde există', () => {
    const tips: Tips = [];
    drawSrc(600, bySrc, M, tips);
    expect(tips[0]).toContain('Comision estimat');      // Booking
    expect(tips[1]).not.toContain('Comision estimat');  // Direct
  });
  it('o lună fără nopți vândute spune asta, nu desenează un grafic gol', () => {
    expect(drawSrc(600, {}, M, [])).toContain('Nicio noapte vândută');
  });
});
