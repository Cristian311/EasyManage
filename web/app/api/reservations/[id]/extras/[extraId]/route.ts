import { audit, resLabel } from '@/lib/audit';
import { getDb } from '@/lib/db';
import { handle } from '@/lib/http';
import { deleteExtra } from '@/lib/repo';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string; extraId: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id, extraId } = await params;
  return handle(async user => {
    const db = await getDb(), out = await deleteExtra(db, id, extraId);
    await audit(db, user, 'extra.delete', 'reservation', id, await resLabel(db, id));
    return out;
  });
}
