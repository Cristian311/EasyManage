import { getDb } from '@/lib/db';
import { handle, readJson } from '@/lib/http';
import { createInvoice } from '@/lib/repo-invoices';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) { return handle(async () => createInvoice(await getDb(), await readJson(req)), 201); }
