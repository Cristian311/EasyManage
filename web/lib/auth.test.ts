// Conturi, parole și sesiuni, pe un MySQL adevărat.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Db } from './db';
import { freshDb } from './testdb';
import { DomainError } from './errors';
import {
  countUsers, createUser, deleteUser, endSession, hashPassword, listUsers, login,
  startSession, updateUser, userForToken, verifyPassword,
} from './auth';

let db: Db;
beforeAll(async () => { db = await freshDb(); }, 120_000);
afterAll(() => db.close());
beforeEach(() => db.tx(async q => { await q('DELETE FROM sessions'); await q('DELETE FROM users'); }));

const status = async (p: Promise<unknown>) => { try { await p; return 200; } catch (e) { return e instanceof DomainError ? e.status : 500; } };
const owner = () => createUser(db, { email: 'Ion@Exemplu.RO ', name: '  Ion Popescu ', password: 'parola-buna' }, 'owner');
const desk = (over = {}) => createUser(db, { email: 'ana@exemplu.ro', name: 'Ana Rusu', password: 'parola-buna', ...over });

describe('parole', () => {
  it('aceeași parolă dă amprente diferite, dar se verifică amândouă', async () => {
    const a = await hashPassword('secret12'), b = await hashPassword('secret12');
    expect(a).not.toBe(b);                       // sare nouă de fiecare dată
    expect(a).not.toContain('secret12');
    expect(await verifyPassword('secret12', a)).toBe(true);
    expect(await verifyPassword('secret12', b)).toBe(true);
    expect(await verifyPassword('secret13', a)).toBe(false);
  });
  it('o amprentă stricată nu lasă pe nimeni să intre', async () => {
    for (const bad of ['', 'x', 'scrypt$', 'md5$aa$bb']) expect(await verifyPassword('secret12', bad)).toBe(false);
  });
  it('cere cel puțin 8 caractere și un email adevărat', async () => {
    expect(await status(createUser(db, { email: 'a@b.ro', password: 'scurt' }))).toBe(400);
    expect(await status(createUser(db, { email: 'nu-e-email', password: 'parola-buna' }))).toBe(400);
  });
});

describe('conturi', () => {
  it('creează, curăță emailul și numele, pune rolul cerut', async () => {
    const u = await owner();
    expect(u).toMatchObject({ email: 'ion@exemplu.ro', name: 'Ion Popescu', role: 'owner', active: true });
    expect(await countUsers(db)).toBe(1);
  });
  it('fără nume, ia partea dinaintea lui @', async () => {
    expect((await createUser(db, { email: 'receptie@vila.ro', password: 'parola-buna' })).name).toBe('receptie');
  });
  it('rolul implicit e recepție, iar orice altceva tot acolo cade', async () => {
    expect((await desk()).role).toBe('reception');
    expect((await createUser(db, { email: 'x@y.ro', password: 'parola-buna', role: 'sef-mare' })).role).toBe('reception');
  });
  it('nu lasă două conturi cu același email', async () => {
    await owner();
    expect(await status(createUser(db, { email: 'ion@exemplu.ro', password: 'alta-parola' }))).toBe(409);
  });
  it('parola nu iese niciodată din bază', async () => {
    await owner();
    expect(JSON.stringify(await listUsers(db))).not.toMatch(/parola|password|scrypt/i);
  });
});

describe('intrarea în cont', () => {
  it('intră cu emailul scris oricum, cu majuscule sau cu spații', async () => {
    await owner();
    const { user, token } = await login(db, { email: '  ION@exemplu.ro ', password: 'parola-buna' });
    expect(user.name).toBe('Ion Popescu');
    expect(token.length).toBeGreaterThan(20);
  });
  it('parola greșită și contul inexistent dau același 401', async () => {
    await owner();
    expect(await status(login(db, { email: 'ion@exemplu.ro', password: 'gresit' }))).toBe(401);
    expect(await status(login(db, { email: 'nimeni@exemplu.ro', password: 'parola-buna' }))).toBe(401);
    await expect(login(db, { email: 'ion@exemplu.ro', password: '' })).rejects.toThrow(/Email sau parolă/);
  });
  it('un cont oprit nu mai intră', async () => {
    const u = await desk();
    await updateUser(db, u.id, { active: false });
    expect(await status(login(db, { email: 'ana@exemplu.ro', password: 'parola-buna' }))).toBe(403);
  });
});

describe('sesiuni', () => {
  it('jetonul aduce contul, iar după ieșire nu mai aduce nimic', async () => {
    const u = await owner();
    const { token } = await login(db, { email: 'ion@exemplu.ro', password: 'parola-buna' });
    expect((await userForToken(db, token))?.id).toBe(u.id);
    await endSession(db, token);
    expect(await userForToken(db, token)).toBeNull();
  });
  it('un jeton inventat sau lipsă nu deschide nimic', async () => {
    await owner();
    expect(await userForToken(db, undefined)).toBeNull();
    expect(await userForToken(db, 'jeton-inventat')).toBeNull();
  });
  it('în tabel stă amprenta, nu jetonul din cookie', async () => {
    const u = await owner();
    const token = await startSession(db, u.id);
    const [row] = await db.query<{ id: string }>('SELECT id FROM sessions');
    expect(row.id).not.toBe(token);
    expect(row.id).toMatch(/^[0-9a-f]{64}$/);
  });
  it('o sesiune expirată nu mai merge', async () => {
    const u = await owner();
    const token = await startSession(db, u.id);
    await db.query('UPDATE sessions SET expires_at = DATE_SUB(now(), INTERVAL 1 DAY)');
    expect(await userForToken(db, token)).toBeNull();
  });
  it('parola nouă te scoate de pe toate dispozitivele', async () => {
    const u = await owner();
    const [t1, t2] = [await startSession(db, u.id), await startSession(db, u.id)];
    await updateUser(db, u.id, { password: 'parola-noua' });
    expect(await userForToken(db, t1)).toBeNull();
    expect(await userForToken(db, t2)).toBeNull();
    expect((await login(db, { email: 'ion@exemplu.ro', password: 'parola-noua' })).user.id).toBe(u.id);
  });
  it('oprirea contului taie sesiunile deschise', async () => {
    const u = await desk();
    const token = await startSession(db, u.id);
    await updateUser(db, u.id, { active: false });
    expect(await userForToken(db, token)).toBeNull();
  });
  it('ștergerea contului îi șterge și sesiunile', async () => {
    const me = await owner(), u = await desk();
    const token = await startSession(db, u.id);
    await deleteUser(db, u.id, me.id);
    expect(await userForToken(db, token)).toBeNull();
  });
});

describe('ultimul proprietar', () => {
  it('nu poate fi trecut la recepție, oprit sau șters', async () => {
    const u = await owner();
    await desk();                                        // recepția nu ajută: tot un singur proprietar
    expect(await status(updateUser(db, u.id, { role: 'reception' }))).toBe(400);
    expect(await status(updateUser(db, u.id, { active: false }))).toBe(400);
    expect(await status(deleteUser(db, u.id, 'altcineva'))).toBe(400);
  });
  it('dar poate, dacă mai există unul', async () => {
    const a = await owner(), b = await desk({ role: 'owner' });
    expect((await updateUser(db, a.id, { role: 'reception' })).role).toBe('reception');
    expect(await status(updateUser(db, b.id, { role: 'reception' }))).toBe(400);
  });
  it('nimeni nu își șterge propriul cont', async () => {
    const a = await owner(); await desk({ role: 'owner' });
    expect(await status(deleteUser(db, a.id, a.id))).toBe(400);
  });
});
