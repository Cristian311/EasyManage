import { getDb } from '@/lib/db';
import { handle, readJson } from '@/lib/http';
import { updateGuest } from '@/lib/repo';

export const dynamic = 'force-dynamic';

/** Nume, contact și actul de identitate al unui oaspete. Și recepția are voie: fișa de cazare se face la sosire. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async () => updateGuest(await getDb(), id, await readJson(req)));
}
