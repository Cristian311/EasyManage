'use client';
// Foaia de curățenie a unei zile, de tipărit sau de arătat pe telefon menajerei.
import { useMemo, useState } from 'react';
import { useData } from '@/lib/client/store';
import { addDays, fmtD, fmtDL, todayIso } from '@/domain/dates';
import { CLEAN_L, CLEAN_ORDER, cleaningList } from '@/domain/housekeeping';
import { shortProp } from '@/domain/rules';
import { IconPrint } from '@/components/Icons';

export default function CleaningPage() {
  const data = useData(), T = todayIso();
  const [day, setDay] = useState(T), [prop, setProp] = useState('all');
  const rows = useMemo(() => cleaningList(data, day, prop), [data, day, prop]);
  const title = day === T ? 'azi' : day === addDays(T, 1) ? 'mâine' : '';

  return (
    <section className="page on" id="page-cleaning">
      <div className="topbar noprint"><h1>Curățenie <small>{fmtDL(day)}</small></h1><div className="spacer" />
        <div className="seg"><button className={day === T ? 'on' : ''} onClick={() => setDay(T)}>Azi</button><button className={day === addDays(T, 1) ? 'on' : ''} onClick={() => setDay(addDays(T, 1))}>Mâine</button></div>
        <input type="date" value={day} onChange={e => { if (e.target.value) setDay(e.target.value); }} style={{ border: '1px solid var(--line)', borderRadius: 9, padding: '6px 9px', background: 'var(--surface)' }} />
        <button className="btn primary" onClick={() => window.print()}><IconPrint />Tipărește</button>
      </div>
      <div className="scroll">
        {data.properties.length > 1 && (
          <div className="propbar noprint"><div className="seg">
            <button className={`all ${prop === 'all' ? 'on' : ''}`} onClick={() => setProp('all')}>Toate</button>
            {data.properties.map(p => <button key={p.id} className={prop === p.id ? 'on' : ''} onClick={() => setProp(p.id)}>{shortProp(p)}</button>)}
          </div></div>
        )}
        <div className="invoice sheet wide">
          <header><div><div className="big">Curățenie {title && `${title}, `}{fmtDL(day)}</div>{rows.length} {rows.length === 1 ? 'cameră' : 'camere'} de făcut</div></header>
          {!rows.length && <p className="fnote">Nicio plecare, nicio sosire și nimeni cazat în ziua aceasta.</p>}
          {CLEAN_ORDER.map(k => { const list = rows.filter(r => r.kind === k); return list.length ? (
            <div key={k} style={{ marginTop: 18 }}>
              <div className="lbl">{CLEAN_L[k]} · {list.length}</div>
              {/* lățimi fixe, ca în cele patru tabele coloanele să cadă una sub alta */}
              <table className="inv-t" style={{ tableLayout: 'fixed' }}>
                <thead><tr><th style={{ width: 28 }}>✓</th><th style={{ width: '15%' }}>Cameră</th><th style={{ width: '19%' }}>Unde</th><th style={{ width: '16%' }}>Pleacă</th><th style={{ width: '27%' }}>Vine / stă</th><th>Observații</th></tr></thead>
                <tbody>{list.map(r => (
                  <tr key={r.roomId}>
                    <td><span style={{ display: 'inline-block', width: 15, height: 15, border: '1.5px solid var(--ink-3)', borderRadius: 3 }} /></td>
                    <td><b>{r.room}</b> <span style={{ color: 'var(--ink-3)' }}>{r.type}</span></td>
                    <td>{[data.properties.length > 1 ? r.property : '', r.floor].filter(Boolean).join(' · ')}</td>
                    <td>{r.leaving || '—'}</td>
                    <td>{r.kind === 'out' ? '—' : <>{r.arriving || 'rămâne'} · {r.pax} pers. · până {fmtD(r.until)}</>}</td>
                    <td style={{ whiteSpace: 'normal' }}>{r.notes}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : null; })}
        </div>
      </div>
    </section>
  );
}
