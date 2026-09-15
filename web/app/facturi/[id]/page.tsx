'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useData, useStore } from '@/lib/client/store';
import { invoiceNo } from '@/domain/invoice';
import InvoiceSheet from '@/components/InvoiceSheet';
import { IconPrint } from '@/components/Icons';
import { useGoToReservation } from '@/components/useGoToReservation';

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const data = useData(), cancel = useStore(s => s.cancelInvoice), goTo = useGoToReservation();
  const inv = data.invoices.find(i => i.id === id);
  if (!inv) return (
    <section className="page on"><div className="topbar"><Link className="btn ghost" href="/facturi">← Facturi</Link></div>
      <div className="scroll"><div className="ph"><h2>Factura nu există</h2><p>Poate a fost emisă pe alt calculator; reîncarcă pagina.</p></div></div></section>
  );
  const r = inv.reservationId ? data.reservations.find(x => x.id === inv.reservationId) : undefined;
  const no = invoiceNo(inv);
  return (
    <section className="page on" id="page-invoice">
      <div className="topbar no-print">
        <Link className="btn ghost" href="/facturi">← Facturi</Link>
        <h1>Factura {no}</h1>
        {inv.status === 'cancelled' && <span className="pill cancelled"><i />Anulată</span>}
        <div className="spacer" />
        {r && <button className="btn" onClick={() => goTo(r)}>Rezervarea</button>}
        {inv.status === 'issued' && <button className="btn danger" onClick={() => { if (confirm(`Anulezi factura ${no}? Rămâne în registru ca anulată, iar rezervarea poate fi facturată din nou.`)) cancel(inv.id); }}>Anulează</button>}
        <button className="btn primary" onClick={() => window.print()}><IconPrint />Tipărește / PDF</button>
      </div>
      <div className="scroll"><InvoiceSheet inv={inv} reservation={r} /></div>
    </section>
  );
}
