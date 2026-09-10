import { getDb } from '@/lib/db';
import { handle, readJson } from '@/lib/http';
import { createExpense } from '@/lib/repo-admin';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) { return handle(async () => createExpense(await getDb(), await readJson(req)), 201); }
