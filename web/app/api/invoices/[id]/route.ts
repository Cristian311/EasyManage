import { getDb } from '@/lib/db';
import { handleOwner } from '@/lib/http';
import { readInvoice } from '@/lib/invoices';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleOwner(async () => ({ invoice: await readInvoice(await getDb(), id) }));
}
