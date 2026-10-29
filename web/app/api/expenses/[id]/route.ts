import { audit } from '@/lib/audit';
import { getDb } from '@/lib/db';
import { handleOwner, readJson } from '@/lib/http';
import { deleteExpense, updateExpense } from '@/lib/repo-admin';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  return handleOwner(async user => {
    const db = await getDb(), out = await updateExpense(db, id, await readJson(req));
    await audit(db, user, 'expense.update', 'expense', id, `${out.expense.amount} lei · ${out.expense.category}${out.expense.desc ? ' · ' + out.expense.desc : ''}`);
    return out;
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return handleOwner(async user => {
    const db = await getDb();
    const [e] = await db.query<{ amount: number; category: string }>('SELECT amount, category FROM expenses WHERE id = $1', [id]);
    const out = await deleteExpense(db, id);
    await audit(db, user, 'expense.delete', 'expense', id, e ? `${e.amount} lei · ${e.category}` : '');
    return out;
  });
}
