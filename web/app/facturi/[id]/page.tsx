'use client';
// Factura gata de tipărit. „Salvează PDF” e tot tipărirea: în fereastra browserului se alege
// „Salvare ca PDF”. Așa diacriticele și fontul ies exact ca pe ecran, fără nicio bibliotecă în plus.
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Invoice } from '@/domain/invoice';
import { fmtLong, invoiceNo, lei2 } from '@/domain/invoice';
import { api } from '@/lib/client/api';
import { useStore } from '@/lib/client/store';

export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toast = useStore(s => s.toast);
  const [inv, setInv] = useState<Invoice | null>(null), [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<{ invoice: Invoice }>(`/api/invoices/${id}`).then(r => setInv(r.invoice)).catch(e => setErr((e as Error).message));
  }, [id]);

  const storno = async () => {
    if (!inv || !confirm(`Stornezi factura ${invoiceNo(inv.series, inv.number)}?`)) return;
    try { const r = await api<{ invoice: Invoice }>(`/api/invoices/${inv.id}/storno`, 'POST'); toast(`Emisă stornarea ${invoiceNo(r.invoice.series, r.invoice.number)}`, 'ok'); }
    catch (e) { toast((e as Error).message, 'bad'); }
  };

  if (err) return <section className="page on"><div className="topbar"><h1>Factură</h1></div><div className="scroll"><div className="ph"><h2>Nu am găsit factura</h2><p>{err}</p><Link className="btn" href="/facturi">Înapoi la registru</Link></div></div></section>;
  if (!inv) return <section className="page on"><div className="topbar"><h1>Factură</h1></div><div className="scroll"><div style={{ color: 'var(--ink-3)', fontWeight: 700 }}>Se încarcă…</div></div></section>;

  const s = inv.seller, isStorno = inv.kind === 'storno';

  return (
    <section className="page on">
      <div className="topbar noprint">
        <Link className="btn" href="/facturi">‹ Registru</Link>
        <h1 style={{ marginLeft: 10 }}>{invoiceNo(inv.series, inv.number)}</h1>
        <div className="spacer" />
        {!isStorno && <button className="btn danger" onClick={storno}>Stornează</button>}
        <button className="btn primary" onClick={() => window.print()}>Tipărește sau salvează PDF</button>
      </div>
      <div className="scroll">
        <div className="invoice">
          <header>
            <div>
              <div className="big">{s.name}</div>
              {s.taxId && <div>CUI {s.taxId}</div>}
              {s.regNo && <div>Reg. Com. {s.regNo}</div>}
              {s.address && <div>{s.address}</div>}
              {s.iban && <div>IBAN {s.iban}{s.bank ? ` · ${s.bank}` : ''}</div>}
              {(s.phone || s.email) && <div>{[s.phone, s.email].filter(Boolean).join(' · ')}</div>}
            </div>
            <div className="meta">
              <div className="title">{isStorno ? 'Factură de stornare' : 'Factură'}</div>
              <div className="no">{invoiceNo(inv.series, inv.number)}</div>
              <div>Data: <b>{fmtLong(inv.issuedOn)}</b></div>
              {inv.dueOn && <div>Scadența: <b>{fmtLong(inv.dueOn)}</b></div>}
            </div>
          </header>

          <div className="parties">
            <div><div className="lbl">Furnizor</div><div className="nm">{s.name}</div><div>{s.taxId && `CUI ${s.taxId}`}</div><div>{s.address}</div></div>
            <div><div className="lbl">Client</div><div className="nm">{inv.buyerName}</div><div>{inv.buyerTaxId && `CUI / CNP ${inv.buyerTaxId}`}</div><div>{inv.buyerAddress}</div></div>
          </div>

          <table className="inv-t">
            <thead><tr><th className="n">#</th><th>Denumirea produselor sau a serviciilor</th><th className="r">Cant.</th><th>U.M.</th><th className="r">Preț unitar</th><th className="r">Valoare</th>{inv.vatRate > 0 && <th className="r">TVA</th>}</tr></thead>
            <tbody>
              {inv.lines.map((l, i) => (
                <tr key={i}>
                  <td className="n">{i + 1}</td>
                  <td>{l.description}</td>
                  <td className="r">{Number(l.qty)}</td>
                  <td>{l.unit}</td>
                  <td className="r">{lei2(Number(l.unitPrice))}</td>
                  <td className="r">{lei2(Number(l.net))}</td>
                  {inv.vatRate > 0 && <td className="r">{lei2(Number(l.vat))}</td>}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="sums">
            <div><span>Valoare fără TVA</span><b>{lei2(Number(inv.net))}</b></div>
            <div><span>TVA {inv.vatRate > 0 ? `${Number(inv.vatRate)}%` : ''}</span><b>{lei2(Number(inv.vat))}</b></div>
            <div className="tot"><span>Total de plată</span><b>{lei2(Number(inv.total))}</b></div>
          </div>

          {inv.note && <div className="note">{inv.note}</div>}
          <div className="sign">
            <div><div className="lbl">Semnătura furnizorului</div><div className="line" /></div>
            <div><div className="lbl">Semnătura de primire</div><div className="line" /></div>
          </div>
        </div>
      </div>
    </section>
  );
}
