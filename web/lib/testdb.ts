// Doar pentru teste. MySQL nu are baze de date în memorie, deci fiecare test care are nevoie de date
// curate primește o bază proprie (velora_test_<proces>_<număr>), care se șterge când o închide.
import mysql from 'mysql2/promise';
import type { AppState } from '@/domain/types';
import { createDb, parseUrl, type Db } from './db';
import { insertState } from './seed';

const BASE = process.env.TEST_DATABASE_URL || 'mysql://root@localhost:3306/velora_test';
let n = 0;

export async function freshDb(): Promise<Db> {
  const u = new URL(BASE.replace(/^mariadb:/, 'mysql:'));
  const name = `${u.pathname.slice(1) || 'velora_test'}_${process.pid}_${++n}`.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 64);
  u.pathname = '/' + name;
  const { database: _drop, ...server } = parseUrl(u.toString());

  const boot = await mysql.createConnection(server).catch(() => {
    throw new Error('Testele au nevoie de MySQL pornit. Pornește MySQL din XAMPP Control Panel.');
  });
  await boot.query(`DROP DATABASE IF EXISTS \`${name}\``);
  await boot.end();

  const db = await createDb(u.toString());
  const endPool = db.close;
  return {
    ...db,
    close: async () => {
      await endPool();
      const c = await mysql.createConnection(server);
      await c.query(`DROP DATABASE IF EXISTS \`${name}\``);
      await c.end();
    },
  };
}

// în ordinea în care cheile străine permit ștergerea: stornările înaintea facturilor pe care le
// anulează, unitățile înaintea camerelor din care fac parte
const CLEAR = ['DELETE FROM audit_log', 'DELETE FROM invoice_lines', 'DELETE FROM invoices WHERE storno_of IS NOT NULL', 'DELETE FROM invoices',
  'DELETE FROM invoice_series', 'DELETE FROM settings',
  'DELETE FROM payments', 'DELETE FROM room_nights', 'DELETE FROM reservation_rooms', 'DELETE FROM reservations',
  'DELETE FROM rates', 'DELETE FROM expenses', 'DELETE FROM guests', 'DELETE FROM rooms WHERE parent_id IS NOT NULL',
  'DELETE FROM rooms', 'DELETE FROM floors', 'DELETE FROM properties'];

/**
 * Golește baza și pune la loc starea dată, totul pe aceeași conexiune. E mult mai rapid decât o bază
 * nouă, deci se poate face înainte de fiecare test: fiecare pleacă de la aceleași date.
 */
export async function resetTo(db: Db, s: AppState) {
  await db.tx(async q => {
    for (const sql of CLEAR) await q(sql);
    await insertState(q, s);
  });
}
