import { getDb } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { handle, readJson } from '@/lib/http';
import { cancelInvoice } from '@/lib/repo-invoices';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };
/** The only change allowed on an issued invoice: cancelling it. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => {
    const b = (await readJson(req)) as { status?: unknown };
    if (b?.status !== 'cancelled') throw new DomainError(400, 'O factură emisă se poate doar anula.');
    return cancelInvoice(await getDb(), id);
  });
}
