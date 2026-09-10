import { getDb } from '@/lib/db';
import { handle, readJson } from '@/lib/http';
import { createReservation } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handle(async () => createReservation(await getDb(), await readJson(req)), 201);
}
