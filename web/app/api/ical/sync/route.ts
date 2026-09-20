import { audit } from '@/lib/audit';
import { getDb } from '@/lib/db';
import { handleOwner } from '@/lib/http';
import { listFeeds, syncAll } from '@/lib/ical';
import { loadState } from '@/lib/repo';

export const dynamic = 'force-dynamic';

/** Citește acum toate calendarele, fără să aștepte sfertul de oră. */
export async function POST() {
  return handleOwner(async me => {
    const db = await getDb(), report = await syncAll(db);
    const sum = (k: 'added' | 'changed' | 'cancelled') => report.reduce((s, r) => s + r[k], 0);
    await audit(db, me, 'ical.sync', '', '', `${sum('added')} noi, ${sum('changed')} mutate, ${sum('cancelled')} anulate, ${report.reduce((s, r) => s + r.conflicts.length, 0)} conflicte`);
    return { report, feeds: await listFeeds(db), state: await loadState(db) };
  });
}
