'use client';
// Everything about one reservation, on the right: who, when, money, payments, invoice, the guest's history.
import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useData, useStore } from '@/lib/client/store';
import { fmtD, fmtDL, money, todayIso } from '@/domain/dates';
import { METHOD, PAY_L, SRC, STATUS } from '@/domain/labels';
import { guestById, guestName, isBlock, neighbours, nights, paid, payStatus, remaining, resGuest, roomById, roomLabel } from '@/domain/rules';
import { growRoom, shrinkRoom } from '@/lib/client/actions';
import type { Method, Reservation, Status } from '@/domain/types';
import { fillTemplate, langFor, mailLink, messageVars, waLink } from '@/domain/message';
import { IconClose } from './Icons';

const PRESETS: [string, number][] = [['Mic dejun', 35], ['Pat suplimentar', 60], ['Taxă de stațiune', 5], ['Parcare', 20], ['Late check-out', 50]];

/** Ce s-a mai luat pe lângă cazare. Fiecare rând urcă totalul rezervării, deci restul de plată se schimbă singur. */
function Extras({ r }: { r: Reservation }) {
  const add = useStore(s => s.addExtra), remove = useStore(s => s.removeExtra), toast = useStore(s => s.toast);
  const [open, setOpen] = useState(false), [label, setLabel] = useState(PRESETS[0][0]), [qty, setQty] = useState('1'), [price, setPrice] = useState(String(PRESETS[0][1]));
  const [busy, setBusy] = useState(false);
  const sum = r.extras.reduce((t, e) => t + Number(e.qty) * Number(e.unitPrice), 0);
  const field = { border: '1px solid var(--line)', borderRadius: 9, padding: '7px 10px', background: 'var(--surface)' };

  const submit = async () => {
    const q = Number(qty.replace(',', '.')), p = Number(price.replace(',', '.'));
    if (!label.trim()) { toast('Scrie ce a mai luat oaspetele', 'bad'); return; }
    if (!(q > 0) || !(p >= 0)) { toast('Cantitatea și prețul nu sunt valide', 'bad'); return; }
    setBusy(true);
    const err = await add(r.id, { label: label.trim(), qty: q, unitPrice: p });
    setBusy(false);
    if (!err) { setOpen(false); setQty('1'); }
  };

  return (
    <div>
      <div className="sec-t">Servicii în plus {sum > 0 && <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 600 }}>{money(sum)}, deja în total</span>}</div>
      <div className="plist" style={{ marginTop: 8 }}>
        {r.extras.length ? r.extras.map(e => (
          <div className="pitem" key={e.id}>
            <div><div>{e.label}</div><div className="pm">{Number(e.qty)} × {money(Number(e.unitPrice))}</div></div>
            <b>{money(Number(e.qty) * Number(e.unitPrice))}</b>
            {r.status !== 'cancelled' && <button className="btn sm ghost" title="Scoate" onClick={() => { if (confirm(`Scoți „${e.label}”? Totalul scade cu ${money(Number(e.qty) * Number(e.unitPrice))}.`)) remove(r.id, e.id); }}>−</button>}
          </div>
        )) : <div className="empty" style={{ padding: 8 }}>Nimic în plus față de cazare</div>}
      </div>
      {r.status !== 'cancelled' && (open ? (
        <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
          <input list="extra-presets" value={label} placeholder="ex: Mic dejun"
            onChange={e => { setLabel(e.target.value); const p = PRESETS.find(x => x[0] === e.target.value); if (p) setPrice(String(p[1])); }} style={field} />
          <datalist id="extra-presets">{PRESETS.map(([n, p]) => <option key={n} value={n}>{p} lei</option>)}</datalist>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6 }}>
            <input type="number" min={0.5} step={0.5} value={qty} onChange={e => setQty(e.target.value)} placeholder="Câte" style={field} />
            <input type="number" min={0} step={1} value={price} onChange={e => setPrice(e.target.value)} placeholder="Preț bucata" style={field} />
            <button className="btn ok" onClick={submit} disabled={busy}>Adaugă</button>
          </div>
          <button className="btn sm ghost" onClick={() => setOpen(false)}>Renunță</button>
        </div>
      ) : <button className="btn sm" style={{ marginTop: 8 }} onClick={() => setOpen(true)}>+ Serviciu în plus</button>)}
    </div>
  );
}

