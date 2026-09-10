'use client';
// Everything about one reservation, on the right: who, when, money, payments, invoice, the guest's history.
import { useEffect, useState, type CSSProperties } from 'react';
import { useData, useStore } from '@/lib/client/store';
import { fmtD, fmtDL, money, todayIso } from '@/domain/dates';
import { METHOD, PAY_L, SRC, STATUS } from '@/domain/labels';
import { guestById, guestName, nights, paid, payStatus, remaining, resGuest, roomById, roomLabel } from '@/domain/rules';
import type { Method, Status } from '@/domain/types';
import { IconClose } from './Icons';

export default function Drawer() {
  const data = useData();
  const id = useStore(s => s.drawerId), close = useStore(s => s.closeDrawer), patch = useStore(s => s.patchReservation);
  const addPayment = useStore(s => s.addPayment), openModal = useStore(s => s.openModal), del = useStore(s => s.deleteReservation), toast = useStore(s => s.toast);
  const r = id ? data.reservations.find(x => x.id === id) : undefined;
  const [amt, setAmt] = useState(''), [method, setMethod] = useState<Method>('cash'), [inv, setInv] = useState('');
  const rem = r ? remaining(r) : 0;
  useEffect(() => { if (r) { setAmt(rem ? String(rem) : ''); setInv(r.invoiceNo); } }, [r?.id, r?.payments.length, r?.total, r?.invoiceNo]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !useStore.getState().modal) close(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [close]);

  if (!r) return <aside className="drawer" aria-hidden="true" />;
  const g = guestById(data, r.guestId), rm = roomById(data, r.roomIds[0]), n = nights(r), p = paid(r), ps = payStatus(r), gn = resGuest(data, r);

  const setStatus = (s: Status) => {
    if (s === 'checked_out' && rem > 0 && !confirm(`Rest de plată ${money(rem)}. Faci check-out oricum?`)) return;
    if (s === 'cancelled' && !confirm(`Anulezi rezervarea pentru ${gn}?`)) return;
    patch(r.id, { status: s }, { undoLabel: `${gn}: ${STATUS[s]}` });
  };
  const pay = async () => { const a = Number(amt); if (!a || a <= 0) { toast('Introdu o sumă', 'bad'); return; } await addPayment(r.id, a, method); };
  const saveInvoice = async () => { const v = inv.trim(); const err = await patch(r.id, { invoiceNo: v }); if (!err) toast(v ? `Factura ${v} salvată` : 'Număr factură șters', 'ok'); };

  const past = g ? data.reservations.filter(x => x.guestId === g.id && x.id !== r.id && x.status !== 'cancelled').sort((a, b) => b.checkIn.localeCompare(a.checkIn)) : [];
  const owed = past.filter(x => x.checkOut <= todayIso()).reduce((s, x) => s + remaining(x), 0);
  const field = { border: '1px solid var(--line)', borderRadius: 9, padding: '7px 10px', background: 'var(--surface)' };

  return (
    <aside className="drawer open" aria-label="Detalii rezervare">
      <div className="hd">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2>{guestName(g)}</h2>
          <div className="sub">
            <span className={`pill ${r.status}`}><i />{STATUS[r.status]}</span>&nbsp;<span className={`pill ${ps}`}>{PAY_L[ps]}</span>&nbsp;
            <span className="src-tag" style={{ '--sc': `var(--src-${r.source}, var(--src-other))` } as CSSProperties}>{SRC[r.source]}</span>
          </div>
        </div>
        <button className="btn icon ghost" onClick={close} title="Închide"><IconClose /></button>
      </div>
      <div className="bd">
        <div className="kv">
          <div style={{ gridColumn: '1 / -1' }}><label>{r.roomIds.length > 1 ? 'Camere' : 'Cameră'}</label>
            <div className="roomrow"><b>{roomLabel(data, r)}</b> <span style={{ color: 'var(--ink-3)' }}>· {r.roomIds.length > 1 ? `${r.roomIds.length} camere` : rm?.type}</span></div></div>
          <div><label>Persoane</label><b>{r.pax}</b></div>
          <div><label>Check-in</label><b>{fmtDL(r.checkIn)}</b></div>
          <div><label>Check-out</label><b>{fmtDL(r.checkOut)}</b></div>
          <div><label>Telefon</label><b>{g?.phone || '—'}</b></div>
          <div><label>Email</label><b style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis' }}>{g?.email || '—'}</b></div>
        </div>
        <div className="money">
          <div className="row"><span>{n} {n === 1 ? 'noapte' : 'nopți'} × {money(r.total / n)}</span><b>{money(r.total)}</b></div>
          <div className="row"><span>Încasat</span><b style={{ color: 'var(--ok)' }}>{money(p)}</b></div>
          <div className="bar"><i style={{ width: `${Math.min(100, r.total ? (p / r.total) * 100 : 100)}%` }} /></div>
          <div className={`row rem ${rem === 0 ? 'zero' : ''}`}><span>Rest de plată</span><b>{rem === 0 ? 'Achitat integral' : money(rem)}</b></div>
        </div>
        <div>
          <div className="sec-t">Plăți <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 600 }}>{r.payments.length} înregistrate</span></div>
          <div className="plist" style={{ marginTop: 8 }}>
            {r.payments.length ? r.payments.map(x => (
              <div className="pitem" key={x.id}><div><div>{METHOD[x.method]}{x.note ? ' · ' + x.note : ''}</div><div className="pm">{fmtD(x.date)}</div></div><b>{money(x.amount)}</b></div>
            )) : <div className="empty" style={{ padding: 8 }}>Nicio plată încă</div>}
          </div>
          {r.status !== 'cancelled' && (
            <div className="addpay" style={{ marginTop: 8 }}>
              <input type="number" placeholder="Sumă" min={1} value={amt} onChange={e => setAmt(e.target.value)} style={field} />
              <select value={method} onChange={e => setMethod(e.target.value as Method)} style={field}>
                {Object.entries(METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button className="btn ok" onClick={pay}>+ Încasează</button>
            </div>
          )}
        </div>
        {r.notes && <div><div className="sec-t">Observații</div><div className="notes" style={{ marginTop: 8 }}>{r.notes}</div></div>}
        <div><div className="sec-t">Factură</div>
          <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input placeholder="Număr factură (ex: VS-2026-0142)" value={inv} onChange={e => setInv(e.target.value)} style={{ ...field, flex: 1 }} />
            <button className="btn sm" onClick={saveInvoice}>{r.invoiceNo ? 'Actualizează' : 'Marchează facturat'}</button>
          </div>
        </div>
        {g && <div><div className="sec-t">Oaspete</div>
          <div className="hist">
            <div className="lead">{past.length ? `A mai stat de ${past.length} ${past.length === 1 ? 'dată' : 'ori'} · ultima dată în ${roomLabel(data, past[0])}, ${fmtD(past[0].checkIn)}` : 'Prima ședere la noi'}
              {owed > 0 && <> · <span style={{ color: 'var(--bad)' }}>datorii vechi {money(owed)}</span></>}</div>
            {past.slice(0, 3).map(x => <div className="hi" key={x.id}><span><b>{roomLabel(data, x)}</b> · {fmtD(x.checkIn)} – {fmtD(x.checkOut)} · {nights(x)} {nights(x) === 1 ? 'noapte' : 'nopți'}</span><span>{money(x.total)}{x.checkIn > todayIso() ? ' · viitoare' : ''}</span></div>)}
            {g.notes && <div className="notes" style={{ marginTop: 6, borderColor: 'var(--accent)' }}>{g.notes}</div>}
          </div>
        </div>}
      </div>
      <div className="ft">
        {(r.status === 'confirmed' || r.status === 'pending') && <button className="btn ok" onClick={() => setStatus('checked_in')}>Check-in</button>}
        {r.status === 'checked_in' && <button className="btn primary" onClick={() => setStatus('checked_out')}>Check-out</button>}
        {r.status === 'pending' && <button className="btn" onClick={() => setStatus('confirmed')}>Confirmă</button>}
        <button className="btn" onClick={() => openModal(null, r.id)}>Editează</button>
        {r.status !== 'cancelled' && r.status !== 'checked_out' && <button className="btn danger" onClick={() => setStatus('cancelled')}>Anulează</button>}
        {r.status === 'cancelled' && <button className="btn danger" onClick={() => { if (confirm('Ștergi definitiv această rezervare?')) del(r.id); }}>Șterge definitiv</button>}
      </div>
    </aside>
  );
}
