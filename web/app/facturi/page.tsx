'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useData, useStore } from '@/lib/client/store';
import { fmtD, money, todayIso } from '@/domain/dates';
import { invoiceNo } from '@/domain/invoice';
import { resGuest, roomLabel } from '@/domain/rules';
import type { Invoice } from '@/domain/types';
import { IconPlus, IconSearch } from '@/components/Icons';
import Table from '@/components/Table';

const STATUS_L = { issued: 'Emisă', cancelled: 'Anulată' } as const;
const fmtDY = (s: string) => `${fmtD(s)} ${s.slice(0, 4)}`;

export default function InvoicesPage() {
  const data = useData(), openInv = useStore(s => s.openInvModal), router = useRouter();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.invoices.filter(i => !s || invoiceNo(i).toLowerCase().includes(s) || i.customer.name.toLowerCase().includes(s) || i.customer.cui.toLowerCase().includes(s))
      .sort((a, b) => b.issuedOn.localeCompare(a.issuedOn) || b.number - a.number);
  }, [data, q]);
  const month = todayIso().slice(0, 7), issued = data.invoices.filter(i => i.status === 'issued');
  const m = issued.filter(i => i.issuedOn.startsWith(month)), y = issued.filter(i => i.issuedOn.startsWith(month.slice(0, 4)));
  const sum = (a: Invoice[]) => a.reduce((t, i) => t + i.total, 0);
  const resOf = (i: Invoice) => (i.reservationId ? data.reservations.find(r => r.id === i.reservationId) : undefined);

  return (
    <section className="page on" id="page-invoices">
      <div className="topbar"><h1>Facturi</h1><div className="spacer" />
        <div className="search"><IconSearch /><input placeholder="Număr, client, CUI…" value={q} onChange={e => setQ(e.target.value)} /></div>
        <button className="btn primary" onClick={() => openInv(null)}><IconPlus />Factură nouă</button></div>
      <div className="scroll">
        <div className="tiles" style={{ marginBottom: 14 }}>
          <div className="tile"><label>Luna aceasta</label><b>{m.length}</b><small>{money(sum(m))}</small></div>
          <div className="tile"><label>Anul acesta</label><b>{y.length}</b><small>{money(sum(y))}</small></div>
          <div className="tile"><label>Următorul număr</label><b style={{ fontSize: 22 }}>{invoiceNo({ series: data.settings.invoiceSeries, number: data.settings.invoiceNext })}</b><small>{data.settings.name || 'Completează firma în Setări'}</small></div>
        </div>
        <div className="card tbl-wrap">
          <Table rows={list} keyOf={i => i.id} onRow={i => router.push(`/facturi/${i.id}`)} empty="Nicio factură încă. Emite prima din sertarul unei rezervări sau cu butonul de sus." cols={[
            { h: 'Număr', cell: i => <b>{invoiceNo(i)}</b>, v: i => i.number },
            { h: 'Data', cell: i => fmtDY(i.issuedOn), v: i => i.issuedOn },
            { h: 'Client', cell: i => i.customer.name, v: i => i.customer.name },
            { h: 'CUI', cell: i => i.customer.cui || '—', v: i => i.customer.cui },
            { h: 'Rezervare', cell: i => { const r = resOf(i); return r ? `${resGuest(data, r)} · ${roomLabel(data, r)} · ${fmtD(r.checkIn)} – ${fmtD(r.checkOut)}` : '—'; }, v: i => resOf(i)?.checkIn ?? null },
            { h: 'Total', r: true, cell: i => money(i.total), v: i => i.total },
            { h: 'Status', cell: i => <span className={`pill ${i.status === 'issued' ? 'paid' : 'cancelled'}`}><i />{STATUS_L[i.status]}</span>, v: i => STATUS_L[i.status] },
          ]} />
        </div>
      </div>
    </section>
  );
}
