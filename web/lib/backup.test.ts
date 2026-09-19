// Copia de siguranță se verifică până la capăt: o copie care nu a fost niciodată pusă înapoi nu e o copie.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from './db';
import { freshDb } from './testdb';
import { seedDemo } from './seed';
import { backupPath, findTool, listBackups, makeBackup, restoreBackup, setBackupDir, toPrune, type BackupFile } from './backup';
import { createReservation } from './repo';
import { DomainError } from './errors';

const f = (date: string, t = '120000'): BackupFile => ({ name: `velora-${date}_${t}.sql.gz`, date, size: 1, at: '' });

describe('ce copii se șterg', () => {
  it('cele mai vechi de 30 de zile', () => {
    const files = [f('2026-09-19'), f('2026-09-18'), f('2026-09-17'), f('2026-09-01'), f('2026-08-19'), f('2026-08-01')];
    expect(toPrune(files, '2026-09-19')).toEqual(['velora-2026-08-19_120000.sql.gz', 'velora-2026-08-01_120000.sql.gz']);
  });
  it('dar niciodată ultimele trei, oricât de vechi ar fi', () => {
    expect(toPrune([f('2026-01-03'), f('2026-01-02'), f('2026-01-01'), f('2025-12-31')], '2026-09-19')).toEqual(['velora-2025-12-31_120000.sql.gz']);
    expect(toPrune([f('2026-01-01')], '2026-09-19')).toEqual([]);
  });
});

const tools = !!findTool('mysqldump') && !!findTool('mysql');
describe.skipIf(!tools)('copie și restaurare, pe MySQL adevărat', () => {
  let db: Db, url: string, dir: string, back: Db | null = null, backName = '';
  beforeAll(async () => {
    db = await freshDb();
    await seedDemo(db);
    const [{ name }] = await db.query<{ name: string }>('SELECT DATABASE() AS name');
    url = `mysql://root@localhost:3306/${name}`;
    backName = `${name}_r`;
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'velora-bk-'));
  }, 180_000);
  afterAll(async () => {
    if (back) { await back.exec('DROP DATABASE IF EXISTS `' + backName + '`'); await back.close(); }
    await db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('scrie o arhivă cu tabelele, cheia room_is_free, procedurile și triggerele', async () => {
    const b = await makeBackup(db, url, dir);
    expect(b.size).toBeGreaterThan(5000);
    const sql = zlib.gunzipSync(fs.readFileSync(path.join(dir, b.name))).toString('utf8');
    for (const must of ['CREATE TABLE `reservations`', 'room_is_free', 'velora_hold', 'reservations_rehold', 'Vila Duduleanu', '_migrations'])
      expect(sql).toContain(must);
    expect(fs.readdirSync(dir).some(n => n.endsWith('.part'))).toBe(false);
  });

  it('pusă înapoi într-o bază goală, dă aceleași numere, iar rezervările duble sunt tot refuzate', async () => {
    const [b] = listBackups(dir);
    const target = `mysql://root@localhost:3306/${backName}`;
    await restoreBackup(path.join(dir, b.name), target);
    back = await createDb(target);                       // migrările văd că totul e deja aplicat
    const count = async (d: Db) => (await d.query<Record<string, number>>(
      'SELECT (SELECT count(*) FROM reservations) AS r, (SELECT count(*) FROM payments) AS p, (SELECT count(*) FROM room_nights) AS n, (SELECT count(*) FROM rates) AS t, (SELECT count(*) FROM guests) AS g'))[0];
    expect(await count(back)).toEqual(await count(db));

    // triggerele au venit și ele: o rezervare peste alta e refuzată și în baza restaurată
    const [r] = await back.query<{ guest_id: string; room_id: string; check_in: string; check_out: string }>(
      "SELECT r.guest_id, rr.room_id, r.check_in, r.check_out FROM reservations r JOIN reservation_rooms rr ON rr.reservation_id = r.id WHERE r.status <> 'cancelled' LIMIT 1");
    const again = createReservation(back, { guestId: r.guest_id, roomIds: [r.room_id], checkIn: r.check_in, checkOut: r.check_out, pax: 1, total: 10 });
    await expect(again).rejects.toMatchObject({ status: 409 });
    // și plasa de siguranță din baza de date, fără verificarea aplicației
    await expect(back.query('INSERT INTO room_nights (room_id, night, reservation_id) SELECT room_id, night, reservation_id FROM room_nights LIMIT 1'))
      .rejects.toMatchObject({ errno: 1062 });
  }, 180_000);

  it('folderul ales se ține minte, iar unul imposibil e refuzat', async () => {
    expect(await setBackupDir(db, dir)).toBe(dir);
    expect(listBackups(dir).length).toBe(1);
    await expect(setBackupDir(db, 'folder-relativ')).rejects.toBeInstanceOf(DomainError);
  });

  it('nu dă fișiere din afara folderului de copii', async () => {
    await setBackupDir(db, dir);
    await expect(backupPath(db, '..\\..\\windows\\win.ini')).rejects.toMatchObject({ status: 400 });
    await expect(backupPath(db, 'velora-2020-01-01_000000.sql.gz')).rejects.toMatchObject({ status: 404 });
    expect(await backupPath(db, listBackups(dir)[0].name)).toContain(dir);
  });
});
