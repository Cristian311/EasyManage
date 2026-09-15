'use client';
// Issuing an invoice: the client, the lines (the stay is filled in), the totals; then straight to the printable page.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useData, useStore } from '@/lib/client/store';
import { fmtD, todayIso } from '@/domain/dates';
import { amount, invoiceNo, invoiceTotals, lineTotals, stayLines, validateInvoice } from '@/domain/invoice';
import { guestById, guestName, roomLabel } from '@/domain/rules';
import type { InvoiceLine } from '@/domain/types';
import { IconClose } from './Icons';

export default function InvoiceModal() {
  const m = useStore(s => s.invModal);
  return m ? <Form key={m.reservationId ?? 'new'} reservationId={m.reservationId} /> : null;
}

const VAT_RATES = [0, 5, 9, 11, 19, 21];

function Form({ reservationId }: { reservationId: string | null }) {
  const data = useData(), st = data.settings, router = useRouter();
  const close = useStore(s => s.closeInvModal), create = useStore(s => s.createInvoice), toast = useStore(s => s.toast), closeDrawer = useStore(s => s.closeDrawer);
  const r = reservationId ? data.reservations.find(x => x.id === reservationId) : undefined;
  const g = r ? guestById(data, r.guestId) : undefined;
  const vat = st.vatPayer ? st.vatRate : 0, ready = !!(st.name && st.cui);
  const [cust, setCust] = useState({ name: g ? guestName(g) : '', cui: '', regCom: '', address: '' });
  const [issuedOn, setIssuedOn] = useState(todayIso()), [dueOn, setDueOn] = useState('');
  const [lines, setLines] = useState<InvoiceLine[]>(r ? stayLines(data, r, vat) : [{ desc: '', qty: 1, unit: 'buc', price: 0, vat }]);
  const [notes, setNotes] = useState(''), [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => nameRef.current?.focus(), 50); }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [close]);

  const t = invoiceTotals(lines);
  const setLine = (i: number, p: Partial<InvoiceLine>) => setLines(ls => ls.map((l, k) => (k === i ? { ...l, ...p } : l)));
  const numOf = (v: string) => (v.trim() === '' ? NaN : Number(v));
  const submit = async () => {
    const x = { reservationId, issuedOn, dueOn: dueOn || null, customer: { name: cust.name.trim(), cui: cust.cui.trim(), regCom: cust.regCom.trim(), address: cust.address.trim() }, lines, notes: notes.trim() };
    const err = validateInvoice(x); if (err) { toast(err, 'bad'); return; }
    setSaving(true); const res = await create(x); setSaving(false);
    if (res.error || !res.invoice) return;
    close(); closeDrawer(); router.push(`/facturi/${res.invoice.id}`);
  };

  return (
    <div className="overlay open" onPointerDown={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal" role="dialog" style={{ maxWidth: 780 }}>
        <div className="hd">
          <div><h2>Factură nouă</h2><div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>Primește numărul <b style={{ color: 'var(--ink)' }}>{invoiceNo({ series: st.invoiceSeries, number: st.invoiceNext })}</b>{st.name && <> · emisă de {st.name}</>}</div></div>
          <div className="spacer" /><button className="btn icon ghost" onClick={close}><IconClose /></button>
        </div>
        <div className="bd">
          {!ready && <div className="alert on">Completează numele firmei și CUI-ul în <Link href="/setari" onClick={close} style={{ textDecoration: 'underline' }}>Setări</Link> înainte de prima factură.</div>}
          {r && <div className="notes" style={{ borderColor: 'var(--accent)' }}>Rezervare: <b>{guestName(g)}</b> · {roomLabel(data, r)} · {fmtD(r.checkIn)} – {fmtD(r.checkOut)}</div>}
          <div className="g2">
            <div className="f"><label>Client (nume sau firmă)</label><input ref={nameRef} value={cust.name} onChange={e => setCust({ ...cust, name: e.target.value })} placeholder="ex: Popescu Mihai sau SC Alfa SRL" /></div>
            <div className="f"><label>CUI / CNP (opțional)</label><input value={cust.cui} onChange={e => setCust({ ...cust, cui: e.target.value })} placeholder="RO12345678" /></div>
          </div>
          <div className="g2">
            <div className="f"><label>Nr. Reg. Com. (opțional)</label><input value={cust.regCom} onChange={e => setCust({ ...cust, regCom: e.target.value })} placeholder="J08/1234/2019" /></div>
            <div className="f"><label>Adresă (opțional)</label><input value={cust.address} onChange={e => setCust({ ...cust, address: e.target.value })} placeholder="Str., nr., localitate" /></div>
          </div>
          <div className="g2">
            <div className="f"><label>Data facturii</label><input type="date" value={issuedOn} onChange={e => setIssuedOn(e.target.value)} /></div>
            <div className="f"><label>Scadență (opțional)</label><input type="date" value={dueOn} min={issuedOn} onChange={e => setDueOn(e.target.value)} /></div>
          </div>
          <div className="f">
            <label>Rânduri</label>
            <div className="inv-lines">
              <div className={`inv-line inv-head ${st.vatPayer ? '' : 'novat'}`}><span>Descriere</span><span>Cant.</span><span>UM</span><span>Preț{st.vatPayer ? ' (cu TVA)' : ''}</span>{st.vatPayer && <span>TVA</span>}<span style={{ textAlign: 'right' }}>Total</span><span /></div>
              {lines.map((l, i) => (
                <div className={`inv-line ${st.vatPayer ? '' : 'novat'}`} key={i}>
                  <input value={l.desc} onChange={e => setLine(i, { desc: e.target.value })} placeholder="ex: Mic dejun, 2 persoane" />
                  <input type="number" min={0} step="any" value={Number.isFinite(l.qty) ? l.qty : ''} onChange={e => setLine(i, { qty: numOf(e.target.value) })} />
                  <input value={l.unit} onChange={e => setLine(i, { unit: e.target.value })} />
                  <input type="number" min={0} step="0.01" value={Number.isFinite(l.price) ? l.price : ''} onChange={e => setLine(i, { price: numOf(e.target.value) })} />
                  {st.vatPayer && <select value={l.vat} onChange={e => setLine(i, { vat: Number(e.target.value) })}>{[...new Set([...VAT_RATES, l.vat])].sort((a, b) => a - b).map(v => <option key={v} value={v}>{v}%</option>)}</select>}
                  <span className="tot">{Number.isFinite(l.qty) && Number.isFinite(l.price) ? amount(lineTotals(l).total) : '—'}</span>
                  <button className="btn icon ghost sm" title="Șterge rândul" onClick={() => setLines(ls => ls.filter((_, k) => k !== i))} disabled={lines.length === 1}><IconClose /></button>
                </div>
              ))}
            </div>
            <div><button className="btn sm" onClick={() => setLines(ls => [...ls, { desc: '', qty: 1, unit: 'buc', price: 0, vat }])}>+ Adaugă rând</button></div>
          </div>
          <div className="inv-sum">
            {st.vatPayer && <span>Fără TVA {amount(t.subtotal)} · TVA {amount(t.vat)}</span>}
            <b>Total {amount(t.total)} RON</b>
          </div>
          <div className="f"><label>Mențiuni (opțional)</label><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="ex: plata prin transfer în 5 zile" style={{ minHeight: 48 }} /></div>
        </div>
        <div className="ft"><button className="btn" onClick={close}>Renunță</button><button className="btn primary" onClick={submit} disabled={saving || !ready}>Emite factura</button></div>
      </div>
    </div>
  );
}
