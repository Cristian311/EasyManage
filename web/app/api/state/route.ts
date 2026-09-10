import { getDb } from '@/lib/db';
import { handle } from '@/lib/http';
import { loadState } from '@/lib/repo';

export const dynamic = 'force-dynamic';

/** Everything the front desk needs in one go: properties, rooms, guests, reservations, rates, expenses. */
export async function GET() {
  return handle(async () => loadState(await getDb()));
}
