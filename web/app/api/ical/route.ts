import { audit } from '@/lib/audit';
import { getDb } from '@/lib/db';
import { handleOwner, readJson } from '@/lib/http';
import { addFeed, listFeeds } from '@/lib/ical';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handleOwner(async () => ({ feeds: await listFeeds(await getDb()) }));
}

/** { roomId, source, url } */
export async function POST(req: Request) {
  return handleOwner(async me => {
    const db = await getDb(), f = await addFeed(db, await readJson(req));
    // linkul e secret (cine îl are vede ocuparea), deci în jurnal intră doar camera și sursa
    await audit(db, me, 'ical.add', 'room', f.roomId, `${f.roomName} · ${f.source}`);
    return { feeds: await listFeeds(db) };
  });
}
