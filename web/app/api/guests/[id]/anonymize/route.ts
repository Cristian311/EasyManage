import { audit } from '@/lib/audit';
import { getDb } from '@/lib/db';
import { handleOwner } from '@/lib/http';
import { anonymizeGuest } from '@/lib/privacy';

export const dynamic = 'force-dynamic';

/** Șterge datele personale ale unui oaspete; șederile, banii și facturile rămân. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleOwner(async user => {
    const db = await getDb(), out = await anonymizeGuest(db, id);
    await audit(db, user, 'guest.anonymize', 'guest', id, out.invoicesKept ? `${out.invoicesKept} facturi păstrate, cum cere legea` : '');
    return out;
  });
}
