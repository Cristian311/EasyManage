import { login } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { handleOpen, readJson, setSessionCookie } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** { email, password } — la reușită pune cookie-ul de sesiune și întoarce contul. */
export async function POST(req: Request) {
  return handleOpen(async () => {
    const { user, token } = await login(await getDb(), await readJson(req));
    await setSessionCookie(token);
    return { user };
  });
}
