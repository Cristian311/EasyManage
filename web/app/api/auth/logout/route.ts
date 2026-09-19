import { endSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { clearSessionCookie, handleOpen, sessionToken } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function POST() {
  return handleOpen(async () => {
    await endSession(await getDb(), await sessionToken());
    await clearSessionCookie();
    return { ok: true };
  });
}
