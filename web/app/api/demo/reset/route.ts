import { audit } from '@/lib/audit';
import { getDb } from '@/lib/db';
import { handleOwner } from '@/lib/http';
import { loadState } from '@/lib/repo';
import { resetDemo } from '@/lib/seed';

export const dynamic = 'force-dynamic';

/** Deletes everything and loads the demo villas again. Only while the app runs on demo data. */
export async function POST() {
  return handleOwner(async user => {
    const db = await getDb();
    await resetDemo(db);
    await audit(db, user, 'demo.reset');
    return loadState(db);
  });
}
