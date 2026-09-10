// Runs one SQL statement on the local database and prints the rows. Stop the server first (PGlite lets one
// process in at a time).   Example:  npm run db:sql -- "SELECT name, price FROM rooms ORDER BY sort"
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';

const sql = process.argv.slice(2).join(' ').trim();
if (!sql) { console.log('Scrie interogarea: npm run db:sql -- "SELECT * FROM properties"'); process.exit(1); }
if (process.env.DATABASE_URL && /^postgres/.test(process.env.DATABASE_URL)) { console.log('Ai un PostgreSQL adevărat: folosește psql, pgAdmin sau DBeaver cu DATABASE_URL.'); process.exit(1); }
const db = await PGlite.create(path.join(process.cwd(), '.data', 'pglite'), { extensions: { btree_gist } });
try {
  const r = await db.query(sql);
  if (r.rows.length) console.table(r.rows); else console.log(`OK, ${r.affectedRows ?? 0} rânduri afectate.`);
} catch (e) { console.error('Eroare:', e.message); }
await db.close();
