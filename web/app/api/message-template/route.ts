import { audit } from '@/lib/audit';
import { getDb } from '@/lib/db';
import { handle, handleOwner, readJson } from '@/lib/http';
import { getTemplate, saveTemplate } from '@/lib/settings';

export const dynamic = 'force-dynamic';

/** Șablonul confirmării. Îl citește oricine e intrat în cont; îl schimbă numai proprietarul. */
export async function GET() { return handle(async () => getTemplate(await getDb())); }

export async function PUT(req: Request) {
  return handleOwner(async user => {
    const b = (await readJson(req)) as { template?: unknown; lang?: unknown };
    const lang = b.lang === 'en' ? 'en' : 'ro';
    const db = await getDb(), out = await saveTemplate(db, b.template, lang);
    await audit(db, user, 'settings.template', 'settings', '', lang === 'en' ? 'engleză' : 'română');
    return out;
  });
}
