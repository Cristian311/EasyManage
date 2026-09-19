import { audit } from '@/lib/audit';
import { getDb } from '@/lib/db';
import { handleOwner } from '@/lib/http';
import { exportGuest } from '@/lib/privacy';

export const dynamic = 'force-dynamic';

/** Tot ce ține programul despre un oaspete, pentru când îți cere o copie a datelor lui. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleOwner(async user => {
    const db = await getDb(), out = await exportGuest(db, id);
    await audit(db, user, 'guest.export', 'guest', id);
    return out;
  });
}
