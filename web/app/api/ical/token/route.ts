import { audit } from '@/lib/audit';
import { getDb } from '@/lib/db';
import { handleOwner, readJson } from '@/lib/http';
import { exportToken } from '@/lib/ical';

export const dynamic = 'force-dynamic';

/** { roomId, renew? } -> calea linkului de calendar al camerei. `renew` face unul nou și îl oprește pe cel vechi. */
export async function POST(req: Request) {
  return handleOwner(async me => {
    const b = (await readJson(req)) as { roomId?: unknown; renew?: unknown };
    const db = await getDb(), roomId = typeof b.roomId === 'string' ? b.roomId : '';
    const token = await exportToken(db, roomId, b.renew === true);
    if (b.renew === true) await audit(db, me, 'ical.renew', 'room', roomId);
    return { path: `/api/ical/export/${token}.ics` };
  });
}
