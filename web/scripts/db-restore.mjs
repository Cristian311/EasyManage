// Pune o copie de siguranță înapoi în baza de date. ÎNLOCUIEȘTE tot ce e acum în ea.
//   npm run db:restore -- backups/velora-2026-09-19_120000.sql.gz --da
// Oprește serverul înainte. MySQL trebuie să fie pornit.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import zlib from 'node:zlib';
import mysql from 'mysql2/promise';

const args = process.argv.slice(2), file = args.find(a => !a.startsWith('--'));
if (!file || !fs.existsSync(file)) { console.log('Spune-mi ce copie: npm run db:restore -- backups/velora-....sql.gz --da'); process.exit(1); }
if (!args.includes('--da')) { console.log('Restaurarea șterge tot ce e acum în baza de date și pune în loc copia.\nDacă ești sigur, adaugă --da la sfârșit.'); process.exit(1); }

const u = new URL((process.env.DATABASE_URL || 'mysql://root@localhost:3306/velora').replace(/^mariadb:/, 'mysql:'));
const c = { host: u.hostname || 'localhost', port: Number(u.port || 3306), user: decodeURIComponent(u.username) || 'root', password: decodeURIComponent(u.password) };
const name = (decodeURIComponent(u.pathname.slice(1)) || 'velora').replace(/`/g, '');
const exe = process.platform === 'win32' ? '.exe' : '';
const tool = [process.env.MYSQL_BIN, 'C:\\xampp\\mysql\\bin', ...(process.env.PATH ?? '').split(path.delimiter)].filter(Boolean)
  .flatMap(d => [path.join(d, 'mysql' + exe), path.join(d, 'mariadb' + exe)]).find(p => fs.existsSync(p));
if (!tool) { console.error('Nu găsesc programul mysql. Pune în .env.local: MYSQL_BIN=C:\\xampp\\mysql\\bin'); process.exit(1); }

let boot;
try { boot = await mysql.createConnection(c); }
catch { console.error('Nu mă pot conecta la MySQL. Pornește MySQL din XAMPP Control Panel.'); process.exit(1); }
await boot.query('DROP DATABASE IF EXISTS `' + name + '`');
await boot.query('CREATE DATABASE `' + name + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
await boot.end();

const child = spawn(tool, ['-h', c.host, '-P', String(c.port), '-u', c.user, '--default-character-set=utf8mb4', name], { env: { ...process.env, MYSQL_PWD: c.password } });
let err = ''; child.stderr.on('data', d => { err += String(d); });
const done = new Promise(res => child.on('close', res));
await pipeline(fs.createReadStream(file), file.endsWith('.gz') ? zlib.createGunzip() : new PassThrough(), child.stdin);
if (await done !== 0) { console.error('Restaurarea nu a reușit:', err.trim()); process.exit(1); }
console.log(`Gata: baza "${name}" e din nou cum era în ${path.basename(file)}. Pornește serverul.`);
