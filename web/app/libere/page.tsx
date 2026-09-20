'use client';
// Răspunsul la „aveți loc între…?”, cât ține omul telefonul.
import { useMemo, useState } from 'react';
import { useData, useStore } from '@/lib/client/store';
import { addDays, fmtD, fmtDL, todayIso } from '@/domain/dates';
import { lei2 } from '@/domain/invoice';
import { availability } from '@/domain/availability';
import { shortProp } from '@/domain/rules';
import { IconPlus, IconSearch } from '@/components/Icons';

export default function FreeRoomsPage() {
  const data = useData(), openModal = useStore(s => s.openModal);
  const T = todayIso();
  const [from, setFrom] = useState(T), [to, setTo] = useState(addDays(T, 1));
  const [pax, setPax] = useState(0), [prop, setProp] = useState('all');
  const a = useMemo(() => availability(data, from, to, prop, pax), [data, from, to, prop, pax]);

  const setStart = (d: string) => { if (!d) return; setFrom(d); if (d >= to) setTo(addDays(d, 1)); };
  const quick = (days: number, off = 0) => { const s = addDays(T, off); setFrom(s); setTo(addDays(s, days)); };

  return (
    <section className="page on" id="page-free">
      <div className="topbar"><h1>Camere libere</h1><div className="spacer" />
        <div className="seg">
          <button onClick={() => quick(1)}>La noapte</button>
          <button onClick={() => quick(1, 1)}>Mâine</button>
          <button onClick={() => quick(2, 5 - new Date().getDay())}>Weekend</button>
        </div>
      </div>
      <div className="scroll">
        <div className="propbar">
          <span className="pb-l">Din</span>
          <input type="date" className="fsel" value={from} onChange={e => setStart(e.target.value)} />
          <span className="pb-l">până în dimineața zilei</span>
          <input type="date" className="fsel" value={to} min={addDays(from, 1)} onChange={e => e.target.value && setTo(e.target.value)} />
          <span className="sep" />
          <select className="fsel" value={pax} onChange={e => setPax(Number(e.target.value))} aria-label="Persoane">
            <option value={0}>Oricâte persoane</option>
            {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}+ {n === 1 ? 'persoană' : 'persoane'}</option>)}
          </select>
          {data.properties.length > 1 && <>
            <span className="sep" />
            <div className="seg">
              <button className={`all ${prop === 'all' ? 'on' : ''}`} onClick={() => setProp('all')}>Toate</button>
              {data.properties.map(p => <button key={p.id} className={prop === p.id ? 'on' : ''} onClick={() => setProp(p.id)}>{shortProp(p)}</button>)}
            </div>
          </>}
        </div>

        <div className="tiles">
          <div className={`tile ${a.free.length ? 'ok' : 'bad'}`}><label>Camere libere</label><b>{a.free.length}</b>
            <small>{a.nights} {a.nights === 1 ? 'noapte' : 'nopți'} · {fmtD(from)} → {fmtD(to)}</small></div>
          <div className="tile"><label>Locuri de dormit</label><b>{a.beds}</b><small>în camerele libere</small></div>
          <div className="tile"><label>Ocupate</label><b>{a.busy.length}</b><small>din {a.free.length + a.busy.length} camere</small></div>
          <div className="tile"><label>Cea mai ieftină</label><b>{a.free.length ? lei2(Math.min(...a.free.map(f => f.price))) : '—'}</b><small>pe toată perioada</small></div>
        </div>

        <div className="card" style={{ marginBottom: 14 }}>
          <div className="ch">Libere<span className="cnt">{a.free.length}</span></div>
          <div className="list">
            {a.free.length ? a.free.map(f => (
              <div className="li" key={f.room.id}>
                <div className="rm">{f.room.name}</div>
                <div className="nm">{f.room.type} · {f.room.capacity} {f.room.capacity === 1 ? 'loc' : 'locuri'}
                  <small>{[data.properties.length > 1 ? f.property : '', f.floor].filter(Boolean).join(' · ')}{f.room.desc ? ` · ${f.room.desc}` : ''}</small></div>
                <div className="amt" title={`${lei2(f.perNight)} pe noapte`}>{lei2(f.price)}</div>
                <button className="btn sm primary" onClick={() => openModal({ roomIds: [f.room.id], checkIn: from, checkOut: to })}><IconPlus />Rezervă</button>
              </div>
            )) : <div className="empty">Nicio cameră liberă pe toată perioada. Încearcă alte zile sau vezi mai jos când se eliberează.</div>}
          </div>
        </div>

        {a.busy.length > 0 && (
          <div className="card">
            <div className="ch">Ocupate<span className="cnt">{a.busy.length}</span></div>
            <div className="list">
              {a.busy.map(b => (
                <div className="li" key={b.room.id} style={{ cursor: 'default' }}>
                  <div className="rm">{b.room.name}</div>
                  <div className="nm">{b.blocked ? <i>{b.guest}</i> : b.guest}<small>{b.room.type} · {b.room.capacity} locuri</small></div>
                  <div className="amt" style={{ color: 'var(--ink-3)', fontWeight: 600 }}>{b.freeFrom ? `liberă din ${fmtD(b.freeFrom)}` : 'ocupată mult timp'}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="hint" style={{ margin: '10px 2px' }}>
          <IconSearch /> O cameră apare liberă doar dacă e liberă în toate nopțile alese. Prețul e cel din Tarife pentru zilele acelea, înainte de orice reducere.
          Ziua de plecare nu se socotește noapte, deci {fmtDL(to)} camera e deja liberă pentru altcineva.
        </p>
      </div>
    </section>
  );
}
