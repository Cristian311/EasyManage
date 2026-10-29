import { audit } from '@/lib/audit';
import { getDb } from '@/lib/db';
import { handle, handleOwner, readJson } from '@/lib/http';
import { getContact, saveHours } from '@/lib/settings';

export const dynamic = 'force-dynamic';

/** Datele de contact și orele, pentru confirmarea tipărită. Le citește și recepția, pentru că ea o tipărește. */
export async function GET() { return handle(async () => ({ contact: await getContact(await getDb()) })); }

/** { checkIn, checkOut } — orele; restul datelor se schimbă din cardul pensiunii. */
export async function PUT(req: Request) {
  return handleOwner(async user => {
    const db = await getDb(), hours = await saveHours(db, await readJson(req));
    await audit(db, user, 'settings.hours', 'settings', '', `${hours.checkIn} – ${hours.checkOut}`);
    return { contact: await getContact(db) };
  });
}
