import { audit } from '@/lib/audit';
import { createUser, listUsers } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { handleOwner, readJson } from '@/lib/http';
import { ROLE } from '@/domain/labels';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handleOwner(async () => ({ users: await listUsers(await getDb()) }));
}

/** { email, password, name, role } — un cont nou pentru recepție sau încă un proprietar. */
export async function POST(req: Request) {
  return handleOwner(async me => {
    const db = await getDb(), u = await createUser(db, await readJson(req));
    await audit(db, me, 'user.create', 'user', u.id, `${u.name} (${u.email}), ${ROLE[u.role]}`);
    return { users: await listUsers(db) };
  }, 201);
}
