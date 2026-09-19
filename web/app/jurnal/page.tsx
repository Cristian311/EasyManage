'use client';
// Jurnalul: cine a făcut ce și când. Numai pentru proprietar.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client/api';
import { downloadCsv } from '@/lib/client/csv';
import { useStore } from '@/lib/client/store';
import { IconSearch } from '@/components/Icons';
import Table from '@/components/Table';

interface Row { id: number; at: string; userName: string; action: string; entity: string; entityId: string; summary: string }

export default function AuditPage() {
  const toast = useStore(s => s.toast);
  const [rows, setRows] = useState<Row[]>([]), [actions, setActions] = useState<Record<string, string>>({}), [q, setQ] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      api<{ rows: Row[]; actions: Record<string, string> }>(`/api/audit?q=${encodeURIComponent(q)}`)
        .then(r => { setRows(r.rows); setActions(r.actions); }).catch(e => toast((e as Error).message, 'bad'));
    }, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q, toast]);

  const label = useMemo(() => (a: string) => actions[a] ?? a, [actions]);
  const when = (at: string) => { const [d, t] = at.split(' '); return `${d.split('-').reverse().join('.')} ${t?.slice(0, 5) ?? ''}`; };

  return (
    <section className="page on">
      <div className="topbar"><Link className="btn" href="/setari">‹ Setări</Link><h1 style={{ marginLeft: 10 }}>Jurnal</h1><div className="spacer" />
        <div className="search"><IconSearch /><input placeholder="Caută om, oaspete, cameră…" value={q} onChange={e => setQ(e.target.value)} /></div>
        <button className="btn" disabled={!rows.length} onClick={() => downloadCsv('jurnal', rows, [['Când', r => r.at], ['Cine', r => r.userName], ['Ce', r => label(r.action)], ['Detalii', r => r.summary]])}>Descarcă Excel</button>
      </div>
      <div className="scroll">
        <div className="card tbl-wrap">
          <div className="ch">Cine a făcut ce<span className="cnt">{rows.length === 500 ? 'ultimele 500' : rows.length}</span></div>
          <Table rows={rows} keyOf={r => String(r.id)} empty="Nimic în jurnal încă" cols={[
            { h: 'Când', v: r => r.at, cell: r => when(r.at), style: { whiteSpace: 'nowrap' } },
            { h: 'Cine', v: r => r.userName, cell: r => <b>{r.userName || '—'}</b> },
            { h: 'Ce', v: r => label(r.action), cell: r => label(r.action), style: { whiteSpace: 'nowrap' } },
            { h: 'Detalii', cell: r => r.summary, style: { whiteSpace: 'normal', color: 'var(--ink-2)' } },
          ]} />
        </div>
      </div>
    </section>
  );
}
