import { audit } from '@/lib/audit';
import { login } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { handleOpen, readJson, setSessionCookie } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** { email, password } — la reușită pune cookie-ul de sesiune și întoarce contul. */
export async function POST(req: Request) {
  return handleOpen(async () => {
    const db = await getDb(), { user, token } = await login(db, await readJson(req));
    await setSessionCookie(token);
    await audit(db, user, 'user.login', 'user', user.id, user.email);
    return { user };
  });
}
