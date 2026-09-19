// Datele oaspetelui, șablonul confirmării și importul, pe un MySQL adevărat.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { tinyState } from '@/domain/fixtures';
import { DEFAULT_TEMPLATE } from '@/domain/message';
import { type Db } from './db';
import { freshDb, resetTo } from './testdb';
import { DomainError } from './errors';
import { importReservations } from './import';
import { loadState, updateGuest } from './repo';
import { getTemplate, saveCompany, saveTemplate } from './settings';

let db: Db;
beforeAll(async () => { db = await freshDb(); }, 120_000);
afterAll(() => db.close());
beforeEach(() => resetTo(db, tinyState()));
const status = async (p: Promise<unknown>) => { try { await p; return 200; } catch (e) { return e instanceof DomainError ? e.status : 500; } };

describe('datele oaspetelui', () => {
  it('se salvează actul și se citește la loc odată cu starea', async () => {
    const { guest } = await updateGuest(db, 'g1', { idType: 'Carte de identitate', idSeries: 'vx', idNumber: '123456', birthDate: '1985-04-12', citizenship: 'română', address: 'Str. Lungă 3, Sibiu' });
    expect(guest).toMatchObject({ idSeries: 'VX', idNumber: '123456', birthDate: '1985-04-12' });
    const g = (await loadState(db)).guests.find(x => x.id === 'g1')!;
    expect(g).toMatchObject({ firstName: 'Ana', idType: 'Carte de identitate', idSeries: 'VX', citizenship: 'română', address: 'Str. Lungă 3, Sibiu', birthDate: '1985-04-12' });
  });
  it('ce nu e trimis rămâne cum era', async () => {
    await updateGuest(db, 'g1', { idNumber: '111' });
    const { guest } = await updateGuest(db, 'g1', { phone: '0733 000 111' });
    expect(guest).toMatchObject({ idNumber: '111', phone: '0733 000 111', firstName: 'Ana', lastName: 'Pop' });
  });
  it('refuză numele gol, data nașterii din viitor și oaspetele care nu există', async () => {
    expect(await status(updateGuest(db, 'g1', { firstName: '  ' }))).toBe(400);
    expect(await status(updateGuest(db, 'g1', { birthDate: '2999-01-01' }))).toBe(400);
    expect(await status(updateGuest(db, 'g1', { birthDate: 'ieri' }))).toBe(400);
    expect(await status(updateGuest(db, 'nu_exista', { firstName: 'X' }))).toBe(404);
  });
  it('data nașterii se poate și șterge', async () => {
    await updateGuest(db, 'g1', { birthDate: '1985-04-12' });
    expect((await updateGuest(db, 'g1', { birthDate: '' })).guest.birthDate).toBeNull();
  });
});

describe('șablonul confirmării', () => {
  it('până nu scrie nimeni altul, e cel de la început, semnat cu numele firmei', async () => {
    await saveCompany(db, { name: 'Vila Test SRL' });
    expect(await getTemplate(db)).toEqual({ template: DEFAULT_TEMPLATE, sender: 'Vila Test SRL', isDefault: true });
  });
  it('se salvează, iar gol înseamnă înapoi la cel de la început', async () => {
    expect((await saveTemplate(db, '  Salut, {prenume}!  ')).template).toBe('Salut, {prenume}!');
    expect((await getTemplate(db)).isDefault).toBe(false);
    expect((await saveTemplate(db, '')).template).toBe(DEFAULT_TEMPLATE);
  });
});

describe('importul', () => {
  const room = tinyState().rooms.find(r => !r.parentId && r.active)!.name;
  const csv = (...lines: string[]) => ['Oaspete;Telefon;Camera;Sosire;Plecare;Persoane;Total;Avans;Sursa', ...lines].join('\n');

  it('verificarea nu scrie nimic', async () => {
    const before = (await loadState(db)).reservations.length;
    const rep = await importReservations(db, { csv: csv(`Gigel Nou;0722;${room};01.03.2031;04.03.2031;2;750;200;Booking`) });
    expect(rep).toMatchObject({ ok: 1, bad: 0, created: 0, problem: null });
    expect((await loadState(db)).reservations.length).toBe(before);
  });
  it('importul scrie rândurile bune, cu avans, și lasă pe dinafară pe cele greșite', async () => {
    const rep = await importReservations(db, { dryRun: false, csv: csv(
      `Gigel Nou;0722 111 222;${room};01.03.2031;04.03.2031;2;750;200;Booking`,
      `Gigel Nou;;${room};04.03.2031;06.03.2031;2;500;;`,
      `Dan Peste;;${room};05.03.2031;07.03.2031;2;500;;`,
      `Ana Pop;;nu-exista;01.04.2031;02.04.2031;1;100;;`) });
    expect(rep).toMatchObject({ created: 2, ok: 2, bad: 2 });
    expect(rep.rows.map(r => !!r.created)).toEqual([true, true, false, false]);
    const s = await loadState(db);
    const gigel = s.guests.filter(g => g.firstName === 'Gigel');
    expect(gigel).toHaveLength(1);                                   // același om, un singur oaspete nou
    const his = s.reservations.filter(r => r.guestId === gigel[0].id).sort((a, b) => a.checkIn.localeCompare(b.checkIn));
    expect(his.map(r => [r.checkIn, r.total, r.source])).toEqual([['2031-03-01', 750, 'booking'], ['2031-03-04', 500, 'direct']]);
    expect(his[0].payments.map(p => p.amount)).toEqual([200]);
  });
  it('a doua oară, același fișier nu mai intră: camerele sunt deja ocupate', async () => {
    const file = csv(`Gigel Nou;;${room};01.03.2031;04.03.2031;2;750;;`);
    expect((await importReservations(db, { dryRun: false, csv: file })).created).toBe(1);
    expect(await importReservations(db, { dryRun: false, csv: file })).toMatchObject({ created: 0, bad: 1 });
  });
  it('refuză fișierul gol', async () => expect(await status(importReservations(db, { csv: '  ' }))).toBe(400));
});
