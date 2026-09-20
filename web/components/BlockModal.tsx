'use client';
// Scoaterea unei camere din vânzare: reparații, zugrăvit, folosință proprie.
import { useState } from 'react';
import { useData, useStore } from '@/lib/client/store';
import { addDays, todayIso } from '@/domain/dates';
import { columns, conflict, propById } from '@/domain/rules';
import { IconClose } from './Icons';

const REASONS = ['Reparație', 'Zugrăvit', 'Curățenie generală', 'Folosință proprie', 'Nu se închiriază'];

export default function BlockModal() {
  const open = useStore(s => s.blockModal);
  return open ? <Form /> : null;
}

function Form() {
  const data = useData(), close = useStore(s => s.closeBlock), admin = useStore(s => s.admin), toast = useStore(s => s.toast);
  const T = todayIso();
  const [ids, setIds] = useState<string[]>([]), [from, setFrom] = useState(T), [to, setTo] = useState(addDays(T, 1));
  const [reason, setReason] = useState(REASONS[0]), [busy, setBusy] = useState(false);
  const rooms = columns(data, { prop: 'all', floor: 'all' }).map(c => c.room).filter(r => r.active);
  const toggle = (id: string) => setIds(x => (x.includes(id) ? x.filter(y => y !== id) : [...x, id]));

  const busyRooms = ids.map(id => ({ id, r: conflict(data, id, from, to) })).filter(x => x.r);
  const bad = !ids.length ? 'Alege cel puțin o cameră.' : to <= from ? 'Data de sfârșit trebuie să fie după cea de început.' : !reason.trim() ? 'Scrie motivul.'
    : busyRooms.length ? `${busyRooms.map(x => data.rooms.find(r => r.id === x.id)?.name).join(', ')}: ocupată în perioada aleasă.` : '';

  const submit = async () => {
    if (bad) { toast(bad, 'bad'); return; }
    setBusy(true);
    const err = await admin('POST', '/api/blocks', { roomIds: ids, checkIn: from, checkOut: to, reason: reason.trim() },
      `${ids.length === 1 ? 'Camera e blocată' : `${ids.length} camere blocate`}: ${reason.trim()}`);
    setBusy(false);
    if (!err) close();
  };

  return (
    <div className="overlay open" onPointerDown={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal" role="dialog" aria-label="Blochează camere">
        <div className="hd"><h2>Blochează camere</h2><div className="spacer" /><button className="btn icon ghost" onClick={close}><IconClose /></button></div>
        <div className="bd">
          <p style={{ margin: '0 0 12px', color: 'var(--ink-2)' }}>Camera apare ocupată în calendar și nimeni nu mai poate face o rezervare pe ea în zilele alese. Nu intră în încasări și nici în raportul de ocupare.</p>
          <div className="g2">
            <div className="f"><label>Din ziua</label><input type="date" value={from} onChange={e => { setFrom(e.target.value); if (e.target.value >= to) setTo(addDays(e.target.value, 1)); }} /></div>
            <div className="f"><label>Până în dimineața zilei</label><input type="date" value={to} min={addDays(from, 1)} onChange={e => setTo(e.target.value)} /></div>
          </div>
          <div className="f"><label>Motivul</label>
            <input list="block-reasons" value={reason} onChange={e => setReason(e.target.value)} placeholder="ex: zugrăvit" />
            <datalist id="block-reasons">{REASONS.map(x => <option key={x} value={x} />)}</datalist>
          </div>
          <div className="f"><label>Camerele ({ids.length} alese)</label>
            <div style={{ maxHeight: 260, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 9, padding: 8 }}>
              {data.properties.map(p => {
                const mine = rooms.filter(r => r.propertyId === p.id);
                return mine.length ? (
                  <div key={p.id} style={{ marginBottom: 6 }}>
                    <div className="sec-t" style={{ marginBottom: 4 }}>{propById(data, p.id)?.name}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {mine.map(r => {
                        const taken = !!conflict(data, r.id, from, to);
                        return (
                          <button key={r.id} className={`btn sm ${ids.includes(r.id) ? 'primary' : ''}`} onClick={() => toggle(r.id)}
                            title={taken ? 'Ocupată în perioada aleasă' : r.type} style={taken ? { opacity: 0.55 } : undefined}>
                            {r.name}{taken ? ' ·ocupată' : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null;
              })}
            </div>
          </div>
          {bad && ids.length > 0 && <div className="auth-err" style={{ marginTop: 10 }}>{bad}</div>}
        </div>
        <div className="ft"><button className="btn" onClick={close}>Renunță</button><button className="btn primary" onClick={submit} disabled={busy || !!bad}>Blochează</button></div>
      </div>
    </div>
  );
}
