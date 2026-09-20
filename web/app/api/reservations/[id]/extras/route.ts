import { audit, resLabel } from '@/lib/audit';
import { getDb } from '@/lib/db';
import { handle, readJson } from '@/lib/http';
import { addExtra } from '@/lib/repo';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

/** { label, qty, unitPrice } — mic dejun, pat suplimentar, taxă de stațiune. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async user => {
    const db = await getDb(), body = await readJson(req), out = await addExtra(db, id, body);
    await audit(db, user, 'extra.add', 'reservation', id, `${(body as { label?: string }).label ?? ''} · ${await resLabel(db, id)}`);
    return out;
  }, 201);
}
