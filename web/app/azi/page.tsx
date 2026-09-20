'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client/api';
import { useData, useStore } from '@/lib/client/store';
import { fmtD, fmtDL, MONTHS, money, todayIso } from '@/domain/dates';
import { PAY_L, SRC } from '@/domain/labels';
import { isActiveRes, payStatus, remaining, resGuest, roomLabel } from '@/domain/rules';
import type { Reservation, Source } from '@/domain/types';
import { useGoToReservation } from '@/components/useGoToReservation';
import { IconPlus } from '@/components/Icons';

export default function TodayPage() {
  const data = useData(), openModal = useStore(s => s.openModal), goTo = useGoToReservation();
  const T = todayIso(), owner = useStore(s => s.me?.role === 'owner');
  const d = useMemo(() => {
    const act = data.reservations.filter(isActiveRes);
    const arr = act.filter(r => r.checkIn === T && r.status !== 'checked_out'), dep = act.filter(r => r.checkOut === T && r.status !== 'checked_out'), stay = act.filter(r => r.status === 'checked_in');
    const rooms = data.rooms.filter(r => r.active && !data.rooms.some(u => u.parentId === r.id)), occ = new Set(act.filter(r => r.checkIn <= T && r.checkOut > T).flatMap(r => r.roomIds));
    const owed = act.filter(r => remaining(r) > 0), m0 = T.slice(0, 7);
    const month = act.filter(r => r.checkIn.slice(0, 7) === m0).reduce((s, r) => s + Number(r.total), 0);
    const upcoming = act.filter(r => r.checkIn > T).sort((a, b) => a.checkIn.localeCompare(b.checkIn)).slice(0, 6);
    // venite din calendarul unui site: au doar nopțile, numele și prețul le pune omul
    const toFill = act.filter(r => r.checkOut > T && Number(r.total) === 0 && r.notes.startsWith('Adusă automat')).sort((a, b) => a.checkIn.localeCompare(b.checkIn));
    return { arr, dep, stay, rooms, occ, owed, month, upcoming, m0, toFill };
  }, [data, T]);
  const [problems, setProblems] = useState<{ roomName: string; source: Source; error: string }[]>([]);
  useEffect(() => { api<{ problems: typeof problems }>('/api/ical/problems').then(r => setProblems(r.problems)).catch(() => {}); }, [data]);   // eslint-disable-line react-hooks/exhaustive-deps

  const li = (r: Reservation) => (
    <div className="li" key={r.id} onClick={() => goTo(r)}>
      <div className="rm">{roomLabel(data, r)}</div>
      <div className="nm">{resGuest(data, r)}<small>{fmtD(r.checkIn)} – {fmtD(r.checkOut)} · {r.pax} pers · {SRC[r.source]}</small></div>
      <span className={`pill ${payStatus(r)}`}>{PAY_L[payStatus(r)]}</span>
      <div className="amt">{remaining(r) ? money(remaining(r)) : '✓'}</div>
    </div>
  );
  const card = (title: string, list: Reservation[], empty: string) => (
    <div className="card"><div className="ch">{title}<span className="cnt">{list.length}</span></div><div className="list">{list.length ? list.map(li) : <div className="empty">{empty}</div>}</div></div>
  );

  return (
    <section className="page on" id="page-today">
      <div className="topbar"><h1>Azi <small>{fmtDL(T)}</small></h1><div className="spacer" /><button className="btn primary" onClick={() => openModal()}><IconPlus />Rezervare nouă</button></div>
      <div className="scroll">
        {problems.length > 0 && (
          <div className="card" style={{ marginBottom: 14, padding: '12px 16px', borderColor: 'var(--bad)' }}>
            <b style={{ color: 'var(--bad)' }}>Calendarele de pe site-uri au nevoie de tine</b>
            {problems.map((p, i) => <div key={i} style={{ marginTop: 4 }}><b>{p.roomName}</b> · {SRC[p.source]}: {p.error}</div>)}
            {owner && <div style={{ marginTop: 8 }}><Link className="btn sm" href="/setari">Deschide Setări</Link></div>}
          </div>
        )}
        <div className="tiles">
          <div className="tile"><label>Sosiri azi</label><b>{d.arr.length}</b><small>{d.arr.filter(r => r.status === 'checked_in').length} deja cazate</small></div>
          <div className="tile"><label>Plecări azi</label><b>{d.dep.length}</b><small>{d.dep.filter(r => remaining(r) > 0).length} cu rest de plată</small></div>
          <div className="tile ok"><label>Camere ocupate</label><b>{d.occ.size}<span style={{ fontSize: 16, color: 'var(--ink-3)' }}> / {d.rooms.length}</span></b><small>{d.rooms.length ? Math.round((d.occ.size / d.rooms.length) * 100) : 0}% ocupare</small></div>
          <div className="tile"><label>Camere libere</label><b>{d.rooms.length - d.occ.size}</b><small>disponibile în această seară</small></div>
          <div className={`tile ${d.owed.length ? 'bad' : ''}`}><label>Solduri neîncasate</label><b>{money(d.owed.reduce((s, r) => s + remaining(r), 0))}</b><small>{d.owed.length} rezervări</small></div>
          <div className="tile"><label>Venit estimat {MONTHS[Number(d.m0.slice(5)) - 1]}</label><b>{money(d.month)}</b><small>după check-in în lună</small></div>
        </div>
        <div className="cols">
          {d.toFill.length > 0 && card('De completat: venite de pe site', d.toFill, '')}
          {card('Sosiri', d.arr, 'Nicio sosire azi')}
          {card('Plecări', d.dep, 'Nicio plecare azi')}
          {card('Cazați acum', d.stay, 'Nimeni cazat')}
          {card('Urmează', d.upcoming, 'Nicio rezervare viitoare')}
        </div>
      </div>
    </section>
  );
}
