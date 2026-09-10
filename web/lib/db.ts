// One small interface over two drivers:
//  - PGlite: real PostgreSQL compiled to WebAssembly, runs inside the app, keeps its files in .data/pglite.
//    Nothing to install; good for this computer and for tests.
//  - postgres.js: a normal PostgreSQL server (Neon, Supabase, your own), when DATABASE_URL is postgres://...
// The SQL is the same for both.
import fs from 'node:fs';
import path from 'node:path';
import { migrate } from './migrate';

export type Row = Record<string, unknown>;
export type Q = <T = Row>(text: string, params?: unknown[]) => Promise<T[]>;
export interface Db {
  kind: 'pglite' | 'postgres';
  query: Q;
  /** several statements at once, no parameters (migrations) */
  exec(sql: string): Promise<void>;
  /** everything inside fn commits together or not at all */
  tx<T>(fn: (q: Q) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

async function openPglite(dataDir?: string): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  const { btree_gist } = await import('@electric-sql/pglite/contrib/btree_gist');
  if (dataDir) fs.mkdirSync(path.dirname(dataDir), { recursive: true });
  const pg = await PGlite.create(dataDir, { extensions: { btree_gist } });
  const run = (c: { query: typeof pg.query }): Q => async <T,>(text: string, params: unknown[] = []) => (await c.query<T>(text, params as never[])).rows;
  return {
    kind: 'pglite',
    query: run(pg),
    exec: async sql => { await pg.exec(sql); },
    tx: fn => pg.transaction(t => fn(run(t))),
    close: () => pg.close(),
  };
}

async function openPostgres(url: string): Promise<Db> {
  const { default: postgres } = await import('postgres');
  const sql = postgres(url, { max: 10, onnotice: () => {} });
  type Unsafe = { unsafe: (q: string, p?: never[]) => Promise<unknown> };
  const run = (c: Unsafe): Q => async <T,>(text: string, params: unknown[] = []) => (await c.unsafe(text, params as never[])) as T[];
  return {
    kind: 'postgres',
    query: run(sql as unknown as Unsafe),
    exec: async text => { await sql.unsafe(text); },
    tx: fn => sql.begin(t => fn(run(t as unknown as Unsafe))) as Promise<never>,
    close: () => sql.end(),
  };
}

/** Opens the database named by url (see .env.example) and brings its schema up to date. */
export async function createDb(url = process.env.DATABASE_URL): Promise<Db> {
  const db = url && /^postgres(ql)?:\/\//.test(url) ? await openPostgres(url)
    : await openPglite(url === 'memory://' ? undefined : url || path.join(process.cwd(), '.data', 'pglite'));
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
        const [{ n }] = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM properties');
        if (n === 0) { const { seedDemo } = await import('./seed'); await seedDemo(db); }
      }
      return db;
    })().catch(e => { g.__veloraDb = undefined; throw e; });
  }
  return g.__veloraDb;
}
