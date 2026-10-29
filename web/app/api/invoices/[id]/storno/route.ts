import { audit } from '@/lib/audit';
import { getDb } from '@/lib/db';
import { handleOwner } from '@/lib/http';
import { listInvoices, stornoInvoice } from '@/lib/invoices';
import { invoiceNo } from '@/domain/invoice';

export const dynamic = 'force-dynamic';

/** Emite factura de stornare care o anulează pe aceasta. Cea veche rămâne în registru. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleOwner(async user => {
    const db = await getDb(), invoice = await stornoInvoice(db, id);
    await audit(db, user, 'invoice.storno', 'invoice', id, `${invoiceNo(invoice.series, invoice.number)} · ${invoice.note}`);
    return { invoice, invoices: await listInvoices(db) };
  }, 201);
}
