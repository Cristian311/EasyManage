// Tăierea unui fișier .sql în instrucțiuni. Dacă asta greșește, migrarea rupe o procedură în mijloc
// și eroarea apare abia la pornire, cu un mesaj fără legătură.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { splitSql } from './migrate';

describe('splitSql', () => {
  it('taie la punct și virgulă și acceptă ultima instrucțiune fără el', () => {
    expect(splitSql('SELECT 1; SELECT 2;')).toEqual(['SELECT 1', 'SELECT 2']);
    expect(splitSql('SELECT 1; SELECT 2')).toEqual(['SELECT 1', 'SELECT 2']);
  });
  it('nu lasă instrucțiuni goale', () => {
    expect(splitSql('  ;;\n ; SELECT 1;;')).toEqual(['SELECT 1']);
    expect(splitSql('   \n\n  ')).toEqual([]);
  });

  it('nu taie înăuntrul unui text', () => {
    expect(splitSql("INSERT INTO t (a) VALUES ('x; y')")).toEqual(["INSERT INTO t (a) VALUES ('x; y')"]);
    expect(splitSql("SELECT 'a''b; c' AS x")).toHaveLength(1);        // apostrof dublat
    expect(splitSql("SELECT 'a\\';b' AS x")).toHaveLength(1);         // apostrof scăpat cu backslash
    expect(splitSql('SELECT "a; b" AS x')).toHaveLength(1);
  });
  it('nu taie înăuntrul unui nume între accente grave', () => {
    expect(splitSql('SELECT `a;b` FROM t')).toEqual(['SELECT `a;b` FROM t']);
  });

  it('sare peste comentarii, cu tot cu punctele și virgulele din ele', () => {
    expect(splitSql('SELECT 1; -- gata; chiar\nSELECT 2')).toEqual(['SELECT 1', 'SELECT 2']);
    expect(splitSql('SELECT 1; # gata; chiar\nSELECT 2')).toEqual(['SELECT 1', 'SELECT 2']);
    const block = splitSql('SELECT /* a; b */ 1');
    expect(block).toHaveLength(1);
    expect(block[0]).not.toContain(';');
  });
  it('„--" fără spațiu după nu e comentariu, ci scădere', () => {
    expect(splitSql('SELECT 1--2')).toEqual(['SELECT 1--2']);
  });

  it('ține cont de DELIMITER, ca procedurile să rămână întregi', () => {
    const sql = [
      'DELIMITER //',
      'CREATE PROCEDURE p() BEGIN SELECT 1; SELECT 2; END //',
      'DELIMITER ;',
      'SELECT 3;',
    ].join('\n');
    const out = splitSql(sql);
    expect(out).toHaveLength(2);
    expect(out[0]).toContain('SELECT 1; SELECT 2');
    expect(out[1]).toBe('SELECT 3');
  });
});

describe('migrarea de bază, 001_init.sql', () => {
  const sql = fs.readFileSync(fileURLToPath(new URL('../db/migrations/001_init.sql', import.meta.url)), 'utf8');
  const parts = splitSql(sql);

  it('se taie în instrucțiuni întregi, niciuna goală și niciuna cu DELIMITER în ea', () => {
    expect(parts.length).toBeGreaterThan(10);
    for (const p of parts) {
      expect(p.trim()).not.toBe('');
      expect(p).not.toMatch(/^\s*DELIMITER\b/i);
    }
  });
  // numărate doar la început de rând, ca să nu intre în socoteală și mențiunile din comentarii
  const declared = (re: RegExp) => sql.match(re)?.length ?? 0;

  it('scoate fiecare tabel ca instrucțiune separată', () => {
    const n = declared(/^CREATE TABLE/gm);
    expect(n).toBeGreaterThan(0);
    expect(parts.filter(p => p.startsWith('CREATE TABLE'))).toHaveLength(n);
  });
  it('ține procedurile și triggerele întregi, cu tot cu BEGIN ... END', () => {
    const procs = parts.filter(p => p.startsWith('CREATE PROCEDURE'));
    const trigs = parts.filter(p => p.startsWith('CREATE TRIGGER'));
    expect(procs).toHaveLength(declared(/^CREATE PROCEDURE/gm));
    expect(trigs).toHaveLength(declared(/^CREATE TRIGGER/gm));
    expect(procs.length + trigs.length).toBeGreaterThan(0);
    for (const p of [...procs, ...trigs]) expect(p).toMatch(/\bEND\s*$/);
  });
  it('poate fi rulat de două ori: fiecare creare e apărată', () => {
    for (const p of parts) {
      if (p.startsWith('CREATE TABLE')) expect(p).toMatch(/^CREATE TABLE IF NOT EXISTS/);
      if (p.startsWith('CREATE PROCEDURE')) expect(parts.some(x => x.startsWith('DROP PROCEDURE IF EXISTS'))).toBe(true);
      if (p.startsWith('CREATE TRIGGER')) expect(parts.some(x => x.startsWith('DROP TRIGGER IF EXISTS'))).toBe(true);
    }
  });
});
