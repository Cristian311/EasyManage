import { audit } from '@/lib/audit';
import { getDb } from '@/lib/db';
import { handleOwner, readJson } from '@/lib/http';
import { createExpense } from '@/lib/repo-admin';

export const dynamic = 'force-dynamic';

// cheltuielile țin de Financiar: numai proprietarul
export async function POST(req: Request) {
  return handleOwner(async user => {
    const db = await getDb(), out = await createExpense(db, await readJson(req));
    await audit(db, user, 'expense.create', 'expense', out.expense.id, `${out.expense.amount} lei · ${out.expense.category}${out.expense.desc ? ' · ' + out.expense.desc : ''}`);
    return out;
  }, 201);
}
