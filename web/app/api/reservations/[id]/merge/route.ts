import { audit, resLabel } from '@/lib/audit';
import { getDb } from '@/lib/db';
import { handle, readJson } from '@/lib/http';
import { mergeReservations } from '@/lib/repo-admin';

export const dynamic = 'force-dynamic';

/** Joins the stay { otherId } into this one: same guest, same nights, rooms side by side. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async user => {
    const db = await getDb(), out = await mergeReservations(db, id, await readJson(req));
    await audit(db, user, 'reservation.merge', 'reservation', id, await resLabel(db, id));
    return out;
  });
}
