// Stratul dintre rutele API și restul: cine are voie, ce ajunge la browser ca răspuns și ce cod are.
// Cookie-ul, baza de date și căutarea sesiunii sunt înlocuite aici; sesiunile adevărate se testează în auth.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from './auth';
import { DomainError, isRoomTaken } from './errors';
import { handle, handleOpen, handleOwner, readJson } from './http';

const fake = vi.hoisted(() => ({ token: undefined as string | undefined, user: null as User | null }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => (fake.token ? { value: fake.token } : undefined), set: () => {}, delete: () => {} }),
  headers: async () => ({ get: () => null }),
}));
vi.mock('./db', () => ({ getDb: async () => ({}) }));
vi.mock('./auth', async orig => ({ ...(await orig<typeof import('./auth')>()), userForToken: async () => fake.user }));

const user = (role: User['role']): User => ({ id: 'u1', email: 'a@b.ro', name: 'Ana', role, active: true });
const login = (role: User['role']) => { fake.token = 'jeton'; fake.user = user(role); };

beforeEach(() => { fake.token = undefined; fake.user = null; });
afterEach(() => vi.restoreAllMocks());

const post = (body: string) => new Request('http://localhost/api/test', { method: 'POST', body, headers: { 'Content-Type': 'application/json' } });

describe('handleOpen', () => {
  it('trimite rezultatul ca JSON, cu codul cerut', async () => {
    const res = await handleOpen(async () => ({ ok: 1 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: 1 });
    expect((await handleOpen(async () => ({ id: 'x' }), 201)).status).toBe(201);
  });
  it('trimite mesajul unei DomainError, cu codul ei', async () => {
    const res = await handleOpen(async () => { throw new DomainError(409, 'Camera este ocupată.'); });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Camera este ocupată.' });
  });
  it('orice altă eroare devine 500 cu un mesaj general, fără detalii tehnice', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await handleOpen(async () => { throw new Error('ER_ACCESS_DENIED_ERROR: parola gresita'); });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Eroare pe server. Încearcă din nou.' });
    expect(log).toHaveBeenCalled();     // dar în consola serverului rămâne
  });
});

describe('handle: fără cont nu se vede nimic', () => {
  it('fără cookie răspunde 401 și nu rulează ruta', async () => {
    const ran = vi.fn();
    const res = await handle(async () => { ran(); return { ok: 1 }; });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Trebuie să intri în cont.' });
    expect(ran).not.toHaveBeenCalled();
  });
  it('cu un cookie care nu duce la nicio sesiune tot 401', async () => {
    fake.token = 'jeton-inventat';
    expect((await handle(async () => ({ ok: 1 }))).status).toBe(401);
  });
  it('cu sesiune bună merge, iar contul ajunge la rută', async () => {
    login('reception');
    const res = await handle(async u => ({ cine: u.name, rol: u.role }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ cine: 'Ana', rol: 'reception' });
  });
});

describe('handleOwner: numai proprietarul', () => {
  it('recepția primește 403 și ruta nu rulează', async () => {
    login('reception');
    const ran = vi.fn();
    const res = await handleOwner(async () => { ran(); return { sume: 1 }; });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Numai proprietarul are acces aici.' });
    expect(ran).not.toHaveBeenCalled();
  });
  it('proprietarul trece', async () => {
    login('owner');
    expect((await handleOwner(async () => ({ sume: 1 }))).status).toBe(200);
  });
  it('fără cont e tot 401, nu 403', async () => {
    expect((await handleOwner(async () => ({ sume: 1 }))).status).toBe(401);
  });
});

describe('readJson', () => {
  it('citește corpul cererii', async () => expect(await readJson(post('{"a":1}'))).toEqual({ a: 1 }));
  it('un corp stricat sau gol e cerere invalidă, nu eroare de server', async () => {
    for (const body of ['nu e json', '']) {
      await expect(readJson(post(body))).rejects.toThrow(/Cerere invalidă/);
      await expect(readJson(post(body))).rejects.toMatchObject({ status: 400 });
    }
  });
});

describe('isRoomTaken', () => {
  it('recunoaște cheia dublă de pe room_nights', () => {
    expect(isRoomTaken({ errno: 1062, message: "Duplicate entry 'r1-2026-09-10' for key 'room_nights.room_is_free'" })).toBe(true);
    expect(isRoomTaken({ code: 'ER_DUP_ENTRY', message: "Duplicate entry for key 'room_is_free'" })).toBe(true);
  });
  it('nu confundă altă cheie dublă cu o cameră ocupată', () => {
    expect(isRoomTaken({ errno: 1062, message: "Duplicate entry 'p1' for key 'PRIMARY'" })).toBe(false);
    expect(isRoomTaken({ errno: 1452, message: 'foreign key' })).toBe(false);
    expect(isRoomTaken(new Error('room_is_free'))).toBe(false);
    expect(isRoomTaken(null)).toBe(false);
    expect(isRoomTaken('room_is_free')).toBe(false);
  });
});
