import { audit } from '@/lib/audit';
import { getDb } from '@/lib/db';
import { handle, readJson } from '@/lib/http';
import { createFloor } from '@/lib/repo-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handle(async user => {
    const db = await getDb(), body = (await readJson(req)) as { name?: unknown }, out = await createFloor(db, body);
    await audit(db, user, 'floor.create', 'floor', '', String(body.name ?? ''));
    return out;
  }, 201);
}
