'use client';
// Today at a glance, above the calendar: arrivals, departures, guests in, free rooms, money to collect.
import { useRouter } from 'next/navigation';
import { useMemo, type CSSProperties } from 'react';
import { useData, useStore } from '@/lib/client/store';
import { fmtDL, money, todayIso } from '@/domain/dates';
import { bookableRooms, isActiveRes, remaining } from '@/domain/rules';

export default function TodayBar() {
  const data = useData(), view = useStore(s => s.view);
  const router = useRouter();
  const chips = useMemo(() => {
    const T = todayIso(), act = data.reservations.filter(isActiveRes);
    const arr = act.filter(r => r.checkIn === T && r.status !== 'checked_out');
    const late = act.filter(r => (r.status === 'confirmed' || r.status === 'pending') && r.checkIn < T && r.checkOut > T);
    const dep = act.filter(r => r.checkOut === T && r.status !== 'checked_out');
    const inh = act.filter(r => r.status === 'checked_in');
    const rooms = bookableRooms(data, view), occ = new Set(act.filter(r => r.checkIn <= T && r.checkOut > T).flatMap(r => r.roomIds));
    const owed = act.filter(r => r.status !== 'checked_out' && r.checkIn <= T && remaining(r) > 0);
    const owedSum = owed.reduce((s, r) => s + remaining(r), 0);
    return [
      { t: 'Sosiri', n: arr.length + late.length, c: 'var(--st-confirmed)', warn: late.length > 0, right: '' },
      { t: 'Plecări', n: dep.length, c: 'var(--st-out)', warn: dep.some(r => remaining(r) > 0), right: '' },
      { t: 'Cazați', n: inh.length, c: 'var(--st-in)', warn: false, right: '' },
      { t: 'Libere', n: rooms.filter(r => !occ.has(r.id)).length, c: 'var(--line)', warn: false, right: '' },
      { t: 'De încasat', n: owed.length, c: 'var(--warn)', warn: owed.length > 0, right: owedSum ? money(owedSum) : '' },
    ];
  }, [data, view]);
  return (
    <div className="todaybar" id="todaybar">
      <span className="tb-d">{fmtDL(todayIso())}</span>
      {chips.map(c => (
        <button key={c.t} className={`tb-chip ${c.warn ? 'warn' : ''}`} onClick={() => router.push('/azi')}>
          <i style={{ '--c': c.c } as CSSProperties} />{c.t} <b>{c.n}</b>{c.right && <span style={{ color: 'var(--ink-3)' }}>· {c.right}</span>}
        </button>
      ))}
    </div>
  );
}
