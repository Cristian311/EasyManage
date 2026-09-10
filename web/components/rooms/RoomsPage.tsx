'use client';
// Properties, floors and rooms. Rooms open in their window; the ⋯ has activate / deactivate / delete.
import { useData, useStore } from '@/lib/client/store';
import { openRoomMenu } from '@/lib/client/actions';
import { todayIso } from '@/domain/dates';
import { columns, floorById, isActiveRes, propById } from '@/domain/rules';
import Table from '../Table';
import { IconPlus } from '../Icons';

export default function RoomsPage() {
  const data = useData(), admin = useStore(s => s.admin), openRoomModal = useStore(s => s.openRoomModal), toast = useStore(s => s.toast), view = useStore(s => s.view), setView = useStore(s => s.setView);
  const T = todayIso();
  const all = columns(data, { prop: 'all', floor: 'all' });
  const ask = (msg: string, def = '') => { const v = prompt(msg, def); return v == null ? null : v.trim(); };
  const addProperty = () => { const nm = ask('Numele proprietății (ex: Vila Doi):'); if (!nm) return; const city = ask('Localitatea (opțional):') ?? ''; admin('POST', '/api/properties', { name: nm, city }, `${nm} adăugată`); };
  const delProperty = (id: string) => { admin('DELETE', `/api/properties/${id}`).then(err => { if (!err && view.prop === id) setView({ prop: 'all', floor: 'all' }); }); };
  const addFloor = (pid: string) => { const nm = ask('Numele etajului sau secțiunii (ex: Etaj 1 M):'); if (!nm) return; fetch('/api/floors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: nm, propertyId: pid }) }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); useStore.getState().setData(j.state); }).catch(e => toast(e.message, 'bad')); };
  const delFloor = (id: string) => { const n = data.rooms.filter(r => r.floorId === id).length; if (n && !confirm(`${n} camere sunt pe acest etaj. Le las fără etaj și șterg etajul?`)) return; admin('DELETE', `/api/floors/${id}`).then(err => { if (!err && view.floor === id) setView({ floor: 'all' }); }); };

  return (
    <section className="page on" id="page-rooms">
      <div className="topbar"><h1>Camere</h1><div className="spacer" /><button className="btn primary" onClick={() => openRoomModal()}><IconPlus />Cameră nouă</button></div>
      <div className="scroll">
        <div className="floors">
          {data.properties.map(p => (
            <div className="pcard" key={p.id}>
              <div className="ph1">{p.name} <small>{p.city} · {data.rooms.filter(r => r.propertyId === p.id && !r.parentId).length} camere</small>
                <button className="btn sm ghost" onClick={() => { const nm = ask('Nume nou:', p.name); if (nm) admin('PATCH', `/api/properties/${p.id}`, { name: nm }); }}>Redenumește</button>
                <button className="btn sm ghost" style={{ color: 'var(--bad)' }} onClick={() => delProperty(p.id)}>Șterge</button></div>
              <div className="fchips">
                {data.floors.filter(f => f.propertyId === p.id).map(f => (
                  <span className="fchip" key={f.id}>{f.name} <small>{data.rooms.filter(r => r.floorId === f.id && !r.parentId).length}</small>
                    <button title="Mută în stânga" onClick={() => admin('PATCH', `/api/floors/${f.id}`, { move: -1 })}>‹</button><button title="Mută în dreapta" onClick={() => admin('PATCH', `/api/floors/${f.id}`, { move: 1 })}>›</button>
                    <button title="Redenumește" onClick={() => { const nm = ask('Nume nou:', f.name); if (nm) admin('PATCH', `/api/floors/${f.id}`, { name: nm }); }}>✎</button><button title="Șterge" onClick={() => delFloor(f.id)}>×</button></span>
                ))}
                <button className="btn sm" onClick={() => addFloor(p.id)}>+ Etaj</button>
              </div>
            </div>
          ))}
          <div><button className="btn" onClick={addProperty}>+ Proprietate nouă</button> <span className="hint" style={{ color: 'var(--ink-3)', fontSize: 12, marginLeft: 8 }}>Camerele se mută între etaje din fereastra camerei sau trăgând antetul lor în calendar peste o cameră de pe alt etaj.</span></div>
        </div>
        <div className="card tbl-wrap">
          <Table rows={all} keyOf={c => c.room.id} onRow={c => openRoomModal(c.room.id)} cols={[
            { h: 'Cameră', cell: c => <>{c.room.color && <span className="rdot" style={{ background: c.room.color }} />}<b>{c.room.name}</b>{c.parent && <div style={{ fontSize: 11, color: 'var(--accent)' }}>unitate din {c.parent.name}</div>}</>, v: c => c.room.name },
            { h: 'Proprietate · etaj', cell: c => <><span style={{ color: 'var(--ink-3)' }}>{propById(data, c.room.propertyId)?.name}</span> · {floorById(data, c.room.floorId)?.name || 'fără etaj'}</>, v: c => `${propById(data, c.room.propertyId)?.name} ${floorById(data, c.room.floorId)?.name ?? ''}` },
            { h: 'Tip', cell: c => c.room.type, v: c => c.room.type },
            { h: 'Capacitate', r: true, cell: c => c.room.capacity, v: c => c.room.capacity },
            { h: 'Preț / noapte', r: true, cell: c => `${c.room.price} RON`, v: c => c.room.price },
            { h: 'Descriere', cell: c => c.room.desc, v: c => c.room.desc, style: { whiteSpace: 'normal', color: 'var(--ink-2)' } },
            { h: 'Stare', cell: c => { const cnt = data.reservations.filter(x => x.roomIds.includes(c.room.id) && isActiveRes(x) && x.checkOut > T).length;
              return <><span className={`pill ${c.room.active ? 'checked_in' : 'checked_out'}`}>{c.room.active ? 'Activă' : 'Inactivă'}</span> <small style={{ color: 'var(--ink-3)' }}>{cnt} rez. viitoare</small></>; }, v: c => (c.room.active ? 1 : 0) },
            { h: '', cell: c => <button className="btn sm" onClick={e => { e.stopPropagation(); const rc = e.currentTarget.getBoundingClientRect(); openRoomMenu(c.room.id, rc.left, rc.bottom + 4); }}>⋯</button> },
          ]} />
        </div>
      </div>
    </section>
  );
}
