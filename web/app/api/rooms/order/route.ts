import { getDb } from '@/lib/db';
import { handle, readJson } from '@/lib/http';
import { orderRooms } from '@/lib/repo-admin';
export const dynamic = 'force-dynamic';
export async function PUT(req: Request) { return handle(async () => orderRooms(await getDb(), await readJson(req))); }
