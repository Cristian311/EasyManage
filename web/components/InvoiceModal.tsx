'use client';
// Emiterea unei facturi pentru o rezervare: propunerea vine de la server, aici se poate corecta.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Draft } from '@/lib/invoices';
import type { Invoice } from '@/domain/invoice';
import { fillLine, lei2, totals } from '@/domain/invoice';
import { api } from '@/lib/client/api';
import { useStore } from '@/lib/client/store';
import { IconClose } from './Icons';

type Line = { description: string; qty: number; unit: string; unitPrice: number };

export default function InvoiceModal() {
  const id = useStore(s => s.invoiceFor);
  return id ? <Form key={id} reservationId={id} /> : null;
}

function Form({ reservationId }: { reservationId: string }) {
  const close = useStore(s => s.closeInvoice), toast = useStore(s => s.toast), reload = useStore(s => s.load);
  const router = useRouter();
  const [d, setD] = useState<Draft | null>(null);
  const [err, setErr] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);

  useEffect(() => {
    api<{ draft: Draft }>(`/api/invoices?draft=${encodeURIComponent(reservationId)}`)
      .then(r => { setD(r.draft); setLines(r.draft.lines); })
      .catch(e => setErr((e as Error).message));
  }, [reservationId]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [close]);

  const set = (p: Partial<Draft>) => setD(x => (x ? { ...x, ...p } : x));
  const setLine = (i: number, p: Partial<Line>) => setLines(ls => ls.map((l, k) => (k === i ? { ...l, ...p } : l)));
  const sum = totals(lines.map(l => fillLine(l, d?.vatRate ?? 0)));

  const submit = async () => {
    if (!d) return;
    setBusy(true); setErr(null);
    try {
      const { invoice } = await api<{ invoice: Invoice }>('/api/invoices', 'POST', {
        reservationId, series: d.series, issuedOn: d.issuedOn, dueOn: d.dueOn, vatRate: d.vatRate,
        buyerName: d.buyerName, buyerTaxId: d.buyerTaxId, buyerAddress: d.buyerAddress, note: d.note, lines,
      });
      await reload();
      close();
      toast(`Factura ${invoice.series} ${String(invoice.number).padStart(4, '0')} a fost emisă`, 'ok');
      router.push(`/facturi/${invoice.id}`);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  return (
    <div className="overlay open" onPointerDown={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal" role="dialog" aria-label="Emite factură">
        <div className="hd"><h2>Emite factură</h2><div className="spacer" /><button className="btn icon ghost" onClick={close}><IconClose /></button></div>
        <div className="bd">
          {err && <div className="auth-err">{err}</div>}
          {!d ? <div style={{ color: 'var(--ink-3)', fontWeight: 700 }}>Se pregătește…</div> : d.missing.length ? (
            <div className="ph">
              <h2>Mai întâi datele pensiunii</h2>
              <p>Ca să pot face factura, îmi lipsesc: {d.missing.join(', ')}.</p>
              <button className="btn primary" onClick={() => { close(); router.push('/setari'); }}>Deschide Setări</button>
            </div>
          ) : (
            <>
              <div className="g2">
                <div className="f"><label>Client</label><input value={d.buyerName} onChange={e => set({ buyerName: e.target.value })} placeholder="Nume persoană sau firmă" /></div>
                <div className="f"><label>CUI sau CNP</label><input value={d.buyerTaxId} onChange={e => set({ buyerTaxId: e.target.value })} placeholder="doar dacă cere" /></div>
              </div>
              <div className="f"><label>Adresa clientului</label><input value={d.buyerAddress} onChange={e => set({ buyerAddress: e.target.value })} placeholder="Str., nr., localitate, județ" /></div>
              <div className="g3">
                <div className="f"><label>Serie</label><input value={d.series} onChange={e => set({ series: e.target.value.toUpperCase() })} /></div>
                <div className="f"><label>Data facturii</label><input type="date" value={d.issuedOn} onChange={e => set({ issuedOn: e.target.value })} /></div>
                <div className="f"><label>Scadența</label><input type="date" value={d.dueOn ?? ''} onChange={e => set({ dueOn: e.target.value || null })} /></div>
              </div>

              <div className="sec-t" style={{ marginTop: 6 }}>Ce se facturează</div>
              {lines.map((l, i) => (
                <div key={i} className="invline">
                  <div className="f wide"><label>Descriere</label><input value={l.description} onChange={e => setLine(i, { description: e.target.value })} /></div>
                  <div className="f"><label>Cantitate</label><input type="number" step="0.01" value={l.qty} onChange={e => setLine(i, { qty: Number(e.target.value) })} /></div>
                  <div className="f"><label>U.M.</label><input value={l.unit} onChange={e => setLine(i, { unit: e.target.value })} /></div>
                  <div className="f"><label>Preț pe bucată (lei)</label><input type="number" step="0.01" value={l.unitPrice} onChange={e => setLine(i, { unitPrice: Number(e.target.value) })} /></div>
                  <div className="linesum">= {lei2(fillLine(l, d.vatRate).total)}</div>
                  <button className="btn icon ghost" title="Șterge linia" disabled={lines.length === 1} onClick={() => setLines(ls => ls.filter((_, k) => k !== i))}><IconClose /></button>
                </div>
              ))}
              <div><button className="btn sm" onClick={() => setLines(ls => [...ls, { description: '', qty: 1, unit: 'buc', unitPrice: 0 }])}>+ Încă o linie</button></div>

              <div className="calc" style={{ marginTop: 12, gridTemplateColumns: 'repeat(3,1fr)' }}>
                <div><label>Fără TVA</label><b>{lei2(sum.net)}</b></div>
                <div><label>TVA {d.vatRate ? `${d.vatRate}%` : '—'}</label><b>{lei2(sum.vat)}</b></div>
                <div><label>Total de plată</label><b>{lei2(sum.total)}</b></div>
              </div>
              {!d.company.vatPayer && <div className="f"><div className="hint">Ești trecut ca neplătitor de TVA în Setări, deci factura iese fără TVA.</div></div>}
              <div className="f" style={{ marginTop: 10 }}><label>Mențiuni pe factură</label><input value={d.note} onChange={e => set({ note: e.target.value })} placeholder="ex: Neplătitor de TVA" /></div>
            </>
          )}
        </div>
        <div className="ft">
          <button className="btn" onClick={close}>Renunță</button>
          <button className="btn primary" onClick={submit} disabled={busy || !d || d.missing.length > 0}>Emite factura</button>
        </div>
      </div>
    </div>
  );
}
