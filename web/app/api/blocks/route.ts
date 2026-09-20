import { audit } from '@/lib/audit';
import { createBlock } from '@/lib/blocks';
import { getDb } from '@/lib/db';
import { handle, readJson } from '@/lib/http';
import { loadState } from '@/lib/repo';

export const dynamic = 'force-dynamic';

/** { roomIds, checkIn, checkOut, reason } — și recepția poate bloca o cameră stricată. */
export async function POST(req: Request) {
  return handle(async user => {
    const db = await getDb(), { reservation } = await createBlock(db, await readJson(req));
    await audit(db, user, 'block.create', 'reservation', reservation.id, `${reservation.notes}, ${reservation.checkIn} – ${reservation.checkOut}`);
    return loadState(db);
  }, 201);
}
