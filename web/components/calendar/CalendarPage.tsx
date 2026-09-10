'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useData, useStore } from '@/lib/client/store';
import { addDays, todayIso } from '@/domain/dates';
import { propById, floorById } from '@/domain/rules';
import { IconFull, IconJump, IconNext, IconPlus, IconPrev, IconSearch } from '../Icons';
import Chart from './Chart';
import PropBar from './PropBar';
import TodayBar from './TodayBar';

export default function CalendarPage() {
  const data = useData();
  const view = useStore(s => s.view), setView = useStore(s => s.setView), jumpTo = useStore(s => s.jumpTo), openModal = useStore(s => s.openModal);
  const focus = useStore(s => s.focus), setFocus = useStore(s => s.setFocus);
  const [period, setPeriod] = useState('');
  const onPeriod = useCallback((p: string) => setPeriod(p), []);
  const jumpRef = useRef<HTMLInputElement>(null);
  const setZoom = (z: number) => setView({ zoom: Math.min(1.6, Math.max(0.5, Math.round(z * 20) / 20)) });
  const shift = (n: number) => setView({ start: addDays(view.start, n), extra: 0, jump: view.jump + 1 });
  const pickDate = () => { const d = jumpRef.current; if (!d) return; d.value = view.start; try { d.showPicker(); } catch { d.click(); } };

  // calendar only: hides the menu and the bars; also asks the browser for full screen when it allows it
  const enterFocus = () => { setFocus(true); document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {}); };
  const exitFocus = () => { setFocus(false); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };

  // keyboard: N new booking, T today, ← → one week, + − zoom, Esc leaves full screen
  const K = useRef({ view, focus }); K.current = { view, focus };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const s = useStore.getState();
      if (e.key === 'Escape' && K.current.focus && !s.modal && !s.drawerId) { exitFocus(); return; }
      if (/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName) || s.modal || e.ctrlKey || e.metaKey || e.altKey) return;
      const v = K.current.view;
      if (e.key === 'n' || e.key === 'N') openModal();
      else if (e.key === 't' || e.key === 'T') jumpTo(todayIso());
      else if (e.key === 'ArrowLeft') setView({ start: addDays(v.start, -7), extra: 0, jump: v.jump + 1 });
      else if (e.key === 'ArrowRight') setView({ start: addDays(v.start, 7), extra: 0, jump: v.jump + 1 });
      else if (e.key === '+' || e.key === '=') setView({ zoom: Math.min(1.6, v.zoom + 0.1) });
      else if (e.key === '-') setView({ zoom: Math.max(0.5, v.zoom - 0.1) });
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (useStore.getState().focus) setFocus(false); }, [setFocus]);   // leaving the page leaves full screen

  const p = propById(data, view.prop);
  const sub = p ? `${p.name}${p.city ? ' · ' + p.city : ''}${view.floor !== 'all' ? ' · ' + (floorById(data, view.floor)?.name || '') : ''}` : `${data.properties.length} proprietăți`;
  const zoomLbl = `${Math.round(view.zoom * 100)}%`;

  return (
    <section className="page on" id="page-calendar">
      <div className="topbar">
        <h1>Calendar <small>{sub}</small></h1>
        <div className="spacer" />
        <div className="search"><IconSearch /><input placeholder="Caută oaspete…" value={view.q} onChange={e => setView({ q: e.target.value })} /></div>
        <button className="btn icon" onClick={() => shift(-7)} title="Săptămâna anterioară"><IconPrev /></button>
        <button className="btn" onClick={() => jumpTo(todayIso())}>Azi</button>
        <button className="btn icon" onClick={() => shift(7)} title="Săptămâna următoare"><IconNext /></button>
        <label className="period num" onClick={pickDate} title="Click: sari la o dată" style={{ cursor: 'pointer' }}>{period}</label>
        <button className="btn icon" onClick={pickDate} title="Sari la o dată"><IconJump /></button>
        <input type="date" ref={jumpRef} style={{ width: 0, height: 0, opacity: 0, position: 'absolute', pointerEvents: 'none' }} onChange={e => { if (e.target.value) jumpTo(e.target.value); }} />
        <div className="seg zoom2" title="Zoom calendar"><button onClick={() => setZoom(view.zoom - 0.1)} aria-label="Micșorează">−</button><button onClick={() => setZoom(view.zoom + 0.1)} aria-label="Mărește">+</button></div>
        <button className="btn icon" id="focusBtn" onClick={enterFocus} title="Ecran complet: doar calendarul" aria-label="Ecran complet"><IconFull /></button>
        <button className="btn primary" id="newResBtn" onClick={() => openModal()}><IconPlus />Rezervare nouă <span className="kbd kbd-hint" style={{ color: 'rgba(255,255,255,.8)', borderColor: 'rgba(255,255,255,.4)', background: 'transparent' }}>N</span></button>
      </div>
      <div className="chart-wrap">
        <PropBar />
        <TodayBar />
        <div className="legend" style={{ padding: '0 2px 10px' }}>
          <span><i style={{ background: 'var(--src-booking)' }} />Booking.com</span>
          <span><i style={{ background: 'var(--src-travelminit)' }} />Travelminit</span>
          <span><i style={{ background: 'var(--src-airbnb)' }} />Airbnb</span>
          <span><i style={{ background: 'var(--src-direct)' }} />Direct / telefon</span>
          <span><i style={{ background: 'var(--src-due)' }} />De cazat !</span>
          <span><i style={{ background: 'transparent', outline: '1.5px dashed var(--ink-3)', outlineOffset: '-1.5px' }} />În așteptare</span>
          <span><i style={{ background: 'repeating-linear-gradient(135deg,transparent 0 2px,var(--st-cancel) 2px 4px)' }} />Anulată</span>
          <span style={{ fontWeight: 700, color: 'var(--ink-2)' }}>1 rând = 1 noapte (data sosirii)</span>
          <span style={{ marginLeft: 'auto', color: 'var(--ink-3)' }} className="hint-long">Derulează pentru alte zile · trage blocul ca să-l muți · marginea de jos prelungește · trage pe celule goale pentru o rezervare nouă</span>
          <div className="seg" id="zoomSeg" title="Zoom (Ctrl + rotiță sau tastele + / −)" style={{ marginLeft: 6 }}>
            <button onClick={() => setZoom(view.zoom - 0.1)} aria-label="Micșorează" style={{ padding: '4px 9px' }}>−</button>
            <button className="num" onClick={() => setZoom(1)} style={{ minWidth: 48, padding: '4px 6px' }}>{zoomLbl}</button>
            <button onClick={() => setZoom(view.zoom + 0.1)} aria-label="Mărește" style={{ padding: '4px 9px' }}>+</button>
          </div>
        </div>
        <Chart onPeriod={onPeriod} />
        <div className="focusbar" id="focusBar">
          <button onClick={() => setZoom(view.zoom - 0.1)} aria-label="Micșorează">−</button><span className="num">{zoomLbl}</span>
          <button onClick={() => setZoom(view.zoom + 0.1)} aria-label="Mărește">+</button><button id="focusExit" onClick={exitFocus}>Ieși</button>
        </div>
      </div>
    </section>
  );
}
