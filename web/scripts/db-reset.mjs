// Șterge baza de date cu totul. La următoarea pornire aplicația o creează din nou, cu datele demo.
// MySQL trebuie să fie pornit (XAMPP).
import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL || 'mysql://root@localhost:3306/velora';
const u = new URL(url.replace(/^mariadb:/, 'mysql:'));
const name = decodeURIComponent(u.pathname.slice(1)) || 'velora';

let c;
try {
  c = await mysql.createConnection({
    host: u.hostname || 'localhost', port: Number(u.port || 3306),
    user: decodeURIComponent(u.username) || 'root', password: decodeURIComponent(u.password),
  });
} catch (e) {
  console.error(e.code === 'ECONNREFUSED'
    ? 'Nu mă pot conecta la MySQL. Pornește MySQL din XAMPP Control Panel.'
    : 'Eroare: ' + e.message);
  process.exit(1);
}
await c.query(`DROP DATABASE IF EXISTS \`${name.replace(/`/g, '')}\``);
await c.end();
console.log(`Baza de date "${name}" a fost ștearsă. Pornește din nou cu: npm run dev`);