export default function Drawer() {
  const data = useData();
  const view = useStore(s => s.view);
  const id = useStore(s => s.drawerId), close = useStore(s => s.closeDrawer), patch = useStore(s => s.patchReservation);
  const addPayment = useStore(s => s.addPayment), openModal = useStore(s => s.openModal), del = useStore(s => s.deleteReservation), toast = useStore(s => s.toast);
  const me = useStore(s => s.me), openInvoice = useStore(s => s.openInvoice), openGuest = useStore(s => s.openGuest), loadMsg = useStore(s => s.loadMsg);
  const admin = useStore(s => s.admin);
  const r = id ? data.reservations.find(x => x.id === id) : undefined;
  const [amt, setAmt] = useState(''), [method, setMethod] = useState<Method>('cash'), [inv, setInv] = useState('');
  const rem = r ? remaining(r) : 0;
  useEffect(() => { if (r) { setAmt(rem ? String(rem) : ''); setInv(r.invoiceNo); } }, [r?.id, r?.payments.length, r?.total, r?.invoiceNo]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !useStore.getState().modal) close(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [close]);

  if (!r) return <aside className="drawer" aria-hidden="true" />;

  // o cameră blocată nu are oaspete, bani sau factură: doar de când până când și de ce
  if (isBlock(r)) return (
    <aside className="drawer open" aria-label="Cameră blocată">
      <div className="hd">
        <div style={{ flex: 1, minWidth: 0 }}><h2>{r.notes || 'Cameră blocată'}</h2><div className="sub">Scoasă din vânzare</div></div>
        <button className="btn icon ghost" onClick={close} title="Închide"><IconClose /></button>
      </div>
      <div className="bd">
        <div className="kv">
          <div style={{ gridColumn: '1 / -1' }}><label>{r.roomIds.length > 1 ? 'Camere' : 'Cameră'}</label><b>{roomLabel(data, r)}</b></div>
          <div><label>Din</label><b>{fmtDL(r.checkIn)}</b></div>
          <div><label>Până în dimineața zilei</label><b>{fmtDL(r.checkOut)}</b></div>
          <div><label>Nopți</label><b>{nights(r)}</b></div>
        </div>
        <p className="hint" style={{ marginTop: 12 }}>Cât e blocată, nimeni nu poate face o rezervare pe camera aceasta în zilele de mai sus. Nu intră în încasări și nici în raportul de ocupare.</p>
      </div>
      <div className="ft">
        <button className="btn danger" onClick={() => { if (confirm(`Scoți blocarea „${r.notes}” de pe ${roomLabel(data, r)}?\n\nCamera devine liberă din nou.`)) { admin('DELETE', `/api/blocks/${r.id}`, undefined, 'Blocarea a fost scoasă'); close(); } }}>Scoate blocarea</button>
      </div>
    </aside>
  );

  const g = guestById(data, r.guestId), rm = roomById(data, r.roomIds[0]), n = nights(r), p = paid(r), ps = payStatus(r), gn = resGuest(data, r);

  const setStatus = (s: Status) => {
    if (s === 'checked_out' && rem > 0 && !confirm(`Rest de plată ${money(rem)}. Faci check-out oricum?`)) return;
    if (s === 'cancelled' && !confirm(`Anulezi rezervarea pentru ${gn}?`)) return;
    patch(r.id, { status: s }, { undoLabel: `${gn}: ${STATUS[s]}` });
  };
  const pay = async () => { const a = Number(amt); if (!a || a <= 0) { toast('Introdu o sumă', 'bad'); return; } await addPayment(r.id, a, method); };
  const saveInvoice = async () => { const v = inv.trim(); const err = await patch(r.id, { invoiceNo: v }); if (!err) toast(v ? `Factura ${v} salvată` : 'Număr factură șters', 'ok'); };

  /** Deschide WhatsApp sau programul de email cu mesajul de confirmare gata scris; omul doar apasă „Trimite”. */
  const confirmTo = async (how: 'wa' | 'mail') => {
    const m = await loadMsg(); if (!m || !g) return;
    // oaspeții din afara țării primesc textul în engleză
    const lang = langFor(g.country);
    const text = fillTemplate(lang === 'en' ? m.templateEn : m.template, messageVars(data, r, m.sender, lang));
    const subject = lang === 'en' ? `Booking confirmation ${fmtD(r.checkIn)} – ${fmtD(r.checkOut)}` : `Confirmare rezervare ${fmtD(r.checkIn)} – ${fmtD(r.checkOut)}`;
    const url = how === 'wa' ? waLink(g.phone, text) : mailLink(g.email, subject, text);
    if (!url) { toast(how === 'wa' ? 'Oaspetele nu are un număr de telefon valid' : 'Oaspetele nu are o adresă de email validă', 'bad'); openGuest(g.id); return; }
    window.open(url, '_blank', 'noopener');
  };

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
            <div className="roomrow">{(() => { const nb = neighbours(data, view, r); return <>
              {nb.left && <button className="btn sm" title={`Adaugă ${nb.left.name} din stânga`} onClick={() => growRoom(r.id, 'left')}>+ {nb.left.name}</button>}
              {nb.span > 1 && nb.first && <button className="btn sm ghost" title={`Scoate ${nb.first.name}`} onClick={() => shrinkRoom(r.id, 'left')}>−</button>}
              <b>{roomLabel(data, r)}</b> <span style={{ color: 'var(--ink-3)' }}>· {nb.span > 1 ? `${nb.span} camere` : rm?.type}</span>
              {nb.span > 1 && nb.last && <button className="btn sm ghost" title={`Scoate ${nb.last.name}`} onClick={() => shrinkRoom(r.id, 'right')}>−</button>}
              {nb.right && <button className="btn sm" title={`Adaugă ${nb.right.name} din dreapta`} onClick={() => growRoom(r.id, 'right')}>+ {nb.right.name}</button>}
            </>; })()}</div></div>
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
        <Extras r={r} />
        {r.notes && <div><div className="sec-t">Observații</div><div className="notes" style={{ marginTop: 8 }}>{r.notes}</div></div>}
        {me?.role === 'owner' && <div><div className="sec-t">Factură</div>
          {r.invoiceNo ? (
            <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
              <b style={{ flex: 1 }}>{r.invoiceNo}{r.invoiceDate ? ` · ${fmtD(r.invoiceDate)}` : ''}</b>
              <Link className="btn sm" href="/facturi" onClick={close}>Vezi în registru</Link>
            </div>
          ) : (
            <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
              <button className="btn primary sm" onClick={() => openInvoice(r.id)}>Emite factură</button>
              <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>sau scrie numărul uneia făcute în alt program:</span>
            </div>
          )}
          {!r.invoiceNo && <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input placeholder="ex: VS-2026-0142" value={inv} onChange={e => setInv(e.target.value)} style={{ ...field, flex: 1 }} />
            <button className="btn sm" onClick={saveInvoice}>Marchează facturat</button>
          </div>}
        </div>}
        {g && <div><div className="sec-t">Oaspete</div>
          <div style={{ margin: '8px 0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn sm" onClick={() => openGuest(g.id)}>{g.idNumber ? 'Date și act' : 'Completează actul'}</button>
            <Link className="btn sm" href={`/fisa/${r.id}`} onClick={close}>Fișă de cazare</Link>
            <Link className="btn sm" href={`/confirmare/${r.id}`} onClick={close}>Confirmare de tipărit</Link>
            <button className="btn sm" onClick={() => confirmTo('wa')}>Confirmă pe WhatsApp</button>
            <button className="btn sm" onClick={() => confirmTo('mail')}>Confirmă pe email</button>
          </div>
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
        {r.status !== 'cancelled' && r.status !== 'checked_out' &&<button className="btn danger" onClick={() => setStatus('cancelled')}>Anulează</button>}
        {r.status === 'cancelled' && <button className="btn danger" onClick={() => { if (confirm('Ștergi definitiv această rezervare?')) del(r.id); }}>Șterge definitiv</button>}
      </div>
    </aside>
  );
}
