'use client';
// Cât de plină a fost pensiunea, lună de lună.
import { useMemo, useState } from 'react';
import { useData } from '@/lib/client/store';
import { MONTHS_L, todayIso } from '@/domain/dates';
import { lei2 } from '@/domain/invoice';
import { occupancyByMonth, yearTotal, type MonthRow } from '@/domain/occupancy';
import { shortProp } from '@/domain/rules';
import { downloadCsv } from '@/lib/client/csv';
import Table from '@/components/Table';

const pct = (n: number) => n.toLocaleString('ro-RO', { maximumFractionDigits: 1 }) + '%';
const bar = (n: number) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
    <div style={{ flex: 1, maxWidth: 90, height: 7, borderRadius: 4, background: 'var(--surface-3)', overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, n)}%`, height: '100%', background: n >= 70 ? 'var(--ok)' : n >= 40 ? 'var(--accent)' : 'var(--warn)' }} />
    </div>
    <b style={{ minWidth: 48, textAlign: 'right' }}>{pct(n)}</b>
  </div>
);

export default function OccupancyPage() {
  const data = useData();
  const thisYear = Number(todayIso().slice(0, 4));
  const [year, setYear] = useState(thisYear), [prop, setProp] = useState('all');
  const rows = useMemo(() => occupancyByMonth(data, year, prop), [data, year, prop]);
  const tot = useMemo(() => yearTotal(rows), [rows]);
  const name = (r: MonthRow) => MONTHS_L[Number(r.month.slice(5)) - 1];
  const years = [thisYear + 1, thisYear, thisYear - 1, thisYear - 2];

  return (
    <section className="page on" id="page-occupancy">
      <div className="topbar"><h1>Ocupare <small>{year}</small></h1><div className="spacer" />
        <div className="seg">{years.map(y => <button key={y} className={year === y ? 'on' : ''} onClick={() => setYear(y)}>{y}</button>)}</div>
        <button className="btn" onClick={() => downloadCsv(`ocupare-${year}`, rows, [
          ['Luna', r => name(r)], ['Camere', r => r.rooms], ['Nopți disponibile', r => r.nights], ['Nopți blocate', r => r.blocked],
          ['Nopți vândute', r => r.sold], ['Ocupare (%)', r => r.occupancy], ['Venit (lei)', r => r.revenue],
          ['Preț mediu pe noapte (lei)', r => r.adr], ['Venit pe cameră disponibilă (lei)', r => r.revpar], ['Sosiri', r => r.arrivals],
        ])}>Descarcă Excel</button>
      </div>
      <div className="scroll">
        {data.properties.length > 1 && (
          <div className="propbar"><div className="seg">
            <button className={`all ${prop === 'all' ? 'on' : ''}`} onClick={() => setProp('all')}>Toate</button>
            {data.properties.map(p => <button key={p.id} className={prop === p.id ? 'on' : ''} onClick={() => setProp(p.id)}>{shortProp(p)}</button>)}
          </div></div>
        )}
        <div className="tiles">
          <div className="tile"><label>Ocupare în {year}</label><b>{pct(tot.occupancy)}</b><small>{tot.sold} din {tot.nights} nopți-cameră</small></div>
          <div className="tile ok"><label>Venit din cazare</label><b>{lei2(tot.revenue)}</b><small>împărțit pe nopți, nu pe încasări</small></div>
          <div className="tile"><label>Preț mediu pe noapte</label><b>{lei2(tot.adr)}</b><small>la nopțile vândute</small></div>
          <div className="tile"><label>Venit pe cameră disponibilă</label><b>{lei2(tot.revpar)}</b><small>{tot.rooms} camere</small></div>
        </div>
        <div className="card tbl-wrap">
          <div className="ch">Lună de lună<span className="cnt">{tot.arrivals} sosiri</span></div>
          <Table rows={rows} keyOf={r => r.month} empty="Nimic în anul acesta" cols={[
            { h: 'Luna', v: r => r.month, cell: r => <b>{name(r)}</b> },
            { h: 'Ocupare', r: true, v: r => r.occupancy, cell: r => bar(r.occupancy), style: { minWidth: 160 } },
            { h: 'Nopți vândute', r: true, v: r => r.sold, cell: r => r.sold },
            { h: 'Din care se puteau vinde', r: true, v: r => r.nights, cell: r => r.nights },
            { h: 'Blocate', r: true, v: r => r.blocked, cell: r => r.blocked || '—' },
            { h: 'Sosiri', r: true, v: r => r.arrivals, cell: r => r.arrivals },
            { h: 'Venit', r: true, v: r => r.revenue, cell: r => lei2(r.revenue) },
            { h: 'Preț mediu', r: true, v: r => r.adr, cell: r => (r.adr ? lei2(r.adr) : '—') },
          ]} foot={
            <tr><td><b>Tot anul</b></td><td className="r">{bar(tot.occupancy)}</td><td className="r">{tot.sold}</td><td className="r">{tot.nights}</td>
              <td className="r">{tot.blocked || '—'}</td><td className="r">{tot.arrivals}</td><td className="r"><b>{lei2(tot.revenue)}</b></td><td className="r">{tot.adr ? lei2(tot.adr) : '—'}</td></tr>
          } />
        </div>
        <p className="hint" style={{ margin: '10px 2px' }}>
          Nopțile care se puteau vinde sunt socotite cu camerele active de azi, pentru că programul nu ține minte de când există fiecare cameră.
          Venitul e prețul rezervărilor împărțit pe nopți, nu banii încasați în luna aceea; pe aceia îi vezi în Financiar.
        </p>
      </div>
    </section>
  );
}
