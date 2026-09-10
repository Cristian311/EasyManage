// Applies db/migrations/*.sql in name order, each one exactly once, each inside a transaction.
// To change the schema: add a new file (002_..., 003_...), never edit one that already ran.
import fs from 'node:fs';
import path from 'node:path';
import type { Db } from './db';

export async function migrate(db: Db, dir = path.join(process.cwd(), 'db', 'migrations')) {
  await db.exec('CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const done = new Set((await db.query<{ name: string }>('SELECT name FROM _migrations')).map(r => r.name));
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    try {
      await db.exec(`BEGIN;\n${sql}\nINSERT INTO _migrations (name) VALUES ('${file.replace(/'/g, "''")}');\nCOMMIT;`);
    } catch (e) {
      await db.exec('ROLLBACK').catch(() => {});
      throw new Error(`Migrarea ${file} a eșuat: ${(e as Error).message}`);
    }
  }
}
