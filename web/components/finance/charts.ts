// Plain SVG charts as strings: one axis each, a hover target on every mark. Text inside comes through esc().
import type { Source } from '@/domain/types';
import { addDays, diffDays, fmtDL, MONTHS_L } from '@/domain/dates';
import { COMM, monthEnd, monthName } from '@/domain/finance';
import { SRC } from '@/domain/labels';

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export const VZ = { h: 230, pl: 52, pr: 14, pt: 16, pb: 28 };
export type Tips = string[];

export const kfmt = (v: number) => v >= 1e6 ? (v / 1e6).toLocaleString('ro-RO', { maximumFractionDigits: 1 }) + ' mil' : v >= 1000 ? Math.round(v / 1000) + 'k' : String(Math.round(v));
function niceScale(v: number) { if (v <= 0) return { max: 1, ticks: 4 }; const raw = v / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p, st = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p, t = Math.max(2, Math.ceil(v / st)); return { max: st * t, ticks: t }; }
const yOf = (v: number, max: number) => VZ.pt + (VZ.h - VZ.pt - VZ.pb) * (1 - v / max);
function yAxis(W: number, max: number, fmt: (v: number) => string, ticks = 4) {
  let s = ''; for (let i = 0; i <= ticks; i++) { const v = max * i / ticks, y = yOf(v, max);
    s += `<line x1="${VZ.pl}" x2="${W - VZ.pr}" y1="${y}" y2="${y}" class="${i ? 'vz-grid' : 'vz-base'}"/><text x="${VZ.pl - 8}" y="${y + 4}" class="vz-tick" text-anchor="end">${fmt(v)}</text>`; }
  return s;
}
// column: 4px rounded data end, square at the baseline
const col = (x: number, w: number, y: number, base: number, cls: string) => { const h = base - y; if (h <= 0.5) return ''; const r = Math.min(4, h, w / 2);
  return `<path class="${cls}" d="M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${base}Z"/>`; };
const svg = (W: number, H: number, body: string) => `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">${body}</svg>`;
const tip = (tips: Tips, html: string) => { tips.push(html); return `data-tip="${tips.length - 1}"`; };

export interface Money { lei: (v: number) => string; k: number; unit: string }

export function drawMonthly(W: number, data: { m: string; cashed: number; spent: number; profit: number }[], cur: string, M: Money, tips: Tips) {
  const sc = niceScale(Math.max(1, ...data.map(d => Math.max(d.cashed, d.spent) * M.k))), max = sc.max, ax = (v: number) => kfmt(v) + M.unit;
  const base = VZ.h - VZ.pb, band = (W - VZ.pl - VZ.pr) / Math.max(1, data.length), bw = Math.min(24, (band - 18) / 2);
  let s = yAxis(W, max, ax, sc.ticks);
  data.forEach((d, i) => { const cx = VZ.pl + band * i + band / 2;
    s += col(cx - bw - 1, bw, yOf(d.cashed * M.k, max), base, 'vz-s1') + col(cx + 1, bw, yOf(d.spent * M.k, max), base, 'vz-s2');
    s += `<text x="${cx}" y="${base + 18}" text-anchor="middle" class="vz-x ${d.m === cur ? 'cur' : ''}">${MONTHS_L[+d.m.slice(5) - 1].slice(0, 3)}</text>`;
    s += `<rect class="vz-hit" data-m="${d.m}" x="${VZ.pl + band * i}" y="${VZ.pt}" width="${band}" height="${base - VZ.pt}" ${tip(tips, `<b>${monthName(d.m)}</b><div><i class="k s1"></i>Încasat <b>${M.lei(d.cashed)}</b></div><div><i class="k s2"></i>Cheltuieli <b>${M.lei(d.spent)}</b></div><div>Profit <b>${M.lei(d.profit)}</b></div>`)}/>`; });
  return svg(W, VZ.h, s);
}

