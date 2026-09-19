// Stratul dintre rutele API și restul: ce ajunge la browser ca răspuns și ce cod are.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DomainError, isRoomTaken } from './errors';
import { handle, readJson } from './http';

afterEach(() => vi.restoreAllMocks());

const post = (body: string) => new Request('http://localhost/api/test', { method: 'POST', body, headers: { 'Content-Type': 'application/json' } });

describe('handle', () => {
  it('trimite rezultatul ca JSON, cu codul cerut', async () => {
    const res = await handle(async () => ({ ok: 1 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: 1 });
    expect((await handle(async () => ({ id: 'x' }), 201)).status).toBe(201);
  });
  it('trimite mesajul unei DomainError, cu codul ei', async () => {
    const res = await handle(async () => { throw new DomainError(409, 'Camera este ocupată.'); });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Camera este ocupată.' });
  });
  it('orice altă eroare devine 500 cu un mesaj general, fără detalii tehnice', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await handle(async () => { throw new Error('ER_ACCESS_DENIED_ERROR: parola gresita'); });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Eroare pe server. Încearcă din nou.' });
    expect(log).toHaveBeenCalled();     // dar în consola serverului rămâne
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
