import { audit } from '@/lib/audit';
import { getDb } from '@/lib/db';
import { handle, handleOwner, readJson } from '@/lib/http';
import { getTemplate, saveTemplate } from '@/lib/settings';

export const dynamic = 'force-dynamic';

/** Șablonul confirmării. Îl citește oricine e intrat în cont; îl schimbă numai proprietarul. */
export async function GET() { return handle(async () => getTemplate(await getDb())); }

export async function PUT(req: Request) {
  return handleOwner(async user => {
    const db = await getDb(), out = await saveTemplate(db, ((await readJson(req)) as { template?: unknown }).template);
    await audit(db, user, 'settings.template', 'settings');
    return out;
  });
}
