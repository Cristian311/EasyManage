import { getDb } from '@/lib/db';
import { handle, readJson } from '@/lib/http';
import { deleteFloor, updateFloor } from '@/lib/repo-admin';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };
export async function PATCH(req: Request, { params }: Ctx) { const { id } = await params; return handle(async () => updateFloor(await getDb(), id, await readJson(req))); }
export async function DELETE(_req: Request, { params }: Ctx) { const { id } = await params; return handle(async () => deleteFloor(await getDb(), id)); }
