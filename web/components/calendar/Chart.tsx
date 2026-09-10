'use client';
// The tape chart: nights down, rooms across. Drag a block to move it, drag its bottom edge to change the
// departure, drag over empty cells to book. On a phone: tap for details, hold to pick a block up.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useData, useStore } from '@/lib/client/store';
import { useMedia } from '@/lib/client/useMedia';
import { addDays, diffDays, DOWS, fmtD, fromIso, MONTHS, money, todayIso } from '@/domain/dates';
import { SRC, SRC_SHORT, STATUS } from '@/domain/labels';
import { columns, conflictAny, floorById, paid, payStatus, propById, rateFor, remaining, resGuest, roomById, roomLabel, shortProp } from '@/domain/rules';
import { layoutBlocks, type Block } from './layout';

type Cand = { roomIds: string[]; checkIn: string; checkOut: string };
type ResDrag = { mode: 'move' | 'resize'; id: string; x0: number; y0: number; rooms0: string[]; in0: string; out0: string; moved: boolean; touch: boolean; armed: boolean; cand?: Cand; valid: boolean };
type SelDrag = { mode: 'select'; c0: number; c1: number; r0: number; r1: number; x0: number; y0: number; moved: boolean; touch: boolean; armed: boolean };
type Preview = { id: string; dx: number; dy: number; h: number | null; valid: boolean; cand: Cand; rect: { l: number; t: number; r: number; b: number } };

