'use client';
// The list answers "what is coming?" first: upcoming stays, oldest arrival on top, grouped by the day they arrive.
import { useMemo, useState } from 'react';
import { useData, useStore } from '@/lib/client/store';
import { dayHeading, fmtD, money, todayIso } from '@/domain/dates';
import { SOURCES, SRC, STATUS, STATUSES } from '@/domain/labels';
import { alertFor, nights, remaining, resGuest, roomById, roomLabel, shortProp } from '@/domain/rules';
import type { Reservation } from '@/domain/types';
import { useGoToReservation } from '@/components/useGoToReservation';
import { IconPlus, IconSearch } from '@/components/Icons';
import Table, { type Col } from '@/components/Table';

type Seg = 'next' | 'in' | 'past' | 'cancelled' | 'all';
const SEGS: { k: Seg; t: string }[] = [
  { k: 'next', t: 'Viitoare' }, { k: 'in', t: 'În casă' }, { k: 'past', t: 'Trecute' }, { k: 'cancelled', t: 'Anulate' }, { k: 'all', t: 'Toate' },
];

/** The five groups never overlap, so the counts on the tabs add up. */
function inSeg(r: Reservation, s: Seg, T: string) {
  if (s === 'all') return true;
  if (r.status === 'cancelled') return s === 'cancelled';
  if (r.status === 'checked_in') return s === 'in';
  if (r.status === 'checked_out') return s === 'past';
  return r.checkOut >= T ? s === 'next' : s === 'past';   // never arrived: still to come, or a no-show
}

