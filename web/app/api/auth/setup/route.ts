import { countUsers, createUser, startSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { handleOpen, readJson, setSessionCookie } from '@/lib/http';

export const dynamic = 'force-dynamic';

/**
 * Primul cont, cel al proprietarului. Merge o singură dată: din clipa în care există un cont,
 * conturile noi se fac numai din Setări, de către proprietar.
 */
export async function POST(req: Request) {
  return handleOpen(async () => {
    const db = await getDb();
    if (await countUsers(db) > 0) throw new DomainError(409, 'Programul are deja conturi. Intră cu contul tău.');
    const user = await createUser(db, await readJson(req), 'owner');
    await setSessionCookie(await startSession(db, user.id));
    return { user };
  }, 201);
}
