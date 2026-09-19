import { countUsers } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { currentUser, handleOpen } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** Cine sunt. `setup: true` înseamnă că nu există încă niciun cont, deci urmează pagina de pornire. */
export async function GET() {
  return handleOpen(async () => {
    const user = await currentUser();
    return { user, setup: user ? false : (await countUsers(await getDb())) === 0 };
  });
}
