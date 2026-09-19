import { audit } from '@/lib/audit';
import { getDb } from '@/lib/db';
import { handle, readJson } from '@/lib/http';
import { orderRooms } from '@/lib/repo-admin';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request) {
  return handle(async user => {
    const db = await getDb(), out = await orderRooms(db, await readJson(req));
    await audit(db, user, 'room.order', 'room');
    return out;
  });
}
