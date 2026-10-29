'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Invoice } from '@/domain/invoice';
import { invoiceNo, lei2 } from '@/domain/invoice';
import { fmtDL } from '@/domain/dates';
import { monthName } from '@/domain/finance';
import { api } from '@/lib/client/api';
import { useStore } from '@/lib/client/store';
import { IconSearch } from '@/components/Icons';
import Table from '@/components/Table';
import { downloadCsv } from '@/lib/client/csv';

export default function InvoicesPage() {
  const toast = useStore(s => s.toast);
  const [list, setList] = useState<Invoice[]>([]);
  const [q, setQ] = useState(''), [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try { setList((await api<{ invoices: Invoice[] }>('/api/invoices')).invoices); }
    catch (e) { toast((e as Error).message, 'bad'); }
    finally { setLoaded(true); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const stornoed = useMemo(() => new Set(list.filter(i => i.stornoOf).map(i => i.stornoOf!)), [list]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return list.filter(i => !s || invoiceNo(i.series, i.number).toLowerCase().includes(s) || i.buyerName.toLowerCase().includes(s) || i.buyerTaxId.toLowerCase().includes(s));
  }, [list, q]);

  // totalurile lunii curente din listă: stornările intră cu minus, deci suma e cât s-a facturat cu adevărat
  const byMonth = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach(i => m.set(i.issuedOn.slice(0, 7), (m.get(i.issuedOn.slice(0, 7)) ?? 0) + Number(i.total)));
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  const storno = async (i: Invoice) => {
    if (!confirm(`Stornezi factura ${invoiceNo(i.series, i.number)}?\n\nSe emite o factură nouă, cu aceleași sume în minus. Factura veche rămâne în registru, cum cere legea.`)) return;
    try { setList((await api<{ invoices: Invoice[] }>(`/api/invoices/${i.id}/storno`, 'POST')).invoices); toast('Factură stornată', 'ok'); }
    catch (e) { toast((e as Error).message, 'bad'); }
  };

  return (
    <section className="page on">
      <div className="topbar"><h1>Facturi</h1><div className="spacer" /><div className="search"><IconSearch /><input placeholder="Caută număr, client, CUI…" value={q} onChange={e => setQ(e.target.value)} /></div>
        <button className="btn" disabled={!rows.length} onClick={() => downloadCsv('facturi', rows, [
          ['Număr', i => invoiceNo(i.series, i.number)], ['Data', i => i.issuedOn], ['Fel', i => (i.kind === 'storno' ? 'Stornare' : stornoed.has(i.id) ? 'Stornată' : 'Factură')],
          ['Client', i => i.buyerName], ['CUI / CNP', i => i.buyerTaxId], ['Adresă', i => i.buyerAddress],
          ['Fără TVA (lei)', i => Number(i.net)], ['TVA (lei)', i => Number(i.vat)], ['Total (lei)', i => Number(i.total)],
        ])}>Descarcă Excel</button></div>
      <div className="scroll">
        {loaded && !list.length ? (
          <div className="ph">
            <h2>Nicio factură încă</h2>
            <p>Facturile se emit dintr-o rezervare: deschide-o în calendar și apasă „Emite factură”. Întâi completează datele pensiunii în Setări.</p>
            <Link className="btn" href="/setari">Deschide Setări</Link>
          </div>
        ) : (
          <>
            {byMonth.length > 0 && (
              <div className="calc" style={{ marginBottom: 14, gridTemplateColumns: `repeat(${Math.min(4, byMonth.length)},1fr)` }}>
                {byMonth.slice(0, 4).map(([m, t]) => <div key={m}><label>{monthName(m)}</label><b>{lei2(t)}</b></div>)}
              </div>
            )}
            <div className="card tbl-wrap">
              <div className="ch">Registrul de facturi<span className="cnt">{rows.length}</span></div>
              <Table rows={rows} keyOf={i => i.id} empty="Nicio factură" initial={{ col: 1, dir: -1 }}
                rowClass={i => (i.kind === 'storno' ? 'uoff' : stornoed.has(i.id) ? 'uoff' : '')}
                cols={[
                  { h: 'Număr', v: i => `${i.series} ${String(i.number).padStart(6, '0')}`, cell: i => <Link href={`/facturi/${i.id}`}><b>{invoiceNo(i.series, i.number)}</b></Link> },
                  { h: 'Data', v: i => i.issuedOn, cell: i => fmtDL(i.issuedOn) },
                  { h: 'Client', v: i => i.buyerName, cell: i => i.buyerName },
                  { h: 'CUI / CNP', v: i => i.buyerTaxId, cell: i => i.buyerTaxId || '—' },
                  { h: 'Fel', v: i => i.kind, cell: i => (i.kind === 'storno' ? 'Stornare' : stornoed.has(i.id) ? 'Stornată' : 'Factură') },
                  { h: 'Total', r: true, v: i => Number(i.total), cell: i => lei2(Number(i.total)) },
                  {
                    h: '', r: true, style: { whiteSpace: 'nowrap' }, cell: i => (
                      <>
                        <Link className="btn sm" href={`/facturi/${i.id}`}>Deschide</Link>{' '}
                        {i.kind === 'invoice' && !stornoed.has(i.id) && <button className="btn sm danger" onClick={() => storno(i)}>Stornează</button>}
                      </>
                    ),
                  },
                ]} />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
