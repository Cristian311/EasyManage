import { audit } from '@/lib/audit';
import { getDb } from '@/lib/db';
import { handleOwner, readJson } from '@/lib/http';
import { importReservations } from '@/lib/import';

export const dynamic = 'force-dynamic';

/** { csv, dryRun } — cu dryRun (implicit) doar verifică și spune ce s-ar întâmpla; cu dryRun:false scrie rândurile bune. */
export async function POST(req: Request) {
  return handleOwner(async user => {
    const db = await getDb(), rep = await importReservations(db, await readJson(req));
    if (rep.created) await audit(db, user, 'reservation.import', 'reservation', '', `${rep.created} importate, ${rep.bad} lăsate pe dinafară`);
    return rep;
  });
}
