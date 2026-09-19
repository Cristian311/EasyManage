// Copii de siguranță ale bazei de date, făcute cu mysqldump și ținute arhivate într-un folder.
// Una pe zi se face singură cât timp merge serverul; oricând se poate face una de mână din Setări.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import zlib from 'node:zlib';
import { DEFAULT_URL, parseUrl, type Db } from './db';
import { DomainError } from './errors';

export const KEEP_DAYS = 30;
const NAME = /^velora-(\d{4}-\d{2}-\d{2})_(\d{2})(\d{2})(\d{2})\.sql\.gz$/;

export interface BackupFile { name: string; date: string; size: number; at: string }

/* ---------- unde stau ---------- */

export const defaultDir = () => path.join(process.cwd(), 'backups');

export async function backupDir(db: Db): Promise<string> {
  const [r] = await db.query<{ value: string }>("SELECT `value` FROM settings WHERE name = 'backup_dir'");
  return r?.value?.trim() || process.env.BACKUP_DIR || defaultDir();
}

export async function setBackupDir(db: Db, raw: unknown): Promise<string> {
  const dir = typeof raw === 'string' ? raw.trim().slice(0, 400) : '';
  if (dir) {
    if (!path.isAbsolute(dir)) throw new DomainError(400, 'Scrie calea întreagă a folderului, de exemplu C:\\Users\\Nume\\OneDrive\\Velora.');
    try { fs.mkdirSync(dir, { recursive: true }); fs.accessSync(dir, fs.constants.W_OK); }
    catch { throw new DomainError(400, 'Nu pot scrie în folderul acesta. Verifică dacă există și dacă ai voie să salvezi în el.'); }
  }
  await db.query("INSERT INTO settings (name, `value`) VALUES ('backup_dir', $1) ON DUPLICATE KEY UPDATE `value` = $1, updated_at = now()", [dir]);
  return dir || defaultDir();
}

/* ---------- lista și curățenia ---------- */

export function listBackups(dir: string): BackupFile[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap(name => {
    const m = NAME.exec(name); if (!m) return [];
    return [{ name, date: m[1], at: `${m[1]} ${m[2]}:${m[3]}:${m[4]}`, size: fs.statSync(path.join(dir, name)).size }];
  }).sort((a, b) => b.name.localeCompare(a.name));
}

/**
 * Ce se poate șterge: tot ce e mai vechi de keepDays zile, dar niciodată ultimele trei copii,
 * ca o pauză lungă (calculator închis o lună) să nu lase folderul gol.
 */
export function toPrune(files: BackupFile[], today: string, keepDays = KEEP_DAYS): string[] {
  const limit = new Date(today + 'T00:00:00Z'); limit.setUTCDate(limit.getUTCDate() - keepDays);
  const cut = limit.toISOString().slice(0, 10);
  const sorted = [...files].sort((a, b) => b.name.localeCompare(a.name));
  return sorted.slice(3).filter(f => f.date < cut).map(f => f.name);
}

/* ---------- mysqldump ---------- */

/** mysqldump vine cu MySQL; la XAMPP stă în C:\xampp\mysql\bin. MYSQL_BIN din .env.local arată alt loc. */
export function findTool(tool: 'mysqldump' | 'mysql'): string | null {
  const exe = process.platform === 'win32' ? '.exe' : '';
  const dirs = [process.env.MYSQL_BIN, 'C:\\xampp\\mysql\\bin', 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin', 'C:\\Program Files\\MariaDB 10.4\\bin',
    ...(process.env.PATH ?? '').split(path.delimiter)].filter(Boolean) as string[];
  for (const d of dirs) for (const n of [tool, tool === 'mysqldump' ? 'mariadb-dump' : 'mariadb']) {
    const p = path.join(d, n + exe); if (fs.existsSync(p)) return p;
  }
  return null;
}

const stamp = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

