import { getDb } from '@/lib/db';
import { handle, readJson } from '@/lib/http';
import { deleteExpense, updateExpense } from '@/lib/repo-admin';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };
export async function PATCH(req: Request, { params }: Ctx) { const { id } = await params; return handle(async () => updateExpense(await getDb(), id, await readJson(req))); }
export async function DELETE(_req: Request, { params }: Ctx) { const { id } = await params; return handle(async () => deleteExpense(await getDb(), id)); }
