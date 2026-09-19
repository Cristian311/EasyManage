import { deleteUser, listUsers, updateUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { handleOwner, readJson } from '@/lib/http';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

/** { name, role, active, password } — oricare dintre ele. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  return handleOwner(async () => {
    const db = await getDb();
    await updateUser(db, id, await readJson(req));
    return { users: await listUsers(db) };
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return handleOwner(async me => {
    const db = await getDb();
    await deleteUser(db, id, me.id);
    return { users: await listUsers(db) };
  });
}
