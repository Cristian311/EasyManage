import { getDb } from '@/lib/db';
import { handle, readJson } from '@/lib/http';
import { deleteReservation, updateReservation } from '@/lib/repo';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => updateReservation(await getDb(), id, await readJson(req)));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => deleteReservation(await getDb(), id));
}
