// One small interface over MySQL / MariaDB (the server din XAMPP, sau oricare altul).
// Aplicația scrie interogările cu $1, $2, ... ca până acum; aici sunt traduse în ? pentru MySQL,
// pentru că MySQL nu poate refolosi același parametru de două ori într-o interogare.
import mysql from 'mysql2/promise';
import { migrate } from './migrate';

export type Row = Record<string, unknown>;
export type Q = <T = Row>(text: string, params?: unknown[]) => Promise<T[]>;
export interface Db {
  kind: 'mysql';
  query: Q;
  /** one statement, no parameters (migrations) */
  exec(sql: string): Promise<void>;
  /** everything inside fn commits together or not at all */
  tx<T>(fn: (q: Q) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export const DEFAULT_URL = 'mysql://root@localhost:3306/velora';

/** mysql://user:parola@host:port/nume  ->  the pieces mysql2 wants, plus the database name. */
export function parseUrl(url: string) {
  const u = new URL(url.replace(/^mariadb:/, 'mysql:'));
  // fără asta, o adresă greșită ar cădea pe baza implicită și ar scrie în datele adevărate
  if (u.protocol !== 'mysql:') throw new Error(`Adresa bazei de date trebuie să înceapă cu mysql:// (am primit "${url}").`);
  if (!u.pathname.slice(1)) throw new Error(`Adresa bazei de date trebuie să se termine cu numele bazei, de exemplu mysql://root@localhost:3306/velora (am primit "${url}").`);
  return {
    host: u.hostname || 'localhost',
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username) || 'root',
    password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.slice(1)),
  };
}

// Values come back the way the rest of the app expects them: dates as '2026-08-14', money as numbers,
// TINYINT(1) as true/false.
type Field = { type: string; length: number; string(): string | null };
const typeCast = (field: Field, next: () => unknown) => {
  if (field.type === 'TINY' && field.length === 1) { const v = field.string(); return v === null ? null : v !== '0'; }
  if (field.type === 'NEWDECIMAL' || field.type === 'DECIMAL') { const v = field.string(); return v === null ? null : Number(v); }
  if (field.type === 'DATE' || field.type === 'DATETIME' || field.type === 'TIMESTAMP') return field.string();
  return next();
};

/** $1, $2 ... -> ?, in the order they appear, so a query may use $1 twice or out of order. */
export function toMysql(text: string, params: unknown[]): [string, unknown[]] {
  const out: unknown[] = [];
  const sql = text.replace(/\$(\d+)/g, (_, n: string) => { out.push(params[Number(n) - 1]); return '?'; });
  return [sql, out];
}

const friendly = (e: unknown) => {
  const c = (e as { code?: string }).code;
  if (c === 'ECONNREFUSED' || c === 'ETIMEDOUT')
    return new Error('Nu mă pot conecta la MySQL. Pornește MySQL din XAMPP Control Panel (butonul Start din dreptul lui MySQL), apoi încearcă din nou.');
  if (c === 'ER_ACCESS_DENIED_ERROR')
    return new Error('MySQL a refuzat utilizatorul sau parola. Verifică DATABASE_URL din .env.local.');
  return e as Error;
};

const SQL_MODE = 'STRICT_ALL_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

type Runner = { query(sql: string, values?: unknown[]): Promise<[unknown, unknown]> };
const run = (c: Runner): Q => async <T,>(text: string, params: unknown[] = []) => {
  const [sql, values] = toMysql(text, params);
  const [rows] = await c.query(sql, values);
  return (Array.isArray(rows) ? rows : []) as T[];
};

/** Opens the database named by url (see .env.example), creating it if needed, and brings its schema up to date. */
export async function createDb(url = process.env.DATABASE_URL || DEFAULT_URL): Promise<Db> {
  const { database, ...server } = parseUrl(url);
  try {
    const boot = await mysql.createConnection(server);
    await boot.query(`CREATE DATABASE IF NOT EXISTS \`${database.replace(/`/g, '')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await boot.end();
  } catch (e) { throw friendly(e); }

  const pool = mysql.createPool({ ...server, database, connectionLimit: 10, charset: 'utf8mb4', dateStrings: true, decimalNumbers: true, typeCast: typeCast as never });
  // XAMPP comes without strict mode, which would quietly cut text and accept impossible dates.
  // the event hands over the raw connection, whose query() takes a callback; it is queued before any
  // query the caller makes on that same connection
  pool.on('connection', c => { (c as unknown as { query(sql: string, cb: () => void): void }).query(`SET SESSION sql_mode = '${SQL_MODE}'`, () => {}); });

  const db: Db = {
    kind: 'mysql',
    query: run(pool),
    exec: async sql => { await pool.query(sql); },
    tx: async fn => {
      const c = await pool.getConnection();
      try {
        await c.beginTransaction();
        const out = await fn(run(c));
        await c.commit();
        return out;
      } catch (e) { await c.rollback().catch(() => {}); throw e; }
      finally { c.release(); }
    },
    close: () => pool.end(),
  };
  await migrate(db);
  return db;
}

// One database for the whole server process, also across hot reloads in development.
const g = globalThis as unknown as { __veloraDb?: Promise<Db> };
export function getDb(): Promise<Db> {
  if (!g.__veloraDb) {
    g.__veloraDb = (async () => {
      const db = await createDb();
      if (process.env.SEED_DEMO !== 'false') {
        const [{ n }] = await db.query<{ n: number }>('SELECT count(*) AS n FROM properties');
        if (Number(n) === 0) { const { seedDemo } = await import('./seed'); await seedDemo(db); }
      }
      // o copie de siguranță pe zi, cât timp merge serverul
      const { startAutoBackup } = await import('./backup'); startAutoBackup(db);
      return db;
    })().catch(e => { g.__veloraDb = undefined; throw e; });
  }
  return g.__veloraDb;
}
