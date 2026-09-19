import { audit, changed } from '@/lib/audit';
import { deleteUser, listUsers, updateUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { handleOwner, readJson } from '@/lib/http';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };
const FIELDS = { name: 'numele', role: 'rolul', active: 'pornit sau oprit', password: 'parola' };

/** { name, role, active, password } — oricare dintre ele. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  return handleOwner(async me => {
    const db = await getDb(), body = await readJson(req), u = await updateUser(db, id, body);
    // în jurnal intră că s-a schimbat parola, niciodată parola
    await audit(db, me, 'user.update', 'user', id, `${u.name} · a schimbat: ${changed(body, FIELDS) || '—'}`);
    return { users: await listUsers(db) };
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return handleOwner(async me => {
    const db = await getDb();
    const [u] = await db.query<{ name: string; email: string }>('SELECT name, email FROM users WHERE id = $1', [id]);
    await deleteUser(db, id, me.id);
    await audit(db, me, 'user.delete', 'user', id, u ? `${u.name} (${u.email})` : '');
    return { users: await listUsers(db) };
  });
}
