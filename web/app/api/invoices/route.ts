import { audit } from '@/lib/audit';
import { getDb } from '@/lib/db';
import { handleOwner, readJson } from '@/lib/http';
import { createInvoice, draftFor, listInvoices } from '@/lib/invoices';
import { invoiceNo } from '@/domain/invoice';

export const dynamic = 'force-dynamic';

/** Lista facturilor; cu ?draft=<id rezervare> întoarce factura propusă pentru acea ședere. */
export async function GET(req: Request) {
  const draft = new URL(req.url).searchParams.get('draft');
  return handleOwner(async () => {
    const db = await getDb();
    return draft ? { draft: await draftFor(db, draft) } : { invoices: await listInvoices(db) };
  });
}

export async function POST(req: Request) {
  return handleOwner(async user => {
    const db = await getDb(), invoice = await createInvoice(db, await readJson(req));
    await audit(db, user, 'invoice.create', 'invoice', invoice.id, `${invoiceNo(invoice.series, invoice.number)} · ${invoice.buyerName} · ${invoice.total} lei`);
    return { invoice };
  }, 201);
}
