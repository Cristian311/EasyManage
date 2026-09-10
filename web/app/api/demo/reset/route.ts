import { getDb } from '@/lib/db';
import { handle } from '@/lib/http';
import { loadState } from '@/lib/repo';
import { resetDemo } from '@/lib/seed';

export const dynamic = 'force-dynamic';

/** Deletes everything and loads the demo villas again. Only while the app runs on demo data. */
export async function POST() {
  return handle(async () => {
    const db = await getDb();
    await resetDemo(db);
    return loadState(db);
  });
}
