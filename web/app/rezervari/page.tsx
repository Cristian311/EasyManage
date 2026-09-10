'use client';
import { useMemo, useState } from 'react';
import { useData, useStore } from '@/lib/client/store';
import { fmtD, money } from '@/domain/dates';
import { SRC, STATUS } from '@/domain/labels';
import { nights, remaining, resGuest, roomLabel } from '@/domain/rules';
import { useGoToReservation } from '@/components/useGoToReservation';
import { IconPlus, IconSearch } from '@/components/Icons';

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
        <button className="btn primary" onClick={() => openModal()}><IconPlus />Rezervare nouă</button></div>
      <div className="scroll">
        <div className="card tbl-wrap">
          <table className="t">
            <thead><tr><th>Oaspete</th><th>Cameră</th><th>Check-in</th><th>Check-out</th><th>Nopți</th><th>Sursă</th><th>Status</th><th className="r">Total</th><th className="r">Rest</th><th>Factură</th></tr></thead>
            <tbody>
              {shown.map(r => (
                <tr key={r.id} onClick={() => goTo(r)}>
                  <td data-l="Oaspete"><b>{resGuest(data, r)}</b></td><td data-l="Cameră">{roomLabel(data, r)}</td><td data-l="Check-in">{fmtD(r.checkIn)}</td><td data-l="Check-out">{fmtD(r.checkOut)}</td>
                  <td data-l="Nopți" className="r">{nights(r)}</td><td data-l="Sursă">{SRC[r.source]}</td><td data-l="Status"><span className={`pill ${r.status}`}><i />{STATUS[r.status]}</span></td>
                  <td data-l="Total" className="r">{money(r.total)}</td>
                  <td data-l="Rest" className="r" style={{ color: remaining(r) ? 'var(--bad)' : 'var(--ok)' }}>{remaining(r) ? money(remaining(r)) : '✓'}</td>
                  <td data-l="Factură">{r.invoiceNo || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.length && <div className="empty">Nicio rezervare</div>}
          {list.length > shown.length && <div className="empty">Se văd cele mai noi {shown.length} din {list.length}. Caută după nume sau cameră pentru restul.</div>}
        </div>
      </div>
    </section>
  );
}
