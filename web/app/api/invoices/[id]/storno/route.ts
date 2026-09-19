import { getDb } from '@/lib/db';
import { handleOwner } from '@/lib/http';
import { listInvoices, stornoInvoice } from '@/lib/invoices';

export const dynamic = 'force-dynamic';

/** Emite factura de stornare care o anulează pe aceasta. Cea veche rămâne în registru. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleOwner(async () => {
    const db = await getDb();
    const invoice = await stornoInvoice(db, id);
    return { invoice, invoices: await listInvoices(db) };
  }, 201);
}
