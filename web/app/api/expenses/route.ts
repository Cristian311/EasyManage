import { getDb } from '@/lib/db';
import { handleOwner, readJson } from '@/lib/http';
import { createExpense } from '@/lib/repo-admin';
export const dynamic = 'force-dynamic';
// cheltuielile țin de Financiar: numai proprietarul
export async function POST(req: Request) { return handleOwner(async () => createExpense(await getDb(), await readJson(req)), 201); }
