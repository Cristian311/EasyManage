import { ACTIONS, listAudit } from '@/lib/audit';
import { getDb } from '@/lib/db';
import { handleOwner } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** Jurnalul, cele mai noi întâi; ?q= caută în rezumat, în numele omului și în felul acțiunii. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q') ?? '';
  return handleOwner(async () => ({ rows: await listAudit(await getDb(), q), actions: ACTIONS }));
}
