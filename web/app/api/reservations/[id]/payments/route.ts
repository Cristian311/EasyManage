import { getDb } from '@/lib/db';
import { handle, readJson } from '@/lib/http';
import { addPayment } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async () => addPayment(await getDb(), id, await readJson(req)), 201);
}
