// Where each reservation block goes on the calendar and how much text fits in it.
import type { AppState, Reservation } from '@/domain/types';
import { addDays, diffDays } from '@/domain/dates';
import { alertFor, isActiveRes, nights, quickAction, resGuest, type Column } from '@/domain/rules';

let mctx: CanvasRenderingContext2D | null | undefined;
const measureCtx = () => (mctx === undefined ? (mctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null) : mctx);

export interface Block {
  key: string;
  r: Reservation;
  gn: string;
  ci: number;          // first column
  span: number;        // columns side by side
  top: number;
  h: number;
  tier: number;        // 0: one line, 1: name, 2: + nights, 3: + money, 4: + notes
  nl: number;          // lines for the name
  color: string;
  alert: ReturnType<typeof alertFor>;
  qa: ReturnType<typeof quickAction>;
  showQa: boolean;
  segment: boolean;    // one of several pieces (rooms not side by side)
}
export interface Bridge { key: string; left: number; top: number; height: number; color: string; past: boolean }

export function layoutBlocks(s: AppState, cols: Column[], d0: string, nDays: number, COLW: number, ROWH: number, zoom: number, today: string) {
  const colIdx = new Map(cols.map((c, i) => [c.room.id, i]));
  const rangeEnd = addDays(d0, nDays);
  const blocks: Block[] = [];
  const placed: { r: Reservation; c0: number; c1: number; y0: number; y1: number; color: string }[] = [];
  const m = measureCtx();
  const fs = Math.max(10, 12.5 * zoom), lnName = fs * 1.25, lnDet = Math.max(9.5, 11 * zoom) * 1.5, lnNote = Math.max(9, 10.5 * zoom) * 1.35 * 2;
  if (m) m.font = `800 ${fs}px Manrope, system-ui, sans-serif`;
  const width = (t: string) => (m ? m.measureText(t).width : t.length * fs * 0.56);

  for (const r of s.reservations) {
    if (!(r.checkIn < rangeEnd && r.checkOut > d0)) continue;
    const cis = [...new Set(r.roomIds.map(id => colIdx.get(id)).filter((x): x is number => x !== undefined))].sort((a, b) => a - b);
    if (!cis.length) continue;
    // rooms that are not side by side are drawn as separate pieces of the same reservation
    const runs: [number, number][] = [];
    cis.forEach(i => { const last = runs[runs.length - 1]; if (last && i === last[0] + last[1]) last[1]++; else runs.push([i, 1]); });
    const gn = resGuest(s, r), n = nights(r), top = diffDays(d0, r.checkIn) * ROWH, h = n * ROWH;
    const due = (r.status === 'confirmed' || r.status === 'pending') && r.checkIn <= today && r.checkOut > today;
    const color = r.status === 'cancelled' ? 'var(--st-cancel)' : due ? 'var(--src-due)' : `var(--src-${r.source}, var(--src-other))`;
    const alert = alertFor(r, today), qa = quickAction(r, today);
    // word-aware estimate of how many lines the name needs at a given width
    const linesFor = (availW: number) => {
      availW = Math.max(20, availW); let lines = 1, cur = 0;
      for (const w of gn.split(/\s+/)) {
        const ww = width(w + ' ');
        if (cur + ww <= availW) cur += ww;
        else if (ww <= availW) { lines++; cur = ww; }
        else { lines += Math.ceil((ww - (availW - cur)) / availW); cur = (ww - (availW - cur)) % availW; }
      }
      return Math.min(4, lines);
    };
    runs.forEach(([ci, span], ri) => {
      const blockW = span * COLW - 8, padL = Math.max(9, 12 * zoom), padR = Math.max(6, 9 * zoom);
      const wantQa = !!qa && COLW * span >= 104;
      let tier = 0, nl = 1, room = (h - 4) - Math.max(4, 7 * zoom) - Math.max(18, 24 * zoom);
      if (room < lnName) {
        const footerW = blockW < 74 ? 0 : Math.max(52, 70 * zoom) + (alert ? Math.max(10, 14 * zoom) : 0);
        nl = Math.min(linesFor(blockW - padL - padR - footerW), Math.max(1, Math.floor(((h - 4) - 10) / lnName)));
      } else {
        const need = linesFor(blockW - padL - padR - (alert ? Math.max(14, 20 * zoom) : 0) - (span > 1 ? 44 : 0));
        // the quick-action button is taller than the plain "→ date" footer: one line of the name always fits above it,
        // more lines and the details only in the room that is left
        if (wantQa) room -= Math.max(6, 8 * zoom);
        nl = Math.max(1, Math.min(need, Math.floor(room / lnName)));
        room -= nl * lnName; tier = 1;
        if (room >= lnDet) { tier = 2; room -= lnDet; }
        if (tier === 2 && room >= lnDet) { tier = 3; room -= lnDet; }
        if (tier === 3 && r.notes && room >= lnNote) tier = 4;
      }
      blocks.push({ key: `${r.id}:${ri}`, r, gn, ci, span, top, h, tier, nl, color, alert, qa, showQa: wantQa && tier > 0, segment: runs.length > 1 });
      placed.push({ r, c0: ci, c1: ci + span - 1, y0: top + 2, y1: top + h - 2, color });
    });
  }

  // same guest, rooms side by side, nights that overlap: join the blocks across the gap so they read as one stay
  const bridges: Bridge[] = [];
  placed.forEach(a => placed.forEach(b => {
    if (a === b || a.r.guestId !== b.r.guestId || a.r.id === b.r.id || !isActiveRes(a.r) || !isActiveRes(b.r) || b.c0 !== a.c1 + 1) return;
    const y0 = Math.max(a.y0, b.y0) + 6, y1 = Math.min(a.y1, b.y1) - 6; if (y1 - y0 < 8) return;
    bridges.push({ key: `${a.r.id}>${b.r.id}`, left: (a.c1 + 1) * COLW - 5, top: y0, height: y1 - y0, color: a.color, past: a.r.checkOut <= today });
  }));
  return { blocks, bridges };
}
