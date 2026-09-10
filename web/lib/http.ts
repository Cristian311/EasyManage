import { NextResponse } from 'next/server';
import { DomainError } from './errors';

/** Runs a route: the result goes back as JSON, a DomainError as its status and message, anything else as 500. */
export async function handle(fn: () => Promise<unknown>, status = 200) {
  try {
    return NextResponse.json(await fn(), { status });
  } catch (e) {
    if (e instanceof DomainError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: 'Eroare pe server. Încearcă din nou.' }, { status: 500 });
  }
}

export async function readJson(req: Request): Promise<unknown> {
  try { return await req.json(); } catch { throw new DomainError(400, 'Cerere invalidă.'); }
}
