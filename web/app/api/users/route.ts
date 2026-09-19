import { createUser, listUsers } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { handleOwner, readJson } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handleOwner(async () => ({ users: await listUsers(await getDb()) }));
}

/** { email, password, name, role } — un cont nou pentru recepție sau încă un proprietar. */
export async function POST(req: Request) {
  return handleOwner(async () => {
    const db = await getDb();
    await createUser(db, await readJson(req));
    return { users: await listUsers(db) };
  }, 201);
}
