// Applies db/migrations/*.sql in name order, each one exactly once.
// To change the schema: add a new file (002_..., 003_...), never edit one that already ran.
// MySQL commits every CREATE TABLE on the spot, so a migration cannot be rolled back; write the
// statements so that running the file twice is harmless (IF NOT EXISTS / DROP ... IF EXISTS).
import fs from 'node:fs';
import path from 'node:path';
import type { Db } from './db';

/**
 * Cuts a .sql file into statements the way the mysql client does: on ';', except inside strings,
 * comments and backticks, and honouring DELIMITER lines (needed for procedures and triggers).
 * The same files can therefore be imported in phpMyAdmin as they are.
 */
export function splitSql(sql: string): string[] {
  const out: string[] = [];
  let buf = '', delim = ';', i = 0;
  while (i < sql.length) {
    const c = sql[i];
    // comments
    if ((c === '-' && sql[i + 1] === '-' && /[\s]/.test(sql[i + 2] ?? '\n')) || c === '#') {
      const nl = sql.indexOf('\n', i); i = nl < 0 ? sql.length : nl + 1; buf += '\n'; continue;
    }
    if (c === '/' && sql[i + 1] === '*') { const e = sql.indexOf('*/', i + 2); i = e < 0 ? sql.length : e + 2; continue; }
    // strings and quoted names
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === '\\' && c !== '`') { j += 2; continue; }
        if (sql[j] === c) { if (sql[j + 1] === c) { j += 2; continue; } break; }
        j++;
      }
      buf += sql.slice(i, j + 1); i = j + 1; continue;
    }
    // DELIMITER xx, only at the start of a line
    if ((i === 0 || sql[i - 1] === '\n') && /^delimiter[ \t]+(\S+)[ \t]*\r?(\n|$)/i.test(sql.slice(i))) {
      const m = /^delimiter[ \t]+(\S+)[ \t]*\r?(\n|$)/i.exec(sql.slice(i))!;
      delim = m[1]; i += m[0].length; continue;
    }
    if (sql.startsWith(delim, i)) { if (buf.trim()) out.push(buf.trim()); buf = ''; i += delim.length; continue; }
    buf += c; i++;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

export async function migrate(db: Db, dir = path.join(process.cwd(), 'db', 'migrations')) {
  await db.exec('CREATE TABLE IF NOT EXISTS _migrations (name VARCHAR(190) NOT NULL PRIMARY KEY, applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)) ENGINE=InnoDB');
  const done = new Set((await db.query<{ name: string }>('SELECT name FROM _migrations')).map(r => r.name));
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue;
    const statements = splitSql(fs.readFileSync(path.join(dir, file), 'utf8'));
    for (const [k, s] of statements.entries()) {
      try { await db.exec(s); }
      catch (e) { throw new Error(`Migrarea ${file} a eșuat la instrucțiunea ${k + 1}: ${(e as Error).message}`); }
    }
    await db.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
  }
}
