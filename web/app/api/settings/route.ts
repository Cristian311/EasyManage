import { audit } from '@/lib/audit';
import { getDb } from '@/lib/db';
import { handleOwner, readJson } from '@/lib/http';
import { getCompany, saveCompany } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handleOwner(async () => ({ company: await getCompany(await getDb()) }));
}

export async function PUT(req: Request) {
  return handleOwner(async user => {
    const db = await getDb(), company = await saveCompany(db, await readJson(req));
    await audit(db, user, 'settings.company', 'settings', '', company.name);
    return { company };
  });
}
