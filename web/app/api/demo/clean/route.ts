import { audit } from '@/lib/audit';
import { makeBackup } from '@/lib/backup';
import { getDb } from '@/lib/db';
import { handleOwner } from '@/lib/http';
import { loadState } from '@/lib/repo';
import { startClean } from '@/lib/seed';

export const dynamic = 'force-dynamic';

/** Șterge rezervările, oaspeții, prețurile speciale și cheltuielile; camerele rămân. Întâi face o copie de siguranță, dacă se poate. */
export async function POST() {
  return handleOwner(async user => {
    const db = await getDb();
    try { await makeBackup(db); } catch {}
    await startClean(db);
    await audit(db, user, 'demo.clean');
    return loadState(db);
  });
}
