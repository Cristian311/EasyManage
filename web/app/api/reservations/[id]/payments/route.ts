import { audit, resLabel } from '@/lib/audit';
import { getDb } from '@/lib/db';
import { handle, readJson } from '@/lib/http';
import { addPayment } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async user => {
    const db = await getDb(), body = (await readJson(req)) as { amount?: unknown; method?: unknown }, out = await addPayment(db, id, body);
    await audit(db, user, 'payment.add', 'reservation', id, `${body.amount} lei (${body.method ?? 'cash'}) · ${await resLabel(db, id)}`);
    return out;
  }, 201);
}
