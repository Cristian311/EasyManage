import { getDb } from '@/lib/db';
import { handle, readJson } from '@/lib/http';
import { loadSettings, updateSettings } from '@/lib/repo-invoices';
export const dynamic = 'force-dynamic';
export async function GET() { return handle(async () => ({ settings: await loadSettings((await getDb()).query) })); }
export async function PUT(req: Request) { return handle(async () => updateSettings(await getDb(), await readJson(req))); }
