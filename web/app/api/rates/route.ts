import { getDb } from '@/lib/db';
import { handle, readJson } from '@/lib/http';
import { setRates } from '@/lib/repo-admin';
export const dynamic = 'force-dynamic';
/** { roomIds, from, to, price | null, wkOnly } — sets or removes special prices on those nights */
export async function PUT(req: Request) { return handle(async () => setRates(await getDb(), await readJson(req))); }
