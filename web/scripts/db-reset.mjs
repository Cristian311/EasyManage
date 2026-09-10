// Deletes the local database (PGlite, folder .data/pglite). At the next start the app creates it again,
// with the demo data. Stop the server (Ctrl+C) before running it.
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), '.data', 'pglite');
if (process.env.DATABASE_URL && /^postgres/.test(process.env.DATABASE_URL)) {
  console.log('DATABASE_URL arată spre un PostgreSQL adevărat; nu șterg nimic. Folosește butonul din Setări sau POST /api/demo/reset.');
  process.exit(1);
}
fs.rmSync(dir, { recursive: true, force: true });
console.log(`Baza de date locală a fost ștearsă (${dir}). Pornește din nou cu: npm run dev`);
