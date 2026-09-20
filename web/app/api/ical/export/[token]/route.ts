import { getDb } from '@/lib/db';
import { exportIcs } from '@/lib/ical';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ token: string }> };

/**
 * Deschisă fără cont, anume: o citesc Booking și Airbnb, care nu au cum să intre în program. Codul lung din
 * adresă ține loc de parolă, iar răspunsul spune doar ce nopți sunt ocupate: fără nume, fără telefon, fără bani.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const token = (await params).token.replace(/\.ics$/i, '');
  try {
    const ics = await exportIcs(await getDb(), token);
    if (!ics) return new Response('Not found', { status: 404 });
    return new Response(ics, { headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'no-store' } });
  } catch (e) {
    console.error(e);
    return new Response('Error', { status: 500 });
  }
}
