import { audit } from '@/lib/audit';
import { getDb } from '@/lib/db';
import { handle, readJson } from '@/lib/http';
import { setRates } from '@/lib/repo-admin';

export const dynamic = 'force-dynamic';

/** { roomIds, from, to, price | null, wkOnly } — sets or removes special prices on those nights */
export async function PUT(req: Request) {
  return handle(async user => {
    const db = await getDb(), b = (await readJson(req)) as { roomIds?: unknown[]; from?: string; to?: string; price?: number | null; wkOnly?: boolean };
    const out = await setRates(db, b);
    await audit(db, user, 'rates.set', 'rates', '', `${b.roomIds?.length ?? 0} camere, ${b.from} – ${b.to}${b.wkOnly ? ', doar weekend' : ''}: ${b.price === null ? 'înapoi la prețul de bază' : b.price + ' lei'}`);
    return out;
  });
}
