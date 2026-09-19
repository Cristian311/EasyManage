import { getDb } from '@/lib/db';
import { handleOwner, readJson } from '@/lib/http';
import { createInvoice, draftFor, listInvoices } from '@/lib/invoices';

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
  return handleOwner(async () => ({ invoice: await createInvoice(await getDb(), await readJson(req)) }), 201);
}