export default function ReservationsPage() {
  const data = useData(), openModal = useStore(s => s.openModal), goTo = useGoToReservation();
  const [q, setQ] = useState(''), [seg, setSeg] = useState<Seg>('next');
  const [prop, setProp] = useState('all'), [src, setSrc] = useState(''), [status, setStatus] = useState(''), [due, setDue] = useState(false);
  const T = todayIso();

  const found = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.reservations.filter(r => {
      if (prop !== 'all' && !r.roomIds.some(id => roomById(data, id)?.propertyId === prop)) return false;
      if (src && r.source !== src) return false;
      if (status && r.status !== status) return false;
      if (due && remaining(r) <= 0) return false;
      return !s || resGuest(data, r).toLowerCase().includes(s) || roomLabel(data, r).toLowerCase().includes(s) || r.invoiceNo.toLowerCase().includes(s);
    });
  }, [data, q, prop, src, status, due]);

  const counts = useMemo(() => {
    const c: Record<Seg, number> = { next: 0, in: 0, past: 0, cancelled: 0, all: 0 };
    found.forEach(r => { c.all++; SEGS.forEach(({ k }) => { if (k !== 'all' && inSeg(r, k, T)) c[k]++; }); });
    return c;
  }, [found, T]);

  // upcoming reads forwards from today; everything else reads backwards from the most recent
  const list = useMemo(() => {
    const l = found.filter(r => inSeg(r, seg, T));
    if (seg === 'next') return l.sort((a, b) => a.checkIn.localeCompare(b.checkIn) || a.checkOut.localeCompare(b.checkOut));
    if (seg === 'in') return l.sort((a, b) => a.checkOut.localeCompare(b.checkOut));
    return l.sort((a, b) => b.checkIn.localeCompare(a.checkIn));
  }, [found, seg, T]);
  const shown = list.slice(0, 300);

  const filtered = prop !== 'all' || !!src || !!status || due;
  const clear = () => { setProp('all'); setSrc(''); setStatus(''); setDue(false); };
  const cols: Col<Reservation>[] = [
    { h: 'Oaspete', v: r => resGuest(data, r), cell: r => { const a = alertFor(r, T); return <><b>{resGuest(data, r)}</b>{a && <span className={`rowal ${a.level}`} title={a.text} />}</>; } },
    { h: 'Cameră', cell: r => roomLabel(data, r), v: r => roomLabel(data, r) },
    { h: 'Check-in', cell: r => fmtD(r.checkIn), v: r => r.checkIn },
    { h: 'Check-out', cell: r => fmtD(r.checkOut), v: r => r.checkOut },
    { h: 'Nopți', r: true, cell: r => nights(r), v: r => nights(r) },
    { h: 'Sursă', cell: r => SRC[r.source], v: r => SRC[r.source] },
    { h: 'Status', cell: r => <span className={`pill ${r.status}`}><i />{STATUS[r.status]}</span>, v: r => STATUS[r.status] },
    { h: 'Total', r: true, cell: r => money(r.total), v: r => r.total },
    { h: 'Rest', r: true, cell: r => <span style={{ color: remaining(r) ? 'var(--bad)' : 'var(--ok)' }}>{remaining(r) ? money(remaining(r)) : '✓'}</span>, v: r => remaining(r) },
  ];
  if (seg !== 'next' && seg !== 'in') cols.push({ h: 'Factură', cell: r => r.invoiceNo || '—', v: r => r.invoiceNo });

  return (
    <section className="page on" id="page-reservations">
      <div className="topbar"><h1>Rezervări</h1><div className="spacer" />
        <div className="search"><IconSearch /><input placeholder="Nume, cameră, factură…" value={q} onChange={e => setQ(e.target.value)} /></div>
        <button className="btn primary" onClick={() => openModal()}><IconPlus />Rezervare nouă</button></div>
      <div className="scroll">
        <div className="propbar">
          <div className="seg segtabs">{SEGS.map(s => <button key={s.k} className={seg === s.k ? 'on' : ''} onClick={() => setSeg(s.k)}>{s.t}<b>{counts[s.k]}</b></button>)}</div>
          <span className="sep" />
          {data.properties.length > 1 && <>
            <div className="seg">
              <button className={`all ${prop === 'all' ? 'on' : ''}`} onClick={() => setProp('all')}>Toate</button>
              {data.properties.map(p => <button key={p.id} className={prop === p.id ? 'on' : ''} onClick={() => setProp(p.id)}>{shortProp(p)}</button>)}
            </div><span className="sep" />
          </>}
          <select className="fsel" value={src} onChange={e => setSrc(e.target.value)} aria-label="Sursă">
            <option value="">Orice sursă</option>{SOURCES.map(s => <option key={s} value={s}>{SRC[s]}</option>)}
          </select>
          <select className="fsel" value={status} onChange={e => setStatus(e.target.value)} aria-label="Status">
            <option value="">Orice status</option>{STATUSES.map(s => <option key={s} value={s}>{STATUS[s]}</option>)}
          </select>
          <button className={`tb-chip ${due ? 'on' : ''}`} onClick={() => setDue(!due)}>Doar cu rest de plată</button>
          {filtered && <button className="btn sm" onClick={clear}>Șterge filtrele</button>}
        </div>
        <div className="card tbl-wrap">
          <Table rows={shown} keyOf={r => r.id} onRow={goTo} cols={cols}
            empty={filtered || q ? 'Nicio rezervare pentru filtrele alese' : seg === 'next' ? 'Nicio rezervare care urmează' : 'Nicio rezervare'}
            // stays whose day has already passed (never checked in, or overstaying) go together on top, not under old dates
            group={seg === 'next' ? r => (r.checkIn < T ? 'late' : r.checkIn) : seg === 'in' ? r => (r.checkOut < T ? 'late' : r.checkOut) : undefined}
            groupHead={(k, n) => <>
              {k === 'late' ? <span className="late">{seg === 'in' ? 'Trebuiau să plece' : 'Trebuiau să sosească'}</span>
                : seg === 'in' ? `Pleacă ${dayHeading(k, T).toLowerCase()}` : dayHeading(k, T)}
              <span className="cnt">{n}</span></>} />
          {list.length > shown.length && <div className="empty">Se văd primele {shown.length} din {list.length}. Caută sau filtrează pentru restul.</div>}
        </div>
      </div>
    </section>
  );
}
