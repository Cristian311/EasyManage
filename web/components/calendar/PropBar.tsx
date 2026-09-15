'use client';
// Choose the property and the floor; the calendar shows only those rooms.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment } from 'react';
import { useData, useStore } from '@/lib/client/store';
import { shortProp } from '@/domain/rules';

export default function PropBar() {
  const data = useData(), view = useStore(s => s.view), setView = useStore(s => s.setView);
  const router = useRouter();
  const props = data.properties;
  const floors = data.floors.filter(f => view.prop === 'all' || f.propertyId === view.prop);
  const groups = view.prop === 'all' && props.length > 1
    ? props.map(p => ({ p, fl: floors.filter(f => f.propertyId === p.id) })).filter(x => x.fl.length)
    : [{ p: null, fl: floors }];
  const pick = (prop: string, floor = 'all') => setView({ prop, floor, extra: view.extra });

  return (
    <div className="propbar" id="propbar">
      <button className="btn sm" onClick={() => router.back()} title="Ecranul de dinainte">‹ Înapoi</button><span className="sep" />
      {props.length > 1 && <>
        <span className="pb-l">Proprietate</span>
        <div className="seg">
          <button className={`all ${view.prop === 'all' ? 'on' : ''}`} onClick={() => pick('all')}>Toate</button>
          {props.map(p => <button key={p.id} className={view.prop === p.id ? 'on' : ''} onClick={() => pick(p.id)}>{p.name}</button>)}
        </div><span className="sep" />
      </>}
      {floors.length > 0 && <>
        <span className="pb-l">Etaj</span>
        <div className="seg"><button className={`all ${view.floor === 'all' ? 'on' : ''}`} onClick={() => pick(view.prop, 'all')}>Toate</button></div>
        {/* with several properties each one takes its own line, so its floors stay under its name */}
        {groups.map((g, i) => {
          const seg = <div className="seg">{g.fl.map(f => <button key={f.id} className={view.floor === f.id ? 'on' : ''} onClick={() => pick(view.prop, f.id)}>{f.name}</button>)}</div>;
          return g.p
            ? <div className="pb-fg" key={g.p.id}><span className="pb-g">{shortProp(g.p)}</span>{seg}</div>
            : <Fragment key={i}>{seg}</Fragment>;
        })}
      </>}
      <Link className="btn sm ghost pb-more" href="/camere">Etaje și proprietăți…</Link>
    </div>
  );
}
