import { NextResponse, type NextRequest } from 'next/server';

// Numele e scris aici de mână: middleware-ul rulează în afara serverului obișnuit, deci nu poate
// importa lib/auth.ts (care folosește node:crypto și baza de date). Trebuie să fie același cu COOKIE de acolo.
const COOKIE = 'velora_ses';
const OPEN = ['/intrare', '/start'];

/**
 * Doar ca să nu se vadă o clipă rama programului înainte de a fi dus la pagina de intrare.
 * Verificarea adevărată se face pe server, la fiecare cerere din app/api (vezi lib/http.ts):
 * un cookie inventat trece de aici, dar nu primește niciun dată.
 */
export function middleware(req: NextRequest) {
  if (req.cookies.has(COOKIE) || OPEN.includes(req.nextUrl.pathname)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = '/intrare';
  return NextResponse.redirect(url);
}

// paginile, fără /api (acolo răspunsul corect e 401, nu o redirectare), fără fișierele statice
export const config = { matcher: ['/((?!api/|_next/|favicon|demo\\.html|.*\\.[a-z0-9]+$).*)'] };
