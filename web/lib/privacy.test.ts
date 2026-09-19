// Jurnalul și datele personale, pe un MySQL adevărat.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { tinyState } from '@/domain/fixtures';
import { addDays, todayIso } from '@/domain/dates';
import { type Db } from './db';
import { freshDb, resetTo } from './testdb';
import { DomainError } from './errors';
import { audit, changed, listAudit, resLabel } from './audit';
import { anonymizeGuest, exportGuest } from './privacy';
import { createInvoice } from './invoices';
import { createReservation, loadState, updateGuest } from './repo';
import { saveCompany } from './settings';

let db: Db;
beforeAll(async () => { db = await freshDb(); }, 120_000);
afterAll(() => db.close());
beforeEach(() => resetTo(db, tinyState()));
const status = async (p: Promise<unknown>) => { try { await p; return 200; } catch (e) { return e instanceof DomainError ? e.status : 500; } };
const me = { id: 'u1', name: 'Ion Popescu' };

describe('jurnalul', () => {
  it('ține minte cine, ce și despre ce, cele mai noi întâi', async () => {
    await audit(db, me, 'reservation.create', 'reservation', 'r1', 'Ana Pop, 101');
    await audit(db, null, 'backup.create', 'backup', '', 'velora-x.sql.gz');
    const rows = await listAudit(db);
    expect(rows.map(r => [r.userName, r.action, r.summary])).toEqual([['', 'backup.create', 'velora-x.sql.gz'], ['Ion Popescu', 'reservation.create', 'Ana Pop, 101']]);
    expect(rows[0].at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
  });
  it('caută în rezumat și în numele omului, fără ca % să însemne „orice”', async () => {
    await audit(db, me, 'reservation.create', 'reservation', 'r1', 'Ana Pop, 101');
    await audit(db, { id: 'u2', name: 'Maria' }, 'payment.add', 'reservation', 'r2', '100% avans');
    expect((await listAudit(db, 'ana pop')).length).toBe(1);
    expect((await listAudit(db, 'maria')).length).toBe(1);
    expect((await listAudit(db, '%')).map(r => r.summary)).toEqual(['100% avans']);
  });
  it('o eroare la scrierea jurnalului nu strică operația', async () => {
    await expect(audit(db, me, 'x'.repeat(100), 'e')).resolves.toBeUndefined();     // acțiune prea lungă pentru coloană
  });
  it('rezumatul unei rezervări se înțelege și fără program', async () => {
    const s = await loadState(db), r = s.reservations[0];
    expect(await resLabel(db, r.id)).toMatch(/^.+, .+, \d+ \w+ – \d+ \w+, [\d.]+ lei$/);
    expect(await resLabel(db, 'nu_exista')).toBe('nu_exista');
  });
  it('spune ce câmpuri s-au schimbat, pe românește, fără valori', () => {
    expect(changed({ password: 'secret-mare', role: 'owner', altceva: 1 }, { password: 'parola', role: 'rolul' })).toBe('parola, rolul');
    expect(changed(null, { a: 'b' })).toBe('');
  });
});

describe('datele personale', () => {
  const past = async () => (await createReservation(db, { guestName: 'Dorel Plecat', guestPhone: '0722 000 111', roomIds: ['r4'], checkIn: '2020-01-10', checkOut: '2020-01-12', pax: 2, total: 400, advance: 100, notes: 'alergic la nuci' }));

  it('exportul aduce omul, șederile, plățile și facturile lui', async () => {
    const { reservation, guest } = await past();
    await updateGuest(db, guest!.id, { idSeries: 'VX', idNumber: '123456', address: 'Str. Lungă 3' });
    await saveCompany(db, { name: 'Vila SRL', taxId: 'RO1', address: 'Str. 1' });
    await createInvoice(db, { reservationId: reservation.id, buyerName: 'Dorel Plecat', lines: [{ description: 'Cazare', qty: 2, unitPrice: 200 }] });
    const x = await exportGuest(db, guest!.id) as unknown as { oaspete: Record<string, unknown>; sederi: Record<string, unknown>[]; plati: Record<string, unknown>[]; facturi: Record<string, unknown>[] };
    expect(x.oaspete).toMatchObject({ prenume: 'Dorel', nume: 'Plecat', seria: 'VX', numarul: '123456', domiciliul: 'Str. Lungă 3' });
    expect(x.sederi).toHaveLength(1); expect(x.sederi[0]).toMatchObject({ sosire: '2020-01-10', camere: 'P1', total: 400 });
    expect(x.plati.map(p => p.suma)).toEqual([100]);
    expect(x.facturi.map(f => f.total)).toEqual([400]);
    expect(await status(exportGuest(db, 'nu_exista'))).toBe(404);
  });

  it('ștergerea scoate numele, contactul, actul și observațiile, dar lasă șederea și banii', async () => {
    const { reservation, guest } = await past();
    await updateGuest(db, guest!.id, { idNumber: '123456', birthDate: '1980-02-03', email: 'dorel@exemplu.ro' });
    await audit(db, me, 'reservation.create', 'reservation', reservation.id, 'Dorel Plecat, P1, 10 ian – 12 ian, 400 lei');
    const out = await anonymizeGuest(db, guest!.id);
    expect(out.guest).toMatchObject({ firstName: 'Oaspete', lastName: 'șters', phone: '', email: '', idNumber: '', birthDate: null });
    const s = await loadState(db), r = s.reservations.find(x => x.id === reservation.id)!;
    expect(r).toMatchObject({ total: 400, notes: '', checkIn: '2020-01-10' });
    expect(r.payments.map(p => p.amount)).toEqual([100]);
    expect(JSON.stringify(await listAudit(db))).not.toContain('Dorel');       // nici în jurnal nu mai apare
    expect((await listAudit(db))[0].summary).toContain('Oaspete șters, P1');
  });

  it('facturile emise rămân cu numele clientului, cum cere legea', async () => {
    const { reservation, guest } = await past();
    await saveCompany(db, { name: 'Vila SRL', taxId: 'RO1', address: 'Str. 1' });
    await createInvoice(db, { reservationId: reservation.id, buyerName: 'Dorel Plecat', lines: [{ description: 'Cazare', qty: 2, unitPrice: 200 }] });
    expect((await anonymizeGuest(db, guest!.id)).invoicesKept).toBe(1);
    expect((await db.query<{ buyer_name: string }>('SELECT buyer_name FROM invoices'))[0].buyer_name).toBe('Dorel Plecat');
  });

  it('nu se poate cât timp omul e cazat sau urmează să vină, dar se poate după anulare', async () => {
    const T = todayIso();
    const { reservation, guest } = await createReservation(db, { guestName: 'Vine Curand', roomIds: ['r4'], checkIn: addDays(T, 500), checkOut: addDays(T, 502), pax: 1, total: 100 });
    await expect(anonymizeGuest(db, guest!.id)).rejects.toThrow(/cazat acum sau are o rezervare care urmează/);
    await db.query("UPDATE reservations SET status = 'cancelled' WHERE id = $1", [reservation.id]);
    expect((await anonymizeGuest(db, guest!.id)).guest.firstName).toBe('Oaspete');
    expect(await status(anonymizeGuest(db, 'nu_exista'))).toBe(404);
  });
});
