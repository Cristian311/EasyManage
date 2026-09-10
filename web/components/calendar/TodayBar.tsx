'use client';
// Today at a glance, above the calendar: arrivals, departures, guests in, free rooms, money to collect.
import { useMemo, type CSSProperties } from 'react';
import { useData, useStore } from '@/lib/client/store';
import { addDays, fmtD, fmtDL, money, todayIso } from '@/domain/dates';
import { STATUS } from '@/domain/labels';
import type { MenuItem } from '@/lib/client/store';
import { bookableRooms, isActiveRes, rateFor, remaining, resGuest, roomLabel } from '@/domain/rules';
import type { Reservation } from '@/domain/types';

export default function TodayBar() {
  const data = useData(), view = useStore(s => s.view);
  const openMenu = useStore(s => s.openMenu), focusRes = useStore(s => s.focusRes), openModal = useStore(s => s.openModal);
  const chips = useMemo(() => {
    const T = todayIso(), act = data.reservations.filter(isActiveRes);
    const arr = act.filter(r => r.checkIn === T && r.status !== 'checked_out');
    const late = act.filter(r => (r.status === 'confirmed' || r.status === 'pending') && r.checkIn < T && r.checkOut > T);
    const dep = act.filter(r => r.checkOut === T && r.status !== 'checked_out');
    const inh = act.filter(r => r.status === 'checked_in');
    const rooms = bookableRooms(data, view), occ = new Set(act.filter(r => r.checkIn <= T && r.checkOut > T).flatMap(r => r.roomIds));
    const owed = act.filter(r => r.status !== 'checked_out' && r.checkIn <= T && remaining(r) > 0);
    const owedSum = owed.reduce((s, r) => s + remaining(r), 0);
    const item = (r: Reservation): MenuItem => ({ room: roomLabel(data, r), t: resGuest(data, r), s: `${fmtD(r.checkIn)} – ${fmtD(r.checkOut)} · ${STATUS[r.status]}${remaining(r) ? ' · rest ' + money(remaining(r)) : ''}`, go: () => focusRes(r.id) });
    const free = rooms.filter(r => !occ.has(r.id));
    return [
      { t: 'Sosiri', n: arr.length + late.length, c: 'var(--st-confirmed)', warn: late.length > 0, right: '', items: [...late, ...arr].map(item) },
      { t: 'Plecări', n: dep.length, c: 'var(--st-out)', warn: dep.some(r => remaining(r) > 0), right: '', items: dep.map(item) },
      { t: 'Cazați', n: inh.length, c: 'var(--st-in)', warn: false, right: '', items: inh.map(item) },
      { t: 'Libere', n: free.length, c: 'var(--line)', warn: false, right: '', items: free.map((rm): MenuItem => ({ room: rm.name, t: `${rm.type} · ${rm.capacity} pers · ${rateFor(data, rm.id, T)} lei`, s: 'Click: rezervare pentru azi', go: () => openModal({ roomIds: [rm.id], checkIn: T, checkOut: addDays(T, 1) }) })) },
      { t: 'De încasat', n: owed.length, c: 'var(--warn)', warn: owed.length > 0, right: owedSum ? money(owedSum) : '', items: owed.map(item) },
    ];
  }, [data, view, focusRes, openModal]);
  return (
    <div className="todaybar" id="todaybar">
      <span className="tb-d">{fmtDL(todayIso())}</span>
      {chips.map(c => (
        <button key={c.t} className={`tb-chip ${c.warn ? 'warn' : ''}`} onClick={e => { const rc = e.currentTarget.getBoundingClientRect(); openMenu({ x: rc.left, y: rc.bottom + 6, title: c.t, items: c.items, minWidth: 280 }); }}>
          <i style={{ '--c': c.c } as CSSProperties} />{c.t} <b>{c.n}</b>{c.right && <span style={{ color: 'var(--ink-3)' }}>· {c.right}</span>}
        </button>
      ))}
    </div>
  );
}
