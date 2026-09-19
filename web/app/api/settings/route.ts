import { getDb } from '@/lib/db';
import { handleOwner, readJson } from '@/lib/http';
import { getCompany, saveCompany } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handleOwner(async () => ({ company: await getCompany(await getDb()) }));
}

export async function PUT(req: Request) {
  return handleOwner(async () => ({ company: await saveCompany(await getDb(), await readJson(req)) }));
}
