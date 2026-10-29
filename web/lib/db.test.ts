// Cele două traduceri care stau între aplicație și MySQL: adresa bazei de date și parametrii $1, $2.
import { describe, expect, it } from 'vitest';
import { DEFAULT_URL, parseUrl, toMysql } from './db';

describe('parseUrl', () => {
  it('desface adresa în bucățile cerute de mysql2', () => {
    expect(parseUrl('mysql://root@localhost:3306/velora')).toEqual({ host: 'localhost', port: 3306, user: 'root', password: '', database: 'velora' });
  });
  it('acceptă și mariadb://', () => {
    expect(parseUrl('mariadb://root@127.0.0.1:3307/velora')).toMatchObject({ host: '127.0.0.1', port: 3307, database: 'velora' });
  });
  it('completează ce lipsește: utilizatorul root și portul 3306', () => {
    expect(parseUrl('mysql://localhost/velora')).toEqual({ host: 'localhost', port: 3306, user: 'root', password: '', database: 'velora' });
  });
  it('refuză o adresă fără nume de bază, ca să nu scrie din greșeală în datele adevărate', () => {
    expect(() => parseUrl('mysql://localhost/')).toThrow(/numele bazei/);
    expect(() => parseUrl('mysql://localhost')).toThrow(/numele bazei/);
  });
  it('refuză o adresă care nu e de MySQL', () => {
    expect(() => parseUrl('postgres://localhost:5432/velora')).toThrow(/mysql:\/\//);
  });
  it('descifrează utilizatorul și parola scrise cu %', () => {
    expect(parseUrl('mysql://ion%40casa:p%40ss%3Aword@db.local:3307/velora_prod'))
      .toEqual({ host: 'db.local', port: 3307, user: 'ion@casa', password: 'p@ss:word', database: 'velora_prod' });
  });
  it('adresa implicită e cea din XAMPP', () => {
    expect(parseUrl(DEFAULT_URL)).toMatchObject({ host: 'localhost', port: 3306, user: 'root' });
  });
});

describe('toMysql', () => {
  it('schimbă $1, $2 în ? și trimite valorile în ordinea lor', () => {
    expect(toMysql('SELECT * FROM t WHERE a = $1 AND b = $2', ['x', 2])).toEqual(['SELECT * FROM t WHERE a = ? AND b = ?', ['x', 2]]);
  });
  it('același parametru poate fi folosit de mai multe ori (MySQL nu poate)', () => {
    expect(toMysql('DELETE FROM rooms WHERE id = $1 OR parent_id = $1', ['r1']))
      .toEqual(['DELETE FROM rooms WHERE id = ? OR parent_id = ?', ['r1', 'r1']]);
  });
  it('parametrii pot veni în altă ordine decât sunt scriși', () => {
    expect(toMysql('SELECT $2, $1', ['a', 'b'])).toEqual(['SELECT ?, ?', ['b', 'a']]);
  });
  it('o listă rămâne listă, pentru IN (?)', () => {
    const [sql, values] = toMysql('SELECT * FROM rooms WHERE id IN ($1)', [['a', 'b']]);
    expect(sql).toBe('SELECT * FROM rooms WHERE id IN (?)');
    expect(values).toEqual([['a', 'b']]);
  });
  it('fără parametri lasă interogarea neatinsă', () => {
    expect(toMysql('SELECT 1', [])).toEqual(['SELECT 1', []]);
  });
});
