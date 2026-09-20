import { audit } from '@/lib/audit';
import { deleteBlock } from '@/lib/blocks';
import { getDb } from '@/lib/db';
import { handle } from '@/lib/http';
import { loadState } from '@/lib/repo';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async user => {
    const db = await getDb(), r = await deleteBlock(db, id);
    await audit(db, user, 'block.delete', 'reservation', id, `${r.notes}, ${r.checkIn} – ${r.checkOut}`);
    return loadState(db);
  });
}
