'use client';
// New or edited reservation. The total follows the rates night by night until you type your own.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useData, useStore } from '@/lib/client/store';
import { addDays, diffDays, fmtD, money, todayIso } from '@/domain/dates';
import { SRC, STATUS } from '@/domain/labels';
import { conflictAny, guestById, guestName, paid, rateFor, resGuest, roomById, roomLabel, stayPrice, validateReservation } from '@/domain/rules';
import type { Guest, Source, Status } from '@/domain/types';
import { IconClose } from './Icons';

export default function ResModal() {
  const modal = useStore(s => s.modal);
  return modal ? <Form key={`${modal.editId ?? 'new'}:${JSON.stringify(modal.pre)}`} /> : null;
}

function Form() {
  const data = useData();
  const modal = useStore(s => s.modal)!, close = useStore(s => s.closeModal), create = useStore(s => s.createReservation), patch = useStore(s => s.patchReservation);
  const toast = useStore(s => s.toast), openDrawer = useStore(s => s.openDrawer);
  const edit = modal.editId ? data.reservations.find(x => x.id === modal.editId) ?? null : null;
  const firstRoom = data.rooms.find(r => r.active && !data.rooms.some(u => u.parentId === r.id));

  const [guest, setGuest] = useState<Guest | null>(edit ? guestById(data, edit.guestId) ?? null : null);
  const [gq, setGq] = useState(''), [ddOpen, setDdOpen] = useState(false);
  const [rooms, setRooms] = useState<string[]>(edit ? edit.roomIds : modal.pre?.roomIds?.length ? modal.pre.roomIds : firstRoom ? [firstRoom.id] : []);
  const [checkIn, setIn] = useState(edit?.checkIn ?? modal.pre?.checkIn ?? todayIso());
  const [checkOut, setOut] = useState(edit?.checkOut ?? modal.pre?.checkOut ?? addDays(modal.pre?.checkIn ?? todayIso(), 1));
  const initPax = () => { const rs = rooms.map(id => roomById(data, id)).filter(Boolean); return rs.length > 1 ? rs.reduce((t, x) => t + x!.capacity, 0) : Math.min(2, rs[0]?.capacity ?? 2); };
  const [pax, setPax] = useState(String(edit?.pax ?? initPax()));
  const [rate, setRate] = useState(''), [total, setTotal] = useState(edit ? String(edit.total) : '');
  const [rateManual, setRateManual] = useState(false), [totalManual, setTotalManual] = useState(!!edit);
  const [advance, setAdvance] = useState('0');
  const [source, setSource] = useState<Source>(edit?.source ?? 'direct'), [status, setStatus] = useState<Status>(edit?.status ?? 'confirmed'), [notes, setNotes] = useState(edit?.notes ?? '');
  const [more, setMore] = useState(!!edit && (!!edit.notes || edit.source !== 'direct' || edit.status !== 'confirmed'));
  const [error, setError] = useState(''), [saving, setSaving] = useState(false);
  const guestInput = useRef<HTMLInputElement>(null);

  const n = diffDays(checkIn, checkOut), okN = Number.isFinite(n) && n >= 1;
  const sp = okN && rooms.length ? stayPrice(data, rooms, checkIn, checkOut) : 0;
  const varies = okN && rooms.some(id => { const f = rateFor(data, id, checkIn); for (let d = checkIn; d < checkOut; d = addDays(d, 1)) if (rateFor(data, id, d) !== f) return true; return false; });
  // the automatic price: follows rooms and dates until the receptionist types a total
  useEffect(() => {
    if (!okN || totalManual) return;
    if (rateManual) setTotal(String((Number(rate) || 0) * n));
    else { setRate(String(Math.round(sp / n))); setTotal(String(sp)); }
  }, [rooms.join(), checkIn, checkOut]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (edit && okN) setRate(String(Math.round(edit.total / n))); setTimeout(() => (guest ? null : guestInput.current?.focus()), 50); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const totalN = Number(total) || 0, paidN = edit ? paid(edit) : Number(advance) || 0, rem = Math.max(0, totalN - paidN);
  const clash = okN ? conflictAny(data, rooms, checkIn, checkOut, edit?.id ?? null) : null;
  const shown = error || (clash ? `${roomLabel(data, clash)} este ocupată: ${resGuest(data, clash)}, ${fmtD(clash.checkIn)} – ${fmtD(clash.checkOut)}. Alege altă cameră sau altă perioadă.` : '');
  const hits = useMemo(() => {
    const q = gq.trim().toLowerCase(); if (!q) return [];
    return data.guests.filter(g => guestName(g).toLowerCase().includes(q) || g.phone.replace(/\s/g, '').includes(q.replace(/\s/g, ''))).slice(0, 6);
  }, [gq, data.guests]);
  const freeRooms = data.rooms.filter(r => r.active && !rooms.includes(r.id) && !data.rooms.some(u => u.parentId === r.id));

  const save = async () => {
    setError('');
    if (!guest && !gq.trim()) { setError('Alege sau scrie numele oaspetelui.'); return; }
    if (edit && !guest) { setError('Alege un oaspete din listă.'); return; }
    const fields = { roomIds: rooms, checkIn, checkOut, pax: Number(pax) || 0, total: totalN, source, status, notes: notes.trim() };
    const err = validateReservation(fields); if (err) { setError(err); return; }
    if (clash) { setError(shown); return; }
    setSaving(true);
    if (edit) {
      const e = await patch(edit.id, { ...fields, guestId: guest!.id }, { quiet: true });
      setSaving(false); if (e) { setError(e); return; }
      toast('Rezervare actualizată', 'ok'); close(); openDrawer(edit.id);
    } else {
      const e = await create({ ...fields, guestId: guest?.id, guestName: guest ? undefined : gq.trim(), advance: Number(advance) || 0 });
      setSaving(false); if (e) { setError(e); return; }
      toast(`Rezervare creată: ${guest ? guestName(guest) : gq.trim()}, ${rooms.map(id => roomById(data, id)?.name).join(' + ')}`, 'ok'); close();
    }
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });

  const totalHint = totalManual ? 'Preț introdus manual' : okN ? (rateManual || !varies ? `${Number(rate) || 0} × ${n} ${n === 1 ? 'noapte' : 'nopți'}, îl poți modifica` : 'după tarifele fiecărei nopți, îl poți modifica') : 'Se calculează, dar îl poți scrie tu';
  const rateHint = [rooms.length > 1 ? 'suma camerelor' : '', varies && !rateManual ? 'medie, prețul variază pe nopți' : ''].filter(Boolean).join(' · ');

  return (
    <div className="overlay open" onPointerDown={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal" role="dialog" aria-labelledby="resTitle">
        <div className="hd"><h2 id="resTitle">{edit ? 'Editează rezervarea' : 'Rezervare nouă'}</h2><div className="spacer" /><button className="btn icon ghost" onClick={close}><IconClose /></button></div>
        <div className="bd">
          <div className={`alert ${shown ? 'on' : ''}`}>{shown}</div>
          <div className="f gs">
            <label>Oaspete</label>
            {guest ? <div><span className="chip">{guestName(guest)} · {guest.phone}<button onClick={() => { setGuest(null); setGq(''); setTimeout(() => guestInput.current?.focus(), 0); }} title="Schimbă">×</button></span></div>
              : <input ref={guestInput} placeholder="Caută după nume sau telefon… sau scrie un nume nou" autoComplete="off" value={gq}
                  onChange={e => { setGq(e.target.value); setDdOpen(!!e.target.value.trim()); }} />}
            <div className={`dd ${ddOpen && !guest ? 'open' : ''}`}>
              {hits.map(g => <button type="button" key={g.id} onClick={() => { setGuest(g); setDdOpen(false); }}>{guestName(g)}
                <small>{g.phone} · {g.country} · {data.reservations.filter(r => r.guestId === g.id).length} rezervări</small></button>)}
              <button type="button" className="new" onClick={() => setDdOpen(false)}>+ Oaspete nou: „{gq.trim()}”</button>
            </div>
          </div>
          <div className="f">
            <label>Camere <span className="hint" style={{ fontWeight: 500, marginLeft: 6 }}>{rooms.length > 1 ? `${rooms.length} camere, o singură rezervare și o singură plată` : ''}</span></label>
            <div className="roomchips">
              {rooms.map(id => { const rm = roomById(data, id); return rm && <span className="rc" key={id}>{rm.name} <small>{rm.type} · {rm.price} lei</small>
                {rooms.length > 1 && <button type="button" onClick={() => setRooms(rooms.filter(x => x !== id))} title={`Scoate ${rm.name}`}>×</button>}</span>; })}
              {freeRooms.length > 0 && <select value="" onChange={e => { if (e.target.value) { const next = [...rooms, e.target.value]; setRooms(next); if (!edit) setPax(String(next.reduce((t, x) => t + (roomById(data, x)?.capacity ?? 0), 0))); } }}>
                <option value="">+ adaugă cameră</option>
                {data.properties.map(p => <optgroup key={p.id} label={p.name}>{freeRooms.filter(r => r.propertyId === p.id).map(r => <option key={r.id} value={r.id}>{r.name} · {r.type} · {r.price} lei</option>)}</optgroup>)}
              </select>}
            </div>
          </div>
          <div className="g3">
            <div className="f"><label>Check-in</label><input type="date" value={checkIn} onChange={e => { const v = e.target.value; setIn(v); if (v && checkOut <= v) setOut(addDays(v, 1)); }} /></div>
            <div className="f"><label>Check-out</label><input type="date" value={checkOut} onChange={e => setOut(e.target.value)} />
              <span className={`hint ${okN ? '' : 'bad'}`}>{okN ? `${n} ${n === 1 ? 'noapte' : 'nopți'}` : 'Check-out trebuie să fie după check-in'}</span></div>
            <div className="f"><label>Persoane</label><input type="number" min={1} value={pax} onChange={e => setPax(e.target.value)} /></div>
          </div>
          <div className="g3 moneyrow">
            <div className="f"><label>Preț / noapte</label><input type="number" min={0} step={10} value={rate}
              onChange={e => { setRate(e.target.value); setRateManual(true); setTotalManual(false); if (okN) setTotal(String((Number(e.target.value) || 0) * n)); }} /><span className="hint">{rateHint}</span></div>
            <div className="f"><label>Preț total</label><input type="number" min={0} step={10} value={total} onChange={e => { setTotal(e.target.value); setTotalManual(e.target.value !== ''); }} />
              <span className={`hint ${totalManual ? 'manual' : ''}`}>{totalHint}</span></div>
            {!edit && <div className="f"><label>Avans încasat</label><input type="number" min={0} step={10} value={advance} onChange={e => setAdvance(e.target.value)} /></div>}
          </div>
          <div className="calc">
            <div><label>Nopți</label><b>{okN ? n : '–'}</b></div>
            <div><label>Total</label><b>{money(totalN)}</b></div>
            <div><label>Încasat</label><b>{money(paidN)}</b></div>
            <div className={`rem ${rem === 0 && totalN > 0 ? 'zero' : ''}`}><label>Rest de plată</label><b>{rem === 0 && totalN > 0 ? 'Achitat' : money(rem)}</b></div>
          </div>
          <details className="more" open={more} onToggle={e => setMore((e.target as HTMLDetailsElement).open)}>
            <summary>Mai multe: sursă, status, observații</summary>
            <div className="g2" style={{ marginTop: 10 }}>
              <div className="f"><label>Sursă</label><select value={source} onChange={e => setSource(e.target.value as Source)}>{Object.entries(SRC).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div className="f"><label>Status</label><select value={status} onChange={e => setStatus(e.target.value as Status)}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            </div>
            <div className="f" style={{ marginTop: 10 }}><label>Observații</label><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: pat suplimentar, vine cu câinele, factură pe firmă…" /></div>
          </details>
        </div>
        <div className="ft">
          <span className="hint" style={{ marginRight: 'auto', fontSize: 12, color: 'var(--ink-3)' }}><span className="kbd">Esc</span> închide · <span className="kbd">Ctrl</span>+<span className="kbd">Enter</span> salvează</span>
          <button className="btn" onClick={close}>Renunță</button>
          <button className="btn primary" onClick={save} disabled={saving}>{saving ? 'Se salvează…' : edit ? 'Salvează modificările' : 'Salvează rezervarea'}</button>
        </div>
      </div>
    </div>
  );
}
