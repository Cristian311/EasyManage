'use client';
// Prices per room per night. Two layouts: rooms across (like the calendar) or nights across (like Booking).
// Click a price to change it right there; drag over the grid or pick a group of rooms to set a period.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react';
import { useData, useStore } from '@/lib/client/store';
import { useMedia } from '@/lib/client/useMedia';
import { addDays, diffDays, DOWS, fmtD, fmtDL, fromIso, isWkNight, MONTHS, todayIso } from '@/domain/dates';
import { monthEnd } from '@/domain/finance';
import { columns, floorById, propById, rateFor, roomById, shortProp } from '@/domain/rules';
import type { Room } from '@/domain/types';
import PropBar from '../calendar/PropBar';

const RTVIEW_KEY = 'velora-rtview';

export default function RatesPage() {
  const data = useData(), view = useStore(s => s.view), setRates = useStore(s => s.setRates), admin = useStore(s => s.admin), toast = useStore(s => s.toast);
  const touch = useMedia('(hover: none)');
  const today = useMemo(todayIso, []);
  const [rv, setRv] = useState(() => ({ start: addDays(today, -3), days: 62, flip: false }));
  useEffect(() => { try { if (localStorage.getItem(RTVIEW_KEY) === '1') setRv(v => ({ ...v, flip: true })); } catch {} }, []);
  const [sel, setSel] = useState<{ rooms: string[]; from: string; to: string }>({ rooms: [], from: today, to: addDays(today, 6) });
  const [price, setPrice] = useState(''), [wk, setWk] = useState(false);
  const [ed, setEd] = useState<{ rid: string; d: string; v: string; start: number } | null>(null);
  const rooms = useMemo(() => columns(data, view).map(c => c.room), [data, view.prop, view.floor]);   // eslint-disable-line react-hooks/exhaustive-deps
  const days = useMemo(() => Array.from({ length: rv.days }, (_, i) => addDays(rv.start, i)), [rv.start, rv.days]);
  const gridRef = useRef<HTMLDivElement>(null), priceRef = useRef<HTMLInputElement>(null);

  // shade of green: the price against rooms of the same size in the same villa and month
  const heat = useMemo(() => {
    const avg = new Map<string, number>();
    return (rm: Room, d: string, p: number) => {
      const ym = d.slice(0, 7), key = `${rm.propertyId}|${rm.capacity}|${ym}`;
      if (!avg.has(key)) {
        const grp = data.rooms.filter(x => x.propertyId === rm.propertyId && x.capacity === rm.capacity && !data.rooms.some(u => u.parentId === x.id));
        let t = 0, n = 0; for (let x = ym + '-01', e = monthEnd(ym); x <= e; x = addDays(x, 1)) grp.forEach(g => { t += rateFor(data, g.id, x); n++; });
        avg.set(key, n ? t / n : p);
      }
      const q = p / avg.get(key)!;
      return 'h' + (q < .88 ? 1 : q < .96 ? 2 : q <= 1.04 ? 3 : q <= 1.12 ? 4 : 5);
    };
  }, [data]);

  /* ---------- selecting cells ---------- */
  const rdrag = useRef<{ cols: string[]; c0: number; d0: string; r0: string; moved: boolean; touch: boolean; x0: number; y0: number } | null>(null);
  const selectTo = (rid: string, d: string) => {
    const g = rdrag.current!; if (rid !== g.r0 || d !== g.d0) g.moved = true;
    const c1 = g.cols.indexOf(rid), a = Math.min(g.c0, c1), b = Math.max(g.c0, c1);
    setSel({ rooms: g.cols.slice(a, b + 1), from: d < g.d0 ? d : g.d0, to: d < g.d0 ? g.d0 : d });
  };
  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    const td = (e.target as HTMLElement).closest('td[data-r]') as HTMLElement | null; if (!td || e.button !== 0) return;
    const rid = td.dataset.r!, d = td.dataset.d!;
    if (ed) saveEditor();
    const cols = rooms.map(r => r.id);
    rdrag.current = { cols, c0: cols.indexOf(rid), d0: d, r0: rid, moved: false, touch: e.pointerType === 'touch', x0: e.clientX, y0: e.clientY };
    if (e.pointerType === 'touch') return;   // tap: edit that price; swipe: scroll
    e.preventDefault(); selectTo(rid, d);
  };
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const g = rdrag.current; if (!g) return;
      if (g.touch) { if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > 8) rdrag.current = null; return; }
      const td = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest('td[data-r]') as HTMLElement | null;
      if (td && gridRef.current?.contains(td)) selectTo(td.dataset.r!, td.dataset.d!);
    };
    const up = () => { const g = rdrag.current; rdrag.current = null; if (!g) return; if (!g.moved) openEditor(g.r0, g.d0); else { priceRef.current?.focus(); priceRef.current?.select(); } };
    const cancel = () => { rdrag.current = null; };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cancel);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); };
  });

  /* ---------- one price at a time ---------- */
  const openEditor = (rid: string, d: string) => { const v = rateFor(data, rid, d); setEd({ rid, d, v: String(v), start: v }); };
  const saveEditor = () => {
    if (!ed) return; const v = Math.round(Number(ed.v)); setEd(null);
    if (!(v > 0)) { toast('Prețul trebuie să fie mai mare ca zero', 'bad'); return; }
    if (v === ed.start) return;
    setRates([ed.rid], ed.d, ed.d, v, false, `${roomById(data, ed.rid)?.name}, ${fmtD(ed.d)}: ${v} lei pe noapte`);
  };
  useEffect(() => {
    if (!ed) return;
    const down = (e: PointerEvent) => { const t = e.target as HTMLElement; if (!t.closest('.cellpop') && !gridRef.current?.contains(t)) saveEditor(); };
    document.addEventListener('pointerdown', down, true); return () => document.removeEventListener('pointerdown', down, true);
  });

  /* ---------- endless nights, both ways ---------- */
  const lastTop = useRef(0), lastLeft = useRef(0), busy = useRef(false), pend = useRef<{ top?: number; left?: number } | null>(null);
  const onScroll = () => {
    const g = gridRef.current!; const up = g.scrollTop < lastTop.current, back = g.scrollLeft < lastLeft.current; lastTop.current = g.scrollTop; lastLeft.current = g.scrollLeft;
    if (busy.current) return;
    if (rv.flip) {
      if (g.scrollLeft + g.clientWidth > g.scrollWidth - 220) { busy.current = true; setRv(v => ({ ...v, days: v.days + 31 })); }
      else if (back && g.scrollLeft < 80) { busy.current = true; pend.current = { left: 31 * ((g.querySelector('thead th.dh') as HTMLElement | null)?.offsetWidth || 68) }; setRv(v => ({ ...v, start: addDays(v.start, -31), days: v.days + 31 })); }
    } else {
      if (g.scrollTop + g.clientHeight > g.scrollHeight - 150) { busy.current = true; setRv(v => ({ ...v, days: v.days + 31 })); }
      else if (up && g.scrollTop < 60) { busy.current = true; pend.current = { top: 31 * ((g.querySelector('tbody tr') as HTMLElement | null)?.offsetHeight || 36) }; setRv(v => ({ ...v, start: addDays(v.start, -31), days: v.days + 31 })); }
    }
  };
  useLayoutEffect(() => { const g = gridRef.current; if (g && pend.current) { if (pend.current.top) g.scrollTop += pend.current.top; if (pend.current.left) g.scrollLeft += pend.current.left; lastTop.current = g.scrollTop; lastLeft.current = g.scrollLeft; pend.current = null; } busy.current = false; }, [rv]);
  const jump = (d: string, flip = rv.flip) => { setRv({ start: d, days: 62, flip }); const g = gridRef.current; if (g) { g.scrollTop = 0; g.scrollLeft = 0; } };
  const setFlip = (flip: boolean) => { try { localStorage.setItem(RTVIEW_KEY, flip ? '1' : '0'); } catch {} jump(rv.start, flip); };

  /* ---------- groups and the panel ---------- */
  const groups = useMemo(() => {
    const fl = [...new Set(rooms.map(r => r.floorId).filter(Boolean))].map(id => floorById(data, id)).filter((f): f is NonNullable<typeof f> => !!f);
    return [{ t: 'Toate camerele', f: (_r: Room) => true }, { t: '2 persoane', f: (r: Room) => r.capacity === 2 }, { t: '4 persoane', f: (r: Room) => r.capacity === 4 },
      ...fl.map(f => ({ t: (view.prop === 'all' && data.properties.length > 1 ? shortProp(propById(data, f.propertyId)) + ' · ' : '') + f.name, f: (r: Room) => r.floorId === f.id }))];
  }, [rooms, data, view.prop]);
  const apply = (reset: boolean) => {
    if (!sel.rooms.length) return;
    const p = reset ? null : Math.round(Number(price));
    if (!reset && !(p! > 0)) { toast('Scrie prețul pe noapte', 'bad'); priceRef.current?.focus(); return; }
    const k = sel.rooms.length, per = `${fmtD(sel.from)} – ${fmtD(sel.to)}`, cam = `${k} ${k === 1 ? 'cameră' : 'camere'}`;
    setRates(sel.rooms, sel.from, sel.to, p, wk, reset ? `Prețul de bază revine pe ${cam}, ${per}` : `${p} lei pe noapte pe ${cam}, ${per}${wk ? ', doar vineri și sâmbătă' : ''}`);
  };
  const basePrice = (rm: Room) => {
    const v = prompt(`Prețul de bază pentru ${rm.name}, în lei pe noapte. Se folosește în zilele fără tarif special.`, String(rm.price)); if (v == null) return;
    const n = Math.round(Number(v)); if (!(n > 0)) { toast('Scrie un preț mai mare ca zero', 'bad'); return; }
    admin('PATCH', `/api/rooms/${rm.id}`, { price: n }, `Prețul de bază pentru ${rm.name}: ${n} lei`);
  };

  const isSel = (rid: string, d: string) => sel.rooms.includes(rid) && d >= sel.from && d <= sel.to;
  const cellVal = (rm: Room, d: string) => (ed && ed.rid === rm.id && ed.d === d ? (Number(ed.v) || ed.start) : rateFor(data, rm.id, d));
  const cell = (rm: Room, d: string, extra = '') => { const v = data.rates[rm.id]?.[d], p = cellVal(rm, d);
    return <td key={rm.id + d} data-r={rm.id} data-d={d} className={`${heat(rm, d, p)} ${v != null ? 'cus' : ''} ${isSel(rm.id, d) ? 'sel' : ''} ${extra}`}>{p}</td>; };
  const dcls = (d: string) => `${isWkNight(d) ? 'wk' : ''} ${d === today ? 'today' : ''} ${d < today ? 'past' : ''} ${fromIso(d).getDate() === 1 ? 'm1' : ''}`;
  const roomHead = (rm: Room, cls: string) => <th key={rm.id} className={cls} onClick={() => basePrice(rm)} style={{ '--rc': rm.color || 'transparent' } as CSSProperties} title="Click: prețul de bază">
    <div className="rn">{rm.name}</div><div className="rt"><span className={`cap c${Math.min(rm.capacity, 4)}`}>{rm.capacity}p</span>bază <b>{rm.price}</b></div></th>;
  const n = diffDays(sel.from, sel.to) + 1, k = sel.rooms.length;

  return (
    <section className="page on" id="page-rates">
      <div className="topbar"><h1>Tarife <small>preț pe noapte, pe cameră și pe zi</small></h1><div className="spacer" />
        <div className="seg"><button className={rv.flip ? '' : 'on'} onClick={() => setFlip(false)} title="Camerele sus, zilele în jos">Ca în calendar</button><button className={rv.flip ? 'on' : ''} onClick={() => setFlip(true)} title="Camerele în stânga, zilele spre dreapta">Ca pe Booking</button></div>
        <button className="btn" onClick={() => jump(addDays(today, -3))}>Azi</button>
        <label className="btn" style={{ cursor: 'pointer' }}>Sari la <input type="date" style={{ border: 0, background: 'transparent', padding: 0, font: 'inherit', color: 'inherit' }} onChange={e => { if (e.target.value) jump(e.target.value); }} /></label>
      </div>
      <div className="chart-wrap">
        <PropBar />
        <div className="rt-quick">
          <span className="pb-l">Selectează</span>
          {groups.map((g, i) => <button key={i} className="btn sm" onClick={() => { setSel(s => ({ ...s, rooms: rooms.filter(g.f).map(r => r.id) })); priceRef.current?.focus(); }}>{g.t}</button>)}
          <span className="rt-leg">mai ieftin <i className="g h1" /><i className="g h2" /><i className="g h3" /><i className="g h4" /><i className="g h5" /> mai scump, față de camerele de aceeași mărime (2p, 4p) din luna respectivă</span>
        </div>
        <div className={`rt-grid ${rv.flip ? 'flip' : ''}`} ref={gridRef} onScroll={onScroll} onPointerDown={onDown}>
          {rv.flip ? (
            <table>
              <thead><tr><th className="rt-corner">Camera ↓<br />noaptea din →</th>{days.map(d => { const dt = fromIso(d); return <th key={d} className={`dh ${dcls(d)}`}><b>{dt.getDate()} {MONTHS[dt.getMonth()]}</b><small>{d === today ? 'Azi' : DOWS[dt.getDay()]}</small></th>; })}</tr></thead>
              <tbody>{rooms.map(rm => <tr key={rm.id}>{roomHead(rm, 'rh2')}{days.map(d => cell(rm, d, dcls(d)))}</tr>)}</tbody>
            </table>
          ) : (
            <table>
              <thead><tr><th className="rt-corner">Noaptea din ↓</th>{rooms.map(rm => roomHead(rm, ''))}</tr></thead>
              <tbody>{days.map(d => { const dt = fromIso(d);
                return <tr key={d} className={dcls(d)}><th><b>{dt.getDate()} {MONTHS[dt.getMonth()]}</b>{d === today ? 'AZI' : DOWS[dt.getDay()]}</th>{rooms.map(rm => cell(rm, d))}</tr>; })}</tbody>
            </table>
          )}
        </div>
      </div>
      <div className={`rt-panel ${k ? '' : 'idle'}`}>
        <div className="rt-info">{k ? <><b>{n}</b> {n === 1 ? 'noapte' : 'nopți'} · <b>{k}</b> {k === 1 ? 'cameră' : 'camere'} · {fmtD(sel.from)} – {fmtD(sel.to)}<small>{sel.rooms.map(id => roomById(data, id)?.name).slice(0, 10).join(', ')}{k > 10 ? '…' : ''}</small></>
          : touch ? 'Atinge un preț ca să-l schimbi. Pentru mai multe camere deodată, alege un grup de mai sus.' : 'Click pe un preț ca să-l schimbi direct. Trage pe grilă peste camere și zile, sau alege un grup de camere de mai sus.'}</div>
        <div className="f"><label>De la</label><input type="date" value={sel.from} onChange={e => { const a = e.target.value; if (a) setSel(s => ({ ...s, from: a <= s.to ? a : s.to, to: a <= s.to ? s.to : a })); }} /></div>
        <div className="f"><label>Până la (ultima noapte)</label><input type="date" value={sel.to} onChange={e => { const b = e.target.value; if (b) setSel(s => ({ ...s, from: b >= s.from ? s.from : b, to: b >= s.from ? b : s.from })); }} /></div>
        <div className="f"><label>Preț / noapte (lei)</label><input ref={priceRef} id="rtPrice" type="number" min={0} step={10} placeholder="ex: 300" value={price} onChange={e => setPrice(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') apply(false); }} /></div>
        <label className="chk"><input type="checkbox" checked={wk} onChange={e => setWk(e.target.checked)} /> Doar nopțile de vineri și sâmbătă</label>
        <button className="btn primary" id="rtApply" disabled={!k} onClick={() => apply(false)}>Aplică prețul</button>
        <button className="btn" id="rtReset" disabled={!k} onClick={() => apply(true)}>Revino la prețul de bază</button>
        <button className="btn ghost" id="rtClear" disabled={!k} onClick={() => setSel(s => ({ ...s, rooms: [] }))}>Renunță</button>
      </div>
      {ed && <CellEditor ed={ed} gridRef={gridRef} touch={touch} onChange={v => setEd(x => (x ? { ...x, v } : x))} onBump={k => setEd(x => (x ? { ...x, v: String(Math.max(0, (Math.round(Number(x.v)) || 0) + k)) } : x))} onSave={saveEditor} onCancel={() => setEd(null)} />}
    </section>
  );
}

// −/+ in steps of 10, drag on the number, or type it; Enter saves, Esc leaves it as it was
function CellEditor({ ed, gridRef, touch, onChange, onBump, onSave, onCancel }: { ed: { rid: string; d: string; v: string; start: number }; gridRef: React.RefObject<HTMLDivElement | null>; touch: boolean; onChange: (v: string) => void; onBump: (k: number) => void; onSave: () => void; onCancel: () => void }) {
  const data = useData(), rm = roomById(data, ed.rid)!;
  const ref = useRef<HTMLDivElement>(null), inp = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const td = gridRef.current?.querySelector(`td[data-r="${ed.rid}"][data-d="${ed.d}"]`), pop = ref.current; if (!td || !pop) return;
    const r = td.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    let y = r.bottom + 8; if (y + h > innerHeight - 8 || (touch && r.top > innerHeight * 0.4)) y = r.top - h - 8;   // above the cell, clear of the phone keyboard
    setPos({ left: Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)), top: Math.max(8, y) });
  }, [ed.rid, ed.d, gridRef, touch]);
  const bump = onBump;
  // drag on the number: 10 lei for every 8 pixels, up or right to raise it
  const onNumDown = (e: RPointerEvent<HTMLInputElement>) => {
    if (document.activeElement === inp.current) return;
    const y0 = e.clientY, x0 = e.clientX, v0 = Math.round(Number(ed.v)) || 0; let moved = false; e.preventDefault();
    const mv = (ev: PointerEvent) => { const dist = (y0 - ev.clientY) + (ev.clientX - x0); if (!moved && Math.abs(dist) < 4) return; moved = true; onChange(String(Math.max(0, v0 + Math.round(dist / 8) * 10))); };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); if (!moved) { inp.current?.focus(); inp.current?.select(); } };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  };
  return (
    <div className="cellpop" ref={ref} style={{ left: pos?.left ?? -9999, top: pos?.top ?? 0 }}>
      <div className="cp-h"><b>{rm.name}</b> · {fmtDL(ed.d)}</div>
      <div className="cp-row">
        <button type="button" className="cp-b" onClick={() => bump(-10)} aria-label="Scade 10 lei">−</button>
        <input ref={inp} className="cp-in" type="number" step={10} min={0} value={ed.v} onChange={e => onChange(e.target.value)} onPointerDown={onNumDown} aria-label="Preț pe noapte"
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onSave(); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); bump(e.key === 'ArrowUp' ? 10 : -10); } }} />
        <button type="button" className="cp-b" onClick={() => bump(10)} aria-label="Crește 10 lei">+</button>
      </div>
      <div className="cp-hint">Trage de preț în sus sau în jos (câte 10 lei) sau scrie-l direct. Prețul de bază: {rm.price} lei.</div>
      <div className="cp-ft"><button type="button" className="btn sm" onClick={() => { onChange(String(rm.price)); setTimeout(onSave, 0); }}>Prețul de bază</button><button type="button" className="btn sm primary" onClick={onSave}>Salvează</button></div>
    </div>
  );
}
