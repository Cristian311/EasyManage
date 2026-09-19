import { audit, resLabel } from '@/lib/audit';
import { getDb } from '@/lib/db';
import { handle, readJson } from '@/lib/http';
import { createReservation } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handle(async user => {
    const db = await getDb(), out = await createReservation(db, await readJson(req));
    await audit(db, user, 'reservation.create', 'reservation', out.reservation.id, await resLabel(db, out.reservation.id));
    return out;
  }, 201);
}
