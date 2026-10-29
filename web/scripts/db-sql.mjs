// Runs one SQL statement on the database and prints the rows. MySQL trebuie să fie pornit (XAMPP).
// Exemplu:  npm run db:sql -- "SELECT name, price FROM rooms ORDER BY sort"
import mysql from 'mysql2/promise';

const sql = process.argv.slice(2).join(' ').trim();
if (!sql) { console.log('Scrie interogarea: npm run db:sql -- "SELECT * FROM properties"'); process.exit(1); }

const url = process.env.DATABASE_URL || 'mysql://root@localhost:3306/velora';
const u = new URL(url.replace(/^mariadb:/, 'mysql:'));
let c;
try {
  c = await mysql.createConnection({
    host: u.hostname || 'localhost', port: Number(u.port || 3306),
    user: decodeURIComponent(u.username) || 'root', password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.slice(1)) || 'velora', dateStrings: true, decimalNumbers: true,
  });
} catch (e) {
  console.error(e.code === 'ECONNREFUSED'
    ? 'Nu mă pot conecta la MySQL. Pornește MySQL din XAMPP Control Panel.'
    : 'Eroare: ' + e.message);
  process.exit(1);
}
try {
  const [rows] = await c.query(sql);
  if (Array.isArray(rows) && rows.length) console.table(rows);
  else console.log(`OK, ${Array.isArray(rows) ? 0 : (rows.affectedRows ?? 0)} rânduri afectate.`);
} catch (e) { console.error('Eroare:', e.message); }
await c.end();
