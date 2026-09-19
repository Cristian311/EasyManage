import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { COOKIE, SESSION_DAYS, userForToken, type User } from './auth';
import { getDb } from './db';
import { DomainError } from './errors';

async function run(fn: () => Promise<unknown>, status: number) {
  try {
    return NextResponse.json(await fn(), { status });
  } catch (e) {
    if (e instanceof DomainError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: 'Eroare pe server. Încearcă din nou.' }, { status: 500 });
  }
}

/** Contul din cookie, sau null. */
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return userForToken(await getDb(), token);
}

/**
 * Rulează o rută **numai pentru cine e autentificat**: rezultatul pleacă drept JSON, un DomainError
 * cu statusul și mesajul lui, orice altceva ca 500. Contul ajunge la funcție, dacă îi trebuie.
 * Asta e regula implicită: o rută nouă e închisă până când cineva scrie anume `handleOpen`.
 */
export async function handle(fn: (user: User) => Promise<unknown>, status = 200) {
  return run(async () => {
    const user = await currentUser();
    if (!user) throw new DomainError(401, 'Trebuie să intri în cont.');
    return fn(user);
  }, status);
}

/** Ca `handle`, dar numai proprietarul are voie (Financiar, Setări, conturi). */
export async function handleOwner(fn: (user: User) => Promise<unknown>, status = 200) {
  return handle(async user => {
    if (user.role !== 'owner') throw new DomainError(403, 'Numai proprietarul are acces aici.');
    return fn(user);
  }, status);
}

/** Fără cont: intrarea în program și crearea primului cont. */
export const handleOpen = (fn: () => Promise<unknown>, status = 200) => run(fn, status);

export async function readJson(req: Request): Promise<unknown> {
  try { return await req.json(); } catch { throw new DomainError(400, 'Cerere invalidă.'); }
}

/* ---------- cookie-ul de sesiune ---------- */

export async function setSessionCookie(token: string) {
  // „secure” numai când cererea a venit pe https; altfel telefonul din rețeaua de acasă, care intră pe
  // http://192.168..., nu ar mai trimite cookie-ul înapoi și intrarea în cont ar părea că nu merge
  const proto = (await headers()).get('x-forwarded-proto')?.split(',')[0].trim();
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,                                     // JavaScript din pagină nu îl poate citi
    sameSite: 'lax',
    secure: proto === 'https',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export const clearSessionCookie = async () => (await cookies()).delete(COOKIE);
export const sessionToken = async () => (await cookies()).get(COOKIE)?.value;