/** Face o copie completă (tabele, date, proceduri, triggere), o arhivează și șterge copiile prea vechi. */
export async function makeBackup(db: Db, url = process.env.DATABASE_URL || DEFAULT_URL, dirOverride?: string): Promise<BackupFile> {
  const tool = findTool('mysqldump');
  if (!tool) throw new DomainError(500, 'Nu găsesc mysqldump. Scrie în .env.local: MYSQL_BIN=C:\\xampp\\mysql\\bin');
  const dir = dirOverride ?? await backupDir(db);
  fs.mkdirSync(dir, { recursive: true });
  const c = parseUrl(url);
  const name = `velora-${stamp()}.sql.gz`, file = path.join(dir, name), tmp = file + '.part';

  const child = spawn(tool, ['-h', c.host, '-P', String(c.port), '-u', c.user, '--single-transaction', '--routines', '--triggers',
    '--default-character-set=utf8mb4', '--skip-comments', c.database], { env: { ...process.env, MYSQL_PWD: c.password }, windowsHide: true });
  let err = ''; child.stderr.on('data', d => { err += String(d); });
  const done = new Promise<number>(res => child.on('close', code => res(code ?? 1)));
  try {
    await pipeline(child.stdout, zlib.createGzip(), fs.createWriteStream(tmp));
    if (await done !== 0) throw new Error(err || 'mysqldump a eșuat');
    if (fs.statSync(tmp).size < 200) throw new Error('copia a ieșit goală');
    fs.renameSync(tmp, file);        // numele final apare abia când copia e întreagă
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    throw new DomainError(500, 'Copia de siguranță nu a reușit: ' + (e as Error).message.trim().slice(0, 300));
  }
  for (const old of toPrune(listBackups(dir), name.slice(7, 17))) fs.rmSync(path.join(dir, old), { force: true });
  return listBackups(dir).find(f => f.name === name)!;
}

/** Calea unei copii, numai dacă numele arată ca o copie de-a noastră (nu se iese din folder). */
export async function backupPath(db: Db, name: string): Promise<string> {
  if (!NAME.test(name)) throw new DomainError(400, 'Nume de copie invalid.');
  const p = path.join(await backupDir(db), name);
  if (!fs.existsSync(p)) throw new DomainError(404, 'Copia nu mai există.');
  return p;
}

/* ---------- copia zilnică ---------- */

const g = globalThis as unknown as { __veloraBackupTimer?: NodeJS.Timeout };

/** Dacă azi nu s-a făcut nicio copie, face una. Verifică la pornire și apoi din oră în oră. */
export function startAutoBackup(db: Db) {
  if (g.__veloraBackupTimer || process.env.AUTO_BACKUP === 'false') return;
  const tick = async () => {
    try {
      const today = stamp().slice(0, 10);
      if (!listBackups(await backupDir(db)).some(f => f.date === today)) await makeBackup(db);
    } catch (e) { console.error('[backup]', (e as Error).message); }
  };
  g.__veloraBackupTimer = setInterval(tick, 60 * 60 * 1000);
  g.__veloraBackupTimer.unref?.();
  setTimeout(tick, 20_000).unref?.();
}

/* ---------- restaurare ---------- */

/**
 * Pune o copie înapoi în baza de date numită de url, înlocuind tot ce e acolo.
 * Folosită de testul de restaurare; de mână se face cu `npm run db:restore`.
 */
export async function restoreBackup(file: string, url: string): Promise<void> {
  const tool = findTool('mysql');
  if (!tool) throw new DomainError(500, 'Nu găsesc programul mysql. Scrie în .env.local: MYSQL_BIN=C:\\xampp\\mysql\\bin');
  const c = parseUrl(url);
  const mysql = (await import('mysql2/promise')).default;
  const boot = await mysql.createConnection({ host: c.host, port: c.port, user: c.user, password: c.password });
  const name = c.database.replace(/`/g, '');
  await boot.query('DROP DATABASE IF EXISTS `' + name + '`');
  await boot.query('CREATE DATABASE `' + name + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  await boot.end();
  const child = spawn(tool, ['-h', c.host, '-P', String(c.port), '-u', c.user, '--default-character-set=utf8mb4', name],
    { env: { ...process.env, MYSQL_PWD: c.password }, windowsHide: true });
  let err = ''; child.stderr.on('data', d => { err += String(d); });
  const done = new Promise<number>(res => child.on('close', code => res(code ?? 1)));
  await pipeline(fs.createReadStream(file), zlib.createGunzip(), child.stdin);
  if (await done !== 0) throw new Error('Restaurarea nu a reușit: ' + err.trim().slice(0, 300));
}
