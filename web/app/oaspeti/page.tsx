'use client';
import { useMemo, useState } from 'react';
import { useData, useStore } from '@/lib/client/store';
import { idDoc } from '@/domain/register';
import { downloadCsv } from '@/lib/client/csv';
import { fmtD } from '@/domain/dates';
import { guestName, roomLabel } from '@/domain/rules';
import type { Reservation } from '@/domain/types';
import { useGoToReservation } from '@/components/useGoToReservation';
import { IconSearch } from '@/components/Icons';
import Table from '@/components/Table';

export default function GuestsPage() {
  const data = useData(), goTo = useGoToReservation(), openGuest = useStore(s => s.openGuest);
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
      <div className="topbar"><h1>Oaspeți</h1><div className="spacer" /><div className="search"><IconSearch /><input placeholder="Caută…" value={q} onChange={e => setQ(e.target.value)} /></div>
        <button className="btn" onClick={() => downloadCsv('oaspeti', list, [
          ['Prenume', g => g.firstName], ['Nume', g => g.lastName], ['Telefon', g => g.phone], ['Email', g => g.email], ['Țară', g => g.country],
          ['Act', g => idDoc(g)], ['Data nașterii', g => g.birthDate ?? ''], ['Cetățenia', g => g.citizenship ?? ''], ['Domiciliul', g => g.address ?? ''],
          ['Rezervări', g => (byGuest.get(g.id) ?? []).length], ['Ultima ședere', g => byGuest.get(g.id)?.[0]?.checkIn ?? ''], ['Note', g => g.notes],
        ])}>Descarcă Excel</button></div>
      <div className="scroll">
        <div className="card tbl-wrap">
          <Table rows={list} keyOf={g => g.id} onRow={g => { const rs = byGuest.get(g.id); if (rs?.[0]) goTo(rs[0]); }} empty="Niciun oaspete" cols={[
            { h: 'Nume', cell: g => <b>{guestName(g)}</b>, v: g => guestName(g) },
            { h: 'Telefon', cell: g => g.phone || '—', v: g => g.phone },
            { h: 'Email', cell: g => g.email || '—', v: g => g.email },
            { h: 'Țară', cell: g => g.country || '—', v: g => g.country },
            { h: 'Rezervări', r: true, cell: g => (byGuest.get(g.id) ?? []).length, v: g => (byGuest.get(g.id) ?? []).length },
            { h: 'Ultima ședere', cell: g => { const rs = byGuest.get(g.id); return rs?.[0] ? `${fmtD(rs[0].checkIn)} · ${roomLabel(data, rs[0])}` : '—'; }, v: g => byGuest.get(g.id)?.[0]?.checkIn ?? null },
            { h: 'Act', cell: g => idDoc(g) || '—', v: g => idDoc(g) },
            { h: 'Note', cell: g => g.notes, v: g => g.notes, style: { whiteSpace: 'normal', maxWidth: 260, color: 'var(--ink-2)' } },
            { h: '', r: true, cell: g => <button className="btn sm" onClick={e => { e.stopPropagation(); openGuest(g.id); }}>Editează</button> },
          ]} />
        </div>
      </div>
    </section>
  );
}
