'use client';
import { useMemo, useState } from 'react';
import { useData, useStore } from '@/lib/client/store';
import { fmtD, money } from '@/domain/dates';
import { SRC, STATUS } from '@/domain/labels';
import { nights, remaining, resGuest, roomLabel } from '@/domain/rules';
import { useGoToReservation } from '@/components/useGoToReservation';
import { IconPlus, IconSearch } from '@/components/Icons';
import Link from 'next/link';
import Table from '@/components/Table';
import { downloadCsv } from '@/lib/client/csv';
import { paid } from '@/domain/rules';

export default function ReservationsPage() {
  const data = useData(), openModal = useStore(s => s.openModal), goTo = useGoToReservation();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.reservations.filter(r => !s || resGuest(data, r).toLowerCase().includes(s) || roomLabel(data, r).toLowerCase().includes(s))
      .sort((a, b) => b.checkIn.localeCompare(a.checkIn));
  }, [data, q]);
  const shown = list.slice(0, 300);   // the newest 300; search to find older ones

  return (
    <section className="page on" id="page-reservations">
      <div className="topbar"><h1>Rezervări</h1><div className="spacer" />
        <div className="search"><IconSearch /><input placeholder="Caută…" value={q} onChange={e => setQ(e.target.value)} /></div>
        <Link className="btn" href="/registru">Registrul turiștilor</Link>
        <Link className="btn" href="/import">Importă</Link>
        <button className="btn" onClick={() => downloadCsv('rezervari', list, [
          ['Oaspete', r => resGuest(data, r)], ['Cameră', r => roomLabel(data, r)], ['Check-in', r => r.checkIn], ['Check-out', r => r.checkOut],
          ['Nopți', r => nights(r)], ['Persoane', r => r.pax], ['Sursă', r => SRC[r.source]], ['Status', r => STATUS[r.status]],
          ['Total (lei)', r => r.total], ['Încasat (lei)', r => paid(r)], ['Rest (lei)', r => remaining(r)], ['Factură', r => r.invoiceNo], ['Observații', r => r.notes],
        ])}>Descarcă Excel</button>
        <button className="btn primary" onClick={() => openModal()}><IconPlus />Rezervare nouă</button></div>
      <div className="scroll">
        <div className="card tbl-wrap">
          <Table rows={shown} keyOf={r => r.id} onRow={goTo} empty="Nicio rezervare" cols={[
            { h: 'Oaspete', cell: r => <b>{resGuest(data, r)}</b>, v: r => resGuest(data, r) },
            { h: 'Cameră', cell: r => roomLabel(data, r), v: r => roomLabel(data, r) },
            { h: 'Check-in', cell: r => fmtD(r.checkIn), v: r => r.checkIn },
            { h: 'Check-out', cell: r => fmtD(r.checkOut), v: r => r.checkOut },
            { h: 'Nopți', r: true, cell: r => nights(r), v: r => nights(r) },
            { h: 'Sursă', cell: r => SRC[r.source], v: r => SRC[r.source] },
            { h: 'Status', cell: r => <span className={`pill ${r.status}`}><i />{STATUS[r.status]}</span>, v: r => STATUS[r.status] },
            { h: 'Total', r: true, cell: r => money(r.total), v: r => r.total },
            { h: 'Rest', r: true, cell: r => <span style={{ color: remaining(r) ? 'var(--bad)' : 'var(--ok)' }}>{remaining(r) ? money(remaining(r)) : '✓'}</span>, v: r => remaining(r) },
            { h: 'Factură', cell: r => r.invoiceNo || '—', v: r => r.invoiceNo },
          ]} />
          {list.length > shown.length && <div className="empty">Se văd cele mai noi {shown.length} din {list.length}. Caută după nume sau cameră pentru restul.</div>}
        </div>
      </div>
    </section>
  );
}
