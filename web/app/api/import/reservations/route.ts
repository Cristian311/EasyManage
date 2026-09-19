import { getDb } from '@/lib/db';
import { handleOwner, readJson } from '@/lib/http';
import { importReservations } from '@/lib/import';

export const dynamic = 'force-dynamic';

/** { csv, dryRun } — cu dryRun (implicit) doar verifică și spune ce s-ar întâmpla; cu dryRun:false scrie rândurile bune. */
export async function POST(req: Request) {
  return handleOwner(async () => importReservations(await getDb(), await readJson(req)));
}
