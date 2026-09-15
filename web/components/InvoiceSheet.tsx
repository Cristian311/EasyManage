// The invoice as it is printed: white paper, fixed colours, whatever the theme.
import type { Invoice, Reservation } from '@/domain/types';
import { fmtDL } from '@/domain/dates';
import { amount, invoiceNo, lineTotals, r2 } from '@/domain/invoice';
import { nights, paid } from '@/domain/rules';

const qty = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString('ro-RO', { maximumFractionDigits: 2 }));

export default function InvoiceSheet({ inv, reservation }: { inv: Invoice; reservation?: Reservation }) {
  const s = inv.supplier, c = inv.customer, vat = s.vatPayer;
  const got = reservation ? Math.min(paid(reservation), inv.total) : 0;
  return (
    <div className="sheet">
      {inv.status === 'cancelled' && <div className="stamp">ANULATĂ</div>}
      <div className="top">
        <div className="party">
          <b>{s.name}</b>
          <span>CUI {s.cui}</span>
          {s.regCom && <span>Nr. Reg. Com. {s.regCom}</span>}
          {s.address && <span>{s.address}</span>}
          {(s.phone || s.email) && <span>{[s.phone, s.email].filter(Boolean).join(' · ')}</span>}
          {s.iban && <span>IBAN {s.iban}{s.bank ? `, ${s.bank}` : ''}</span>}
          {!vat && <span>Neplătitor de TVA</span>}
        </div>
        <div className="meta">
          <h1>FACTURĂ</h1>
          <span className="no">{invoiceNo(inv)}</span>
          <span>Data emiterii: {fmtDL(inv.issuedOn)}</span>
          {inv.dueOn && <span>Scadență: {fmtDL(inv.dueOn)}</span>}
        </div>
      </div>
      <div className="parties">
        <div className="party">
          <span className="lbl">Client</span>
          <b>{c.name}</b>
          {c.cui && <span>CUI {c.cui}</span>}
          {c.regCom && <span>Nr. Reg. Com. {c.regCom}</span>}
          {c.address && <span>{c.address}</span>}
        </div>
        {reservation && (
          <div className="party">
            <span className="lbl">Sejur</span>
            <span>{fmtDL(reservation.checkIn)} → {fmtDL(reservation.checkOut)}</span>
            <span>{nights(reservation)} {nights(reservation) === 1 ? 'noapte' : 'nopți'} · {reservation.pax} {reservation.pax === 1 ? 'persoană' : 'persoane'}</span>
          </div>
        )}
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr>
            <th>#</th><th>Descriere</th><th className="r">Cant.</th><th>UM</th><th className="r">Preț unitar{vat ? ' fără TVA' : ''}</th>
            {vat && <><th className="r">Valoare</th><th className="r">TVA</th></>}
            <th className="r">Total</th>
          </tr></thead>
          <tbody>
            {inv.lines.map((l, i) => { const t = lineTotals(l); return (
              <tr key={i}>
                <td>{i + 1}</td><td style={{ whiteSpace: 'normal' }}>{l.desc}</td><td className="r">{qty(l.qty)}</td><td>{l.unit}</td>
                <td className="r">{amount(vat ? r2(l.price / (1 + l.vat / 100)) : l.price)}</td>
                {vat && <><td className="r">{amount(t.net)}</td><td className="r">{amount(t.vat)} <small>({l.vat}%)</small></td></>}
                <td className="r">{amount(t.total)}</td>
              </tr>
            ); })}
          </tbody>
        </table>
      </div>
      <div className="totals">
        {vat && <><div><span>Total fără TVA</span><span>{amount(inv.subtotal)} RON</span></div><div><span>TVA</span><span>{amount(inv.vat)} RON</span></div></>}
        <div className="big"><span>Total de plată</span><span>{amount(inv.total)} RON</span></div>
        {reservation && got > 0 && <div><span>Încasat</span><span>{amount(got)} RON</span></div>}
        {reservation && got > 0 && <div><span>Rest de plată</span><span>{amount(r2(inv.total - got))} RON</span></div>}
      </div>
      {inv.notes && <div className="foot" style={{ color: '#111', fontSize: 12.5, whiteSpace: 'pre-wrap' }}>{inv.notes}</div>}
      <div className="foot">
        <span>Factura este valabilă fără semnătură și ștampilă (art. 319 alin. (29) din Codul fiscal).</span>
      </div>
    </div>
  );
}
