import { audit } from '@/lib/audit';
import { getDb } from '@/lib/db';
import { handleOwner } from '@/lib/http';
import { deleteFeed, listFeeds } from '@/lib/ical';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return handleOwner(async me => {
    const db = await getDb(), f = await deleteFeed(db, id);
    await audit(db, me, 'ical.delete', 'room', f.roomId, `${f.roomName} · ${f.source}`);
    return { feeds: await listFeeds(db) };
  });
}
