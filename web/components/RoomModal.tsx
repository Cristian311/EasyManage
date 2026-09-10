'use client';
// New or edited room: name, type, capacity, base price, colour, property and floor.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useData, useStore } from '@/lib/client/store';
import { roomById } from '@/domain/rules';
import { IconClose } from './Icons';

export const ROOM_COLORS = ['#3A7BD5', '#0E7C86', '#2F8F5B', '#B8862B', '#D9761B', '#C9453A', '#6B5BD6', '#B3437C', '#5E7C8A', '#8E5A3C'];
const TYPES = ['Single', 'Dublă', 'Twin', 'Triplă', 'Apartament', 'Studio', 'Familială', 'Căsuță', 'Suită'];

export default function RoomModal() {
  const m = useStore(s => s.roomModal);
  return m ? <Form key={m.editId ?? 'new'} editId={m.editId} /> : null;
}

function Form({ editId }: { editId: string | null }) {
  const data = useData(), view = useStore(s => s.view), close = useStore(s => s.closeRoomModal), admin = useStore(s => s.admin), toast = useStore(s => s.toast);
  const r = editId ? roomById(data, editId) : undefined;
  const [name, setName] = useState(r?.name ?? ''), [type, setType] = useState(r?.type ?? ''), [cap, setCap] = useState(String(r?.capacity ?? 2)), [price, setPrice] = useState(String(r?.price ?? 250));
  const [desc, setDesc] = useState(r?.desc ?? ''), [color, setColor] = useState(r?.color ?? ''), [active, setActive] = useState(r?.active ?? true);
  const [pid, setPid] = useState(r?.propertyId ?? (view.prop !== 'all' ? view.prop : data.properties[0]?.id ?? ''));
  const [fid, setFid] = useState(r?.floorId ?? (view.floor !== 'all' && view.prop === pid ? view.floor : ''));
  const [saving, setSaving] = useState(false), [err, setErr] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => nameRef.current?.focus(), 50); }, []);
  const floors = data.floors.filter(f => f.propertyId === pid);

  const onFloor = async (v: string) => {
    if (v !== '__new') { setFid(v); return; }
    const nm = prompt('Numele etajului sau secțiunii (ex: Etaj 1 M):'); if (!nm?.trim()) return;
    try {
      const res = await fetch('/api/floors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: nm.trim(), propertyId: pid }) });
      const j = await res.json(); if (!res.ok) throw new Error(j.error); useStore.getState().setData(j.state); setFid(j.id);
    } catch (e) { toast((e as Error).message, 'bad'); }
  };
  const save = async () => {
    if (!name.trim()) { setErr(true); nameRef.current?.focus(); return; }
    setSaving(true);
    const body = { name: name.trim(), type: type.trim() || 'Cameră', capacity: Number(cap) || 1, price: Number(price) || 0, desc: desc.trim(), color, active, propertyId: pid, floorId: fid || null };
    const e = await admin(editId ? 'PATCH' : 'POST', editId ? `/api/rooms/${editId}` : '/api/rooms', body, editId ? `Camera ${body.name} actualizată` : `Camera ${body.name} adăugată`);
    setSaving(false); if (!e) close();
  };
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [close]);

  return (
    <div className="overlay open" onPointerDown={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal sm" role="dialog">
        <div className="hd"><h2>{r ? `Editează ${r.name}` : 'Cameră nouă'}</h2><div className="spacer" /><button className="btn icon ghost" onClick={close}><IconClose /></button></div>
        <div className="bd">
          <div className="g2">
            <div className="f"><label>Număr / nume</label><input ref={nameRef} className={err ? 'err' : ''} value={name} onChange={e => { setName(e.target.value); setErr(false); }} placeholder="ex: 104" /></div>
            <div className="f"><label>Tip</label><input list="roomTypes" value={type} onChange={e => setType(e.target.value)} placeholder="ex: Dublă, Apartament, Căsuță" /><datalist id="roomTypes">{TYPES.map(t => <option key={t}>{t}</option>)}</datalist></div>
          </div>
          <div className="g2">
            <div className="f"><label>Capacitate (persoane)</label><input type="number" min={1} value={cap} onChange={e => setCap(e.target.value)} /></div>
            <div className="f"><label>Preț / noapte (RON)</label><input type="number" min={0} step={10} value={price} onChange={e => setPrice(e.target.value)} /></div>
          </div>
          <div className="f"><label>Descriere</label><input value={desc} onChange={e => setDesc(e.target.value)} placeholder="ex: vedere la munte, balcon" /></div>
          <div className="f"><label>Culoare în calendar</label>
            <div className="swatches">
              <button type="button" className={`none ${color ? '' : 'on'}`} onClick={() => setColor('')} title="Fără culoare">×</button>
              {ROOM_COLORS.map(c => <button type="button" key={c} className={color === c ? 'on' : ''} style={{ '--sw': c } as CSSProperties} onClick={() => setColor(c)} />)}
            </div>
            <span className="hint">Opțional. Colorează antetul și coloana camerei, ca să o găsești dintr-o privire.</span></div>
          <div className="g2">
            <div className="f"><label>Proprietate</label><select value={pid} onChange={e => { setPid(e.target.value); setFid(''); }}>{data.properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div className="f"><label>Etaj / secțiune</label>
              <select value={fid} onChange={e => onFloor(e.target.value)}><option value="">Fără etaj</option>{floors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}<option value="__new">+ Etaj nou…</option></select>
              <span className="hint">Alege „+ Etaj nou” ca să creezi unul pe loc.</span></div>
          </div>
          <div className="f" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><input type="checkbox" id="rActive" checked={active} onChange={e => setActive(e.target.checked)} style={{ width: 'auto' }} /><label htmlFor="rActive" style={{ margin: 0 }}>Activă (apare în calendar și poate fi rezervată)</label></div>
        </div>
        <div className="ft"><button className="btn" onClick={close}>Renunță</button><button className="btn primary" onClick={save} disabled={saving}>{saving ? 'Se salvează…' : 'Salvează'}</button></div>
      </div>
    </div>
  );
}
