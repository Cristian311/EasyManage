'use client';
import { useMemo, useState } from 'react';
import { useData } from '@/lib/client/store';
import { fmtD } from '@/domain/dates';
import { guestName, roomLabel } from '@/domain/rules';
import type { Reservation } from '@/domain/types';
import { useGoToReservation } from '@/components/useGoToReservation';
import { IconSearch } from '@/components/Icons';

export default function GuestsPage() {
  const data = useData(), goTo = useGoToReservation();
  const [q, setQ] = useState('');
  const byGuest = useMemo(() => {
    const m = new Map<string, Reservation[]>();
    data.reservations.forEach(r => { const a = m.get(r.guestId) ?? []; a.push(r); m.set(r.guestId, a); });
    m.forEach(a => a.sort((x, y) => y.checkIn.localeCompare(x.checkIn)));
    return m;
  }, [data]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.guests.filter(g => !s || guestName(g).toLowerCase().includes(s) || g.phone.includes(s)).sort((a, b) => guestName(a).localeCompare(guestName(b), 'ro'));
  }, [data, q]);

  return (
    <section className="page on" id="page-guests">
      <div className="topbar"><h1>Oaspeți</h1><div className="spacer" /><div className="search"><IconSearch /><input placeholder="Caută…" value={q} onChange={e => setQ(e.target.value)} /></div></div>
      <div className="scroll">
        <div className="card tbl-wrap">
          <table className="t">
            <thead><tr><th>Nume</th><th>Telefon</th><th>Email</th><th>Țară</th><th className="r">Rezervări</th><th>Ultima ședere</th><th>Note</th></tr></thead>
            <tbody>
              {list.map(g => { const rs = byGuest.get(g.id) ?? [];
                return (
                  <tr key={g.id} onClick={() => rs[0] && goTo(rs[0])}>
                    <td data-l="Nume"><b>{guestName(g)}</b></td><td data-l="Telefon">{g.phone || '—'}</td><td data-l="Email">{g.email || '—'}</td><td data-l="Țară">{g.country || '—'}</td>
                    <td data-l="Rezervări" className="r">{rs.length}</td><td data-l="Ultima ședere">{rs[0] ? `${fmtD(rs[0].checkIn)} · ${roomLabel(data, rs[0])}` : '—'}</td>
                    <td data-l="Note" style={{ whiteSpace: 'normal', maxWidth: 260, color: 'var(--ink-2)' }}>{g.notes}</td>
                  </tr>
                ); })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