const D = (s: string) => { const d = fromIso(s); return `${DOWS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const nn = (n: number) => `${n} ${n === 1 ? 'noapte' : 'nopți'}`;

export default function Chart({ onPeriod }: { onPeriod: (label: string) => void }) {
  const data = useData();
  const view = useStore(s => s.view), setView = useStore(s => s.setView);
  const openDrawer = useStore(s => s.openDrawer), openModal = useStore(s => s.openModal), toast = useStore(s => s.toast), patch = useStore(s => s.patchReservation);
  const router = useRouter();
  const today = useMemo(todayIso, []);

  // sizes follow the zoom; phones and short (sideways) screens get tighter rows
  const compact = useMedia('(max-width:720px), (max-height:520px)'), short = useMedia('(max-height:520px)');
  const z = view.zoom;
  const COLW = Math.round((compact ? 128 : 156) * z), ROWH = Math.round((compact ? 46 : 52) * z);
  const showFloors = view.floor === 'all';
  const HEADH = Math.round(Math.max(short ? 44 : 50, (short ? 48 : compact ? 62 : 70) * z)) + (showFloors && data.floors.length ? 14 : 0);
  const DATEW = Math.round(Math.max(72, (compact ? 64 : 84) * z));

  const cols = useMemo(() => columns(data, view), [data, view.prop, view.floor]);   // eslint-disable-line react-hooks/exhaustive-deps
  const chartRef = useRef<HTMLDivElement>(null), bodyRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(14);
  useLayoutEffect(() => {
    const el = chartRef.current!; const measure = () => setFit(Math.max(14, Math.ceil((el.clientHeight - HEADH) / ROWH) + 2));
    measure(); const ro = new ResizeObserver(measure); ro.observe(el); return () => ro.disconnect();
  }, [ROWH, HEADH]);
  const nDays = fit + view.extra;
  const days = useMemo(() => Array.from({ length: nDays }, (_, i) => addDays(view.start, i)), [view.start, nDays]);
  const { blocks, bridges } = useMemo(() => layoutBlocks(data, cols, view.start, nDays, COLW, ROWH, z, today), [data, cols, view.start, nDays, COLW, ROWH, z, today]);

  // what is on screen: the period label and the prices in the room headers follow the scroll
  const [range, setRange] = useState<[number, number]>([0, 6]);
  const lastTop = useRef(0), busy = useRef(false), shiftPending = useRef(0);
  const readRange = () => {
    const el = chartRef.current; if (!el) return;
    const a = Math.max(0, Math.floor(el.scrollTop / ROWH)), b = Math.min(nDays - 1, Math.floor((el.scrollTop + el.clientHeight - HEADH - 1) / ROWH));
    setRange(p => (p[0] === a && p[1] === Math.max(a, b) ? p : [a, Math.max(a, b)]));
  };
  const onScroll = () => {
    const el = chartRef.current!; const st = el.scrollTop, up = st < lastTop.current; lastTop.current = st;
    readRange();
    if (busy.current) return;
    // endless: more days below when scrolling down, earlier days above when scrolling up
    if (st + el.clientHeight > el.scrollHeight - ROWH * 3) { busy.current = true; setView({ extra: view.extra + 14 }); }
    else if (up && st < ROWH * 2) { busy.current = true; shiftPending.current = 14; setView({ start: addDays(view.start, -14), extra: view.extra + 14 }); }
  };
  useLayoutEffect(() => {
    const el = chartRef.current;
    if (el && shiftPending.current) { el.scrollTop += shiftPending.current * ROWH; lastTop.current = el.scrollTop; shiftPending.current = 0; }
    busy.current = false; readRange();
  }, [view.start, view.extra, ROWH, fit]);   // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => { if (chartRef.current) { chartRef.current.scrollTop = 0; lastTop.current = 0; readRange(); } }, [view.jump]);   // eslint-disable-line react-hooks/exhaustive-deps
  const d0 = days[Math.min(range[0], days.length - 1)], d1 = days[Math.min(range[1], days.length - 1)];
  useEffect(() => { onPeriod(`${fmtD(d0)} – ${fmtD(d1)} ${fromIso(d1).getFullYear()}`); }, [d0, d1, onPeriod]);

  /* ---------- dragging ---------- */
  const drag = useRef<ResDrag | SelDrag | null>(null), lpTimer = useRef<ReturnType<typeof setTimeout>>(undefined), lastTouch = useRef(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [sel, setSel] = useState<{ c0: number; c1: number; r0: number; r1: number } | null>(null);
  const [lifted, setLifted] = useState<string | null>(null);
  const L = useRef({ cols, days, COLW, ROWH, nDays, data, view, blocks });
  L.current = { cols, days, COLW, ROWH, nDays, data, view, blocks };

  const cancel = () => { clearTimeout(lpTimer.current); drag.current = null; setSel(null); setPreview(null); setLifted(null); };
  const vibrate = () => { try { navigator.vibrate?.(12); } catch {} };

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement; lastTouch.current = e.pointerType === 'touch';
    if (e.button !== 0 || t.closest('.qa')) return;
    const { cols, COLW, ROWH, nDays, data } = L.current, touch = e.pointerType === 'touch';
    const resEl = t.closest('.res') as HTMLElement | null;
    clearTimeout(lpTimer.current);
    if (resEl) {
      const r = data.reservations.find(x => x.id === resEl.dataset.id); if (!r) return;
      drag.current = { mode: t.classList.contains('rs') ? 'resize' : 'move', id: r.id, x0: e.clientX, y0: e.clientY, rooms0: r.roomIds.slice(), in0: r.checkIn, out0: r.checkOut, moved: false, touch, armed: !touch, valid: true };
      if (touch) lpTimer.current = setTimeout(() => { const d = drag.current; if (d && !d.moved) { d.armed = true; setLifted(r.id); vibrate(); } }, 420);
    } else {
      const rect = bodyRef.current!.getBoundingClientRect();
      const col = Math.floor((e.clientX - rect.left) / COLW), row = Math.floor((e.clientY - rect.top) / ROWH);
      if (col < 0 || col >= cols.length || row < 0 || row >= nDays) return;
      drag.current = { mode: 'select', c0: col, c1: col, r0: row, r1: row, x0: e.clientX, y0: e.clientY, moved: false, touch, armed: !touch };
      if (touch) lpTimer.current = setTimeout(() => { const d = drag.current; if (d && d.mode === 'select' && !d.armed) { d.armed = true; setSel({ c0: col, c1: col, r0: row, r1: row }); vibrate(); } }, 420);
      else setSel({ c0: col, c1: col, r0: row, r1: row });
    }
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current; if (!d) return;
      if (d.touch && !d.armed) { if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 8) cancel(); return; }   // a swipe: let it scroll
      const { cols, COLW, ROWH, nDays, data, view, blocks } = L.current, rect = bodyRef.current!.getBoundingClientRect();
      if (d.mode === 'select') {
        d.r1 = Math.max(0, Math.min(nDays - 1, Math.floor((e.clientY - rect.top) / ROWH)));
        d.c1 = Math.max(0, Math.min(cols.length - 1, Math.floor((e.clientX - rect.left) / COLW)));
        d.moved = true; setSel({ c0: d.c0, c1: d.c1, r0: d.r0, r1: d.r1 }); return;
      }
      const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
      if (!d.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      d.moved = true;
      const idxs = d.rooms0.map(id => cols.findIndex(c => c.room.id === id)).filter(i => i >= 0).sort((a, b) => a - b);
      if (!idxs.length) return;
      const allShown = idxs.length === d.rooms0.length;   // rooms hidden by the floor filter stay where they are
      let cand: Cand, pdx = 0, pdy = 0, ph: number | null = null;
      if (d.mode === 'move') {
        const dRows = Math.round(dy / ROWH), dCols = allShown ? Math.round(dx / COLW) : 0;
        const shift = Math.max(-idxs[0], Math.min(cols.length - 1 - idxs[idxs.length - 1], dCols));
        cand = { roomIds: allShown ? idxs.map(i => cols[i + shift].room.id) : d.rooms0, checkIn: addDays(d.in0, dRows), checkOut: addDays(d.out0, dRows) };
        pdx = shift * COLW; pdy = dRows * ROWH;
      } else {
        // the bottom edge follows the row under the pointer
        const row = Math.floor((e.clientY - rect.top) / ROWH), n = Math.max(1, row - diffDays(view.start, d.in0) + 1);
        cand = { roomIds: d.rooms0, checkIn: d.in0, checkOut: addDays(d.in0, n) };
        ph = n * ROWH - 4;
      }
      d.cand = cand;
      d.valid = cand.roomIds.every(id => roomById(data, id)?.active) && !conflictAny(data, cand.roomIds, cand.checkIn, cand.checkOut, d.id);
      const b = blocks.find(x => x.r.id === d.id) as Block;
      const l = rect.left + b.ci * COLW + 4 + pdx, t = rect.top + b.top + 2 + pdy;
      setPreview({ id: d.id, dx: pdx, dy: pdy, h: ph, valid: d.valid, cand, rect: { l, t, r: l + b.span * COLW - 8, b: t + (ph ?? b.h - 4) } });
    };
    const up = () => {
      clearTimeout(lpTimer.current);
      const d = drag.current; drag.current = null; if (!d) return;
      const { cols, data, view } = L.current;
      setSel(null); setPreview(null); setLifted(null);
      if (d.mode === 'select') {
        const a = Math.min(d.r0, d.r1), b = Math.max(d.r0, d.r1), rooms = cols.slice(Math.min(d.c0, d.c1), Math.max(d.c0, d.c1) + 1).map(c => c.room);
        if (rooms.some(r => !r.active)) { toast('Una dintre camere este dezactivată', 'bad'); return; }
        openModal({ roomIds: rooms.map(r => r.id), checkIn: addDays(view.start, a), checkOut: addDays(view.start, b + 1) });
        return;
      }
      if (!d.moved) { openDrawer(d.id); return; }   // a click, a tap, or a hold without moving
      const c = d.cand; if (!c || (c.roomIds.join() === d.rooms0.join() && c.checkIn === d.in0 && c.checkOut === d.out0)) return;
      if (!d.valid) {
        const cf = conflictAny(data, c.roomIds, c.checkIn, c.checkOut, d.id);
        toast(cf ? `Suprapunere cu ${resGuest(data, cf)} în ${roomLabel(data, cf)} (${fmtD(cf.checkIn)} – ${fmtD(cf.checkOut)})` : 'Camera este dezactivată', 'bad');
        return;
      }
      const r = data.reservations.find(x => x.id === d.id)!, n = diffDays(c.checkIn, c.checkOut);
      const names = c.roomIds.map(id => roomById(data, id)?.name).join(' + ');
      patch(d.id, c, { undoLabel: d.mode === 'move' ? `${resGuest(data, r)} → ${names}, ${fmtD(c.checkIn)} – ${fmtD(c.checkOut)}` : `Check-out mutat la ${fmtD(c.checkOut)} (${nn(n)})` });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // a held block moves with the finger instead of scrolling; two fingers zoom; Ctrl + wheel zooms
  useEffect(() => {
    const el = chartRef.current!; let pinch: { d0: number; z0: number } | null = null;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const setZ = (v: number) => { const zz = Math.min(1.6, Math.max(0.5, Math.round(v * 20) / 20)); if (zz !== L.current.view.zoom) setView({ zoom: zz }); };
    const ts = (e: TouchEvent) => { if (e.touches.length === 2) { cancel(); pinch = { d0: dist(e.touches), z0: L.current.view.zoom }; } };
    const tm = (e: TouchEvent) => {
      if (pinch && e.touches.length === 2) { e.preventDefault(); setZ(pinch.z0 * dist(e.touches) / pinch.d0); return; }
      if (drag.current?.armed && drag.current.touch) e.preventDefault();
    };
    const te = (e: TouchEvent) => { if (e.touches.length < 2) pinch = null; };
    const wh = (e: WheelEvent) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); setZ(L.current.view.zoom + (e.deltaY < 0 ? 0.1 : -0.1)); };
    el.addEventListener('touchstart', ts, { passive: true }); el.addEventListener('touchmove', tm, { passive: false });
    el.addEventListener('touchend', te); el.addEventListener('wheel', wh, { passive: false });
    return () => { el.removeEventListener('touchstart', ts); el.removeEventListener('touchmove', tm); el.removeEventListener('touchend', te); el.removeEventListener('wheel', wh); };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const quick = (id: string) => {
    const r = data.reservations.find(x => x.id === id); const b = blocks.find(x => x.r.id === id); if (!r || !b?.qa) return;
    if (b.qa.status === 'checked_out' && remaining(r) > 0) { openDrawer(r.id); toast(`Rest de plată ${money(remaining(r))}. Încasează sau confirmă plecarea din sertar.`, 'bad'); return; }
    patch(r.id, { status: b.qa.status }, { undoLabel: `${resGuest(data, r)}: ${STATUS[b.qa.status]}` });
  };

  /* ---------- drawing ---------- */
  const groupKey = (i: number) => { const c = cols[i], t = c.parent || c.room; return t.propertyId + '/' + (t.floorId || ''); };
  const hl = preview?.cand, hlRow0 = hl ? diffDays(view.start, hl.checkIn) : -1, hlN = hl ? diffDays(hl.checkIn, hl.checkOut) : 0;
  const hlCols = hl ? hl.roomIds.map(id => cols.findIndex(c => c.room.id === id)).filter(i => i >= 0) : [];
  const q = view.q.trim().toLowerCase();
  const style = { '--colw': `${COLW}px`, '--rowh': `${ROWH}px`, '--headh': `${HEADH}px`, '--datew': `${DATEW}px`, '--z': z, '--peekw': `${Math.round(Math.max(240, 156 * z * 1.7))}px` } as CSSProperties;

  return (
    <>
      <div className={`chart ${z < 1 ? 'zoomed-out' : ''} ${ROWH < 38 ? 'tight' : ''}`} id="chart" ref={chartRef} style={style} onScroll={onScroll}>
        <div className="corner">Zi ↓ <span className="c-room">Cameră →</span></div>
        <div className="rhead">
          {cols.map((c, i) => {
            const r = c.room, top = c.parent || r, sep = i > 0 && groupKey(i) !== groupKey(i - 1);
            const price = rateFor(data, r.id, d0);
            return (
              <div key={r.id} className={`rh ${c.pos} ${r.active ? '' : 'inactive'} ${r.color ? 'colored' : ''} ${sep ? 'fsep' : ''} ${hl?.roomIds.includes(r.id) ? 'hl' + (preview!.valid ? '' : ' bad') : ''}`} style={r.color ? ({ '--rc': r.color } as CSSProperties) : undefined}>
                {c.parent ? <div className="grp">{c.parent.name} · {c.parent.type}</div>
                  : showFloors && (sep || i === 0) ? <div className="fl">{(view.prop === 'all' ? shortProp(propById(data, top.propertyId)) + ' · ' : '') + (floorById(data, top.floorId)?.name || 'fără etaj')}</div> : null}
                <div className="rn">{r.name}</div>
                <div className="rt"><span className={`cap c${Math.min(r.capacity, 4)}`}>{r.capacity}p</span><span className="ty">{r.type}</span>
                  <b className={`num pr ${price > r.price ? 'up' : price < r.price ? 'down' : ''}`}>{price} lei</b></div>
              </div>
            );
          })}
          <div className="rh add" onClick={() => router.push('/camere')}>+ Cameră</div>
        </div>
        <div className="dcol">
          {days.map((d, i) => { const dt = fromIso(d), wk = dt.getDay() === 0 || dt.getDay() === 6;
            const on = hl && i >= hlRow0 && i < hlRow0 + hlN, co = hl && i === hlRow0 + hlN;
            return <div key={d} className={`dc ${wk ? 'wk' : ''} ${d === today ? 'today' : ''} ${d < today ? 'past' : ''} ${on ? 'hl' + (preview!.valid ? '' : ' bad') : ''} ${co ? 'co' : ''}`}>
              <div className="d1">{dt.getDate()} {MONTHS[dt.getMonth()]}</div><div className="d2">{d === today ? 'Azi' : DOWS[dt.getDay()]}</div></div>; })}
        </div>
        <div className="body" ref={bodyRef} style={{ width: cols.length * COLW + 90, height: nDays * ROWH }} onPointerDown={onPointerDown}
          onContextMenu={e => { if (lastTouch.current) e.preventDefault(); }}>
          {days.map((d, i) => { const dt = fromIso(d), wk = dt.getDay() === 0 || dt.getDay() === 6;
            if (d === today) return <div key={d} className="rowbg today" style={{ top: i * ROWH }}><div className="todayline" /></div>;
            if (d < today) return <div key={d} className={`rowbg past ${wk ? 'wk' : ''}`} style={{ top: i * ROWH }} />;
            return wk ? <div key={d} className="rowbg wk" style={{ top: i * ROWH }} /> : null; })}
          {cols.map((c, i) => i > 0 && groupKey(i) !== groupKey(i - 1) ? <div key={'s' + c.room.id} className="fsep-line" style={{ left: i * COLW - 1 }} /> : null)}
          {cols.map((c, i) => <span key={'b' + c.room.id}>
            {c.room.color && <div className="colbg tint" style={{ left: i * COLW, background: `color-mix(in srgb,${c.room.color} 5%,transparent)` }} />}
            {!c.room.active && <div className="colbg inactive" style={{ left: i * COLW }} />}
          </span>)}
          {hl && <div className={`dragband ${preview!.valid ? '' : 'bad'}`} style={{ display: 'block', top: hlRow0 * ROWH, height: hlN * ROWH }} />}
          {hl && hlCols.length > 0 && <div className={`dragcol ${preview!.valid ? '' : 'bad'}`} style={{ display: 'block', left: Math.min(...hlCols) * COLW, width: (Math.max(...hlCols) - Math.min(...hlCols) + 1) * COLW }} />}
          {sel && <SelBox sel={sel} COLW={COLW} ROWH={ROWH} />}
          {blocks.map(b => <BlockView key={b.key} b={b} COLW={COLW} today={today} q={q} lifted={lifted === b.r.id}
            pv={preview && preview.id === b.r.id ? preview : null} onQuick={quick} />)}
          {bridges.map(x => <div key={x.key} className={`bridge ${x.past ? 'past' : ''}`} style={{ '--c': x.color, left: x.left, width: 10, top: x.top, height: x.height } as CSSProperties} />)}
        </div>
      </div>
      {preview && <DragTips pv={preview} data-rooms={preview.cand.roomIds.map(id => roomById(data, id)?.name).join(' + ')} />}
    </>
  );

  function SelBox({ sel, COLW, ROWH }: { sel: NonNullable<typeof preview extends never ? never : { c0: number; c1: number; r0: number; r1: number }>; COLW: number; ROWH: number }) {
    const a = Math.min(sel.r0, sel.r1), b = Math.max(sel.r0, sel.r1), c0 = Math.min(sel.c0, sel.c1), c1 = Math.max(sel.c0, sel.c1);
    const rooms = cols.slice(c0, c1 + 1).map(c => c.room), inD = addDays(view.start, a), outD = addDays(view.start, b + 1);
    const bad = rooms.some(r => !r.active) || !!conflictAny(data, rooms.map(r => r.id), inD, outD);
    return <div className="selbox" style={{ display: 'block', left: c0 * COLW + 3, top: a * ROWH + 2, width: (c1 - c0 + 1) * COLW - 6, height: (b - a + 1) * ROWH, ...(bad ? { borderColor: 'var(--bad)', background: 'var(--bad-soft)' } : {}) }}>
      <span className="lab">{nn(b - a + 1)}{rooms.length > 1 ? ` · ${rooms.length} camere` : ''}</span></div>;
  }
}

function BlockView({ b, COLW, today, q, lifted, pv, onQuick }: { b: Block; COLW: number; today: string; q: string; lifted: boolean; pv: Preview | null; onQuick: (id: string) => void }) {
  const { r } = b, n = diffDays(r.checkIn, r.checkOut), rem = remaining(r), ps = payStatus(r);
  const cls = ['res', r.status, r.checkOut <= today ? 'past' : '', ['short', 't1', 't2', 't3', ''][b.tier], b.span > 1 ? 'multi' : '',
    b.alert ? 'has-alert ' + (b.alert.level === 'warn' ? 'warnlvl' : '') : '', b.segment ? 'segment' : '', pv ? 'dragging' : '', pv && !pv.valid ? 'invalid' : '', lifted ? 'lifted' : ''].join(' ');
  const out = pv ? pv.cand.checkOut : r.checkOut, inD = pv ? pv.cand.checkIn : r.checkIn, n2 = pv ? diffDays(inD, out) : n;
  const style = { '--c': b.color, '--nl': b.nl, left: b.ci * COLW + 4 + (pv?.dx ?? 0), top: b.top + 2 + (pv?.dy ?? 0), height: pv?.h ?? b.h - 4, width: b.span * COLW - 8,
    opacity: q && !b.gn.toLowerCase().includes(q) ? 0.18 : undefined } as CSSProperties;
  return (
    <div className={cls} style={style} data-id={r.id} title={b.alert?.text}>
      <div className="g">{b.gn}</div>
      <div className="x"><b>{fmtD(inD)}</b> → <b>{fmtD(out)}</b> · {STATUS[r.status]}</div>
      <div className="m m1">{nn(n2)}<span className="px"> · {r.pax} pers.</span></div>
      <div className="m m2"><b>{Number(r.total).toLocaleString('ro-RO')} lei</b><span className="sep"> · </span>
        {rem > 0 ? <span className="rest">rest {Number(rem).toLocaleString('ro-RO')}</span> : <span className="okp">achitat</span>}</div>
      {r.notes && <div className="nt">{r.notes}</div>}
      <div className="x">Încasat <b>{money(paid(r))}</b> · {SRC[r.source]}</div>
      {b.alert && <span className={`al ${b.alert.level === 'warn' ? 'warn' : ''}`}>!</span>}
      <div className="ft">
        {b.showQa && b.qa ? <button className={`qa ${b.qa.cls}`} onClick={e => { e.stopPropagation(); onQuick(r.id); }}>{b.qa.label}</button> : <span className="out">→ {fmtD(out)}</span>}
        <span className={`src ${r.source}`}>{SRC_SHORT[r.source]}</span><span className={`pay ${ps}`} />
      </div>
      {b.span > 1 && b.tier > 0 && <span className="rooms">{b.span} camere</span>}
      <div className="rs" />
    </div>
  );
}

// arrival beside the top of the block, departure beside its bottom: the morning the room frees up
function DragTips({ pv, 'data-rooms': rooms }: { pv: Preview; 'data-rooms': string }) {
  const w = 190, flip = typeof window !== 'undefined' && pv.rect.r + 12 + w > window.innerWidth - 8;
  const x = flip ? Math.max(8, pv.rect.l - 12 - w) : pv.rect.r + 12, n = diffDays(pv.cand.checkIn, pv.cand.checkOut);
  const tTop = Math.max(8, pv.rect.t), bTop = Math.max(tTop + 50, pv.rect.b - 44);
  const bad = pv.valid ? '' : 'bad';
  return (
    <>
      <div className={`dragtip on ${flip ? 'flip' : ''} ${bad}`} style={{ left: x, top: tTop }}><span className="lbl">Sosire</span><b>{D(pv.cand.checkIn)}</b><span className="sub">{nn(n)} · {rooms}</span></div>
      <div className={`dragtip below on ${flip ? 'flip' : ''} ${bad}`} style={{ left: x, top: bTop }}><span className="lbl">Pleacă</span><b>{D(pv.cand.checkOut)}</b><span className="sub">dimineața</span></div>
    </>
  );
}
