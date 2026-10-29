import { getDb } from '@/lib/db';
import { handle } from '@/lib/http';
import { listFeeds } from '@/lib/ical';

export const dynamic = 'force-dynamic';

/** Pentru pagina Azi, deci și pentru recepție: doar camera, site-ul și ce nu a mers. Linkurile rămân la proprietar. */
export async function GET() {
  return handle(async () => ({
    problems: (await listFeeds(await getDb())).filter(f => f.lastError).map(f => ({ roomName: f.roomName, source: f.source, error: f.lastError })),
  }));
}
