import { audit, changed } from '@/lib/audit';
import { getDb } from '@/lib/db';
import { handle, readJson } from '@/lib/http';
import { deleteRoom, updateRoom } from '@/lib/repo-admin';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };
const FIELDS = { name: 'numele', city: 'orașul', type: 'tipul', capacity: 'capacitatea', price: 'prețul', color: 'culoarea', desc: 'descrierea', active: 'activă sau nu', propertyId: 'proprietatea', floorId: 'etajul', move: 'ordinea' };
const nameOf = async (id: string) => (await (await getDb()).query<{ name: string }>('SELECT name FROM rooms WHERE id = $1', [id]))[0]?.name ?? id;

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async user => {
    const db = await getDb(), body = await readJson(req), out = await updateRoom(db, id, body);
    await audit(db, user, 'room.update', 'room', id, `${await nameOf(id)} · a schimbat: ${changed(body, FIELDS) || '—'}`);
    return out;
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async user => {
    const db = await getDb(), name = await nameOf(id), out = await deleteRoom(db, id);
    await audit(db, user, 'room.delete', 'room', id, name);
    return out;
  });
}
