// Conturi, parole și sesiuni. Nimic din ce e aici nu atinge interfața: rutele din app/api/auth
// și verificarea din lib/http.ts sunt singurii care îl folosesc.
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Me, Role } from '@/domain/types';
import type { Db, Q } from './db';
import { DomainError } from './errors';
import { newId } from './ids';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export type { Role };
export interface User extends Me { active: boolean }

export const COOKIE = 'velora_ses';
export const SESSION_DAYS = 30;
const USER_COLS = 'id, email, name, role, active';

/* ---------- parole ---------- */

/** scrypt$sare$amprentă — sarea e nouă la fiecare parolă, deci două parole la fel arată diferit. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize('NFKC'), salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/** Comparația se face în timp constant, ca durata ei să nu spună nimic despre parolă. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, saltHex, hashHex] = stored.split('$');
  if (kind !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password.normalize('NFKC'), Buffer.from(saltHex, 'hex'), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/* ---------- ce acceptăm la înscriere ---------- */

const cleanEmail = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase().slice(0, 160) : '');
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

export function checkEmail(v: unknown): string {
  const email = cleanEmail(v);
  if (!isEmail(email)) throw new DomainError(400, 'Scrie o adresă de email validă.');
  return email;
}
export function checkPassword(v: unknown): string {
  const pw = typeof v === 'string' ? v : '';
  if (pw.length < 8) throw new DomainError(400, 'Parola trebuie să aibă cel puțin 8 caractere.');
  if (pw.length > 200) throw new DomainError(400, 'Parola e prea lungă.');
  return pw;
}
export const checkRole = (v: unknown): Role => (v === 'owner' ? 'owner' : 'reception');

/* ---------- utilizatori ---------- */

export const countUsers = async (db: Db) =>
  Number((await db.query<{ n: number }>('SELECT count(*) AS n FROM users'))[0].n);

export const listUsers = (db: Db) =>
  db.query<User>(`SELECT ${USER_COLS} FROM users ORDER BY created_at, id`);

export async function createUser(db: Db, raw: unknown, forceRole?: Role): Promise<User> {
  const b = (raw ?? {}) as Record<string, unknown>;
  const email = checkEmail(b.email);
  const password = checkPassword(b.password);
  const name = (typeof b.name === 'string' ? b.name.trim() : '').slice(0, 120) || email.split('@')[0];
  const role = forceRole ?? checkRole(b.role);
  const user: User = { id: newId('u_'), email, name, role, active: true };
  try {
    await db.query('INSERT INTO users (id, email, name, password_hash, role) VALUES ($1,$2,$3,$4,$5)',
      [user.id, email, name, await hashPassword(password), role]);
  } catch (e) {
    if ((e as { errno?: number }).errno === 1062) throw new DomainError(409, 'Există deja un cont cu acest email.');
    throw e;
  }
  return user;
}

/** Numele, rolul, „e activ” și parola. Nu se poate lua ultimul proprietar. */
export async function updateUser(db: Db, id: string, raw: unknown): Promise<User> {
  const b = (raw ?? {}) as Record<string, unknown>;
  return db.tx(async q => {
    const [cur] = await q<User>(`SELECT ${USER_COLS} FROM users WHERE id = $1`, [id]);
    if (!cur) throw new DomainError(404, 'Contul nu există.');
    const name = (typeof b.name === 'string' ? b.name.trim().slice(0, 120) : '') || cur.name;
    const role = b.role === undefined ? cur.role : checkRole(b.role);
    const active = typeof b.active === 'boolean' ? b.active : cur.active;
    if (cur.role === 'owner' && (role !== 'owner' || !active)) await lastOwnerGuard(q, id);
    await q('UPDATE users SET name = $2, role = $3, active = $4 WHERE id = $1', [id, name, role, active]);
    if (b.password !== undefined) await q('UPDATE users SET password_hash = $2 WHERE id = $1', [id, await hashPassword(checkPassword(b.password))]);
    if (b.password !== undefined || !active) await q('DELETE FROM sessions WHERE user_id = $1', [id]);  // parolă nouă = ieși de peste tot
    return { ...cur, name, role, active };
  });
}

export async function deleteUser(db: Db, id: string, me: string) {
  if (id === me) throw new DomainError(400, 'Nu îți poți șterge propriul cont.');
  return db.tx(async q => {
    const [cur] = await q<User>(`SELECT ${USER_COLS} FROM users WHERE id = $1`, [id]);
    if (!cur) throw new DomainError(404, 'Contul nu există.');
    if (cur.role === 'owner') await lastOwnerGuard(q, id);
    await q('DELETE FROM users WHERE id = $1', [id]);
    return { ok: true };
  });
}

async function lastOwnerGuard(q: Q, exceptId: string) {
  const [{ n }] = await q<{ n: number }>("SELECT count(*) AS n FROM users WHERE role = 'owner' AND active = 1 AND id <> $1", [exceptId]);
  if (Number(n) === 0) throw new DomainError(400, 'Trebuie să rămână cel puțin un proprietar.');
}

/* ---------- intrare și sesiuni ---------- */

const fingerprint = (token: string) => createHash('sha256').update(token).digest('hex');

/** Email plus parolă, iar la capăt jetonul care intră în cookie. Mesajul nu spune care din două e greșit. */
export async function login(db: Db, raw: unknown): Promise<{ user: User; token: string }> {
  const b = (raw ?? {}) as Record<string, unknown>;
  const email = cleanEmail(b.email);
  const password = typeof b.password === 'string' ? b.password : '';
  const [row] = await db.query<User & { password_hash: string }>(`SELECT ${USER_COLS}, password_hash FROM users WHERE email = $1`, [email]);
  const wrong = new DomainError(401, 'Email sau parolă greșită.');
  // și când contul nu există calculăm o dată amprenta, ca răspunsul să dureze la fel de mult
  const okPw = await verifyPassword(password, row?.password_hash ?? 'scrypt$00$00');
  if (!row || !okPw) throw wrong;
  if (!row.active) throw new DomainError(403, 'Contul a fost dezactivat. Cere-i proprietarului să îl pornească la loc.');
  const { password_hash: _drop, ...user } = row;
  return { user, token: await startSession(db, user.id) };
}

export async function startSession(db: Db, userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await db.query('INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, DATE_ADD(now(), INTERVAL $3 DAY))',
    [fingerprint(token), userId, SESSION_DAYS]);
  await db.query('DELETE FROM sessions WHERE expires_at < now()').catch(() => {});   // curățenie, nu e critică
  return token;
}

/** Contul din spatele jetonului, sau null dacă nu există, a expirat sau contul e oprit. */
export async function userForToken(db: Db, token: string | undefined): Promise<User | null> {
  if (!token) return null;
  const [u] = await db.query<User>(
    `SELECT ${USER_COLS.split(', ').map(c => 'u.' + c).join(', ')} FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = $1 AND s.expires_at > now()`, [fingerprint(token)]);
  return u && u.active ? u : null;
}

export const endSession = (db: Db, token: string | undefined) =>
  token ? db.query('DELETE FROM sessions WHERE id = $1', [fingerprint(token)]) : Promise.resolve([]);