export function drawDaily(W: number, m: string, pays: { pm: { date: string; amount: number } }[], today: string, M: Money, tips: Tips) {
  const a = m + '-01', n = diffDays(a, addDays(monthEnd(m), 1)), sums = Array<number>(n).fill(0), cnt = Array<number>(n).fill(0);
  pays.forEach(({ pm }) => { const i = diffDays(a, pm.date); if (i >= 0 && i < n) { sums[i] += Number(pm.amount); cnt[i]++; } });
  const sc = niceScale(Math.max(1, ...sums) * M.k), max = sc.max, base = VZ.h - VZ.pb, band = (W - VZ.pl - VZ.pr) / n, bw = Math.max(2, Math.min(24, band - 3)), ax = (v: number) => kfmt(v) + M.unit;
  let s = yAxis(W, max, ax, sc.ticks); const top = sums.indexOf(Math.max(...sums));
  sums.forEach((v, i) => { const x = VZ.pl + band * i + (band - bw) / 2, d = addDays(a, i);
    s += col(x, bw, yOf(v * M.k, max), base, 'vz-s1' + (d > today ? ' fut' : ''));
    if (i % 5 === 0 || i === n - 1) s += `<text x="${x + bw / 2}" y="${base + 18}" text-anchor="middle" class="vz-x">${i + 1}</text>`;
    s += `<rect class="vz-hit" x="${VZ.pl + band * i}" y="${VZ.pt}" width="${band}" height="${base - VZ.pt}" ${tip(tips, `<b>${fmtDL(d)}</b><div>Încasat <b>${M.lei(v)}</b></div><div>${cnt[i]} ${cnt[i] === 1 ? 'plată' : 'plăți'}</div>`)}/>`; });
  if (sums[top] > 0) s += `<text x="${VZ.pl + band * top + band / 2}" y="${yOf(sums[top] * M.k, max) - 6}" text-anchor="middle" class="vz-val">${ax(sums[top] * M.k)}</text>`;
  return svg(W, VZ.h, s);
}

export interface OccData { a: string; n: number; rooms: number; used: number[]; pts: [number, number][]; step: number }
export function drawOcc(W: number, occ: { a: string; n: number; rooms: number; used: number[] }): { html: string; data: OccData } {
  const { a, n, rooms, used } = occ, base = VZ.h - VZ.pb, step = (W - VZ.pl - VZ.pr) / Math.max(1, n - 1);
  const pts = used.map((u, i): [number, number] => [VZ.pl + step * i, yOf(rooms ? Math.min(1, u / rooms) : 0, 1)]);
  const line = pts.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ',' + q[1].toFixed(1)).join('');
  let s = yAxis(W, 1, v => Math.round(v * 100) + '%');
  s += `<path class="vz-area" d="${line}L${pts[n - 1][0]},${base}L${pts[0][0]},${base}Z"/><path class="vz-line" d="${line}"/>`;
  pts.forEach((q, i) => { if (i % 5 === 0 || i === n - 1) s += `<text x="${q[0]}" y="${base + 18}" text-anchor="middle" class="vz-x">${i + 1}</text>`; });
  s += `<line class="vz-cross" data-occx="1" x1="0" x2="0" y1="${VZ.pt}" y2="${base}" style="display:none"/><circle class="vz-dot" data-occd="1" r="4.5" style="display:none"/>`;
  s += `<rect class="vz-plot" x="${VZ.pl - step / 2}" y="${VZ.pt}" width="${W - VZ.pl - VZ.pr + step}" height="${base - VZ.pt}"/>`;
  return { html: svg(W, VZ.h, s), data: { a, n, rooms, used, pts, step } };
}

export function drawSrc(W: number, bySrc: Partial<Record<Source, { res: number; n: number; v: number }>>, M: Money, tips: Tips) {
  const keys = (Object.keys(SRC) as Source[]).filter(k => bySrc[k]).sort((x, y) => bySrc[y]!.v - bySrc[x]!.v);
  if (!keys.length) return '<div class="empty">Nicio noapte vândută în această lună</div>';
  const rowH = 34, lw = 112, vw = 92, H = keys.length * rowH + 6, max = Math.max(...keys.map(k => bySrc[k]!.v)), span = W - lw - vw, bh = 18;
  let s = '';
  keys.forEach((k, i) => { const x = bySrc[k]!, y = 3 + i * rowH, w = Math.max(3, x.v / max * span), by = y + (rowH - bh) / 2, r = Math.min(4, w / 2), x0 = lw, cy = y + rowH / 2;
    s += `<circle cx="10" cy="${cy}" r="4.5" style="fill:var(--src-${k}, var(--src-other))"/><text x="22" y="${cy + 4}" class="vz-lab">${esc(SRC[k])}</text>`;
    s += `<path class="vz-s1" d="M${x0},${by}H${x0 + w - r}Q${x0 + w},${by} ${x0 + w},${by + r}V${by + bh - r}Q${x0 + w},${by + bh} ${x0 + w - r},${by + bh}H${x0}Z"/>`;
    s += `<text x="${x0 + w + 8}" y="${cy + 4}" class="vz-val">${M.lei(x.v)}</text>`;
    s += `<rect class="vz-hit" x="0" y="${y}" width="${W}" height="${rowH}" ${tip(tips, `<b>${esc(SRC[k])}</b><div>Venit <b>${M.lei(x.v)}</b></div><div>${x.res} rezervări · ${x.n} nopți</div>${COMM[k] ? `<div>Comision estimat <b>${M.lei(x.v * COMM[k]!)}</b></div>` : ''}`)}/>`; });
  return svg(W, H, s);
}
