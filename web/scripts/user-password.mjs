// Pune o parolă nouă unui cont, când proprietarul și-a uitat-o și nu mai poate intra să o schimbe din Setări.
// Se rulează de pe calculatorul pe care stă aplicația; MySQL trebuie să fie pornit (XAMPP).
// Exemplu:  npm run user:password -- ion@exemplu.ro parola-noua-lunga
import { randomBytes, scryptSync } from 'node:crypto';
import mysql from 'mysql2/promise';

const [email, password] = process.argv.slice(2);
if (!email || !password) { console.log('Scrie emailul și parola nouă: npm run user:password -- ion@exemplu.ro parola-noua-lunga'); process.exit(1); }
if (password.length < 8) { console.log('Parola trebuie să aibă cel puțin 8 caractere.'); process.exit(1); }

const url = process.env.DATABASE_URL || 'mysql://root@localhost:3306/velora';
const u = new URL(url.replace(/^mariadb:/, 'mysql:'));
let c;
try {
  c = await mysql.createConnection({
    host: u.hostname || 'localhost', port: Number(u.port || 3306),
    user: decodeURIComponent(u.username) || 'root', password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.slice(1)) || 'velora',
  });
} catch (e) {
  console.error(e.code === 'ECONNREFUSED' ? 'Nu mă pot conecta la MySQL. Pornește MySQL din XAMPP Control Panel.' : 'Eroare: ' + e.message);
  process.exit(1);
}

// același format ca în lib/auth.ts: scrypt$sare$amprentă
const salt = randomBytes(16);
const hash = `scrypt$${salt.toString('hex')}$${scryptSync(password.normalize('NFKC'), salt, 64).toString('hex')}`;
const [rows] = await c.query('SELECT id, name FROM users WHERE email = ?', [email.trim().toLowerCase()]);
if (!rows.length) {
  const [all] = await c.query('SELECT email FROM users ORDER BY email');
  console.log(`Nu există niciun cont cu emailul ${email}. Conturi: ${all.map(x => x.email).join(', ') || 'niciunul'}`);
} else {
  await c.query('UPDATE users SET password_hash = ?, active = 1 WHERE id = ?', [hash, rows[0].id]);
  await c.query('DELETE FROM sessions WHERE user_id = ?', [rows[0].id]);   // cine era intrat cu parola veche iese
  console.log(`Parola lui ${rows[0].name} a fost schimbată. Poate intra acum cu cea nouă.`);
}
await c.end();
