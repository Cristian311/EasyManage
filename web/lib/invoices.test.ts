// Facturi: numerotarea fără goluri, socoteala, stornarea și legătura cu rezervarea.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { tinyState } from '@/domain/fixtures';
import { invoiceNo } from '@/domain/invoice';
import { type Db } from './db';
import { freshDb, resetTo } from './testdb';
import { DomainError } from './errors';
import { createInvoice, draftFor, listInvoices, readInvoice, stornoInvoice } from './invoices';
import { getCompany, saveCompany } from './settings';

let db: Db;
let resId: string;

beforeAll(async () => { db = await freshDb(); }, 120_000);
afterAll(() => db.close());
beforeEach(async () => {
  await resetTo(db, tinyState());
  resId = (await db.query<{ id: string }>('SELECT id FROM reservations ORDER BY id LIMIT 1'))[0].id;
  await saveCompany(db, { name: 'Vila Duduleanu SRL', taxId: 'RO12345678', address: 'Str. Principală 1, Vâlcea', series: 'VD' });
});

const status = async (p: Promise<unknown>) => { try { await p; return 200; } catch (e) { return e instanceof DomainError ? e.status : 500; } };
const issue = (over: Record<string, unknown> = {}) => createInvoice(db, {
  reservationId: resId, buyerName: 'Ion Client', lines: [{ description: 'Cazare', qty: 2, unit: 'nopți', unitPrice: 250 }], ...over,
});

describe('datele pensiunii', () => {
  it('se salvează și se citesc, cu IBAN-ul curățat de spații', async () => {
    const c = await saveCompany(db, { iban: 'ro49 aaaa 1B31 0075 9384 0000', dueDays: 7, series: 'v d!2' });
    expect(c.iban).toBe('RO49AAAA1B31007593840000');
    expect(c.dueDays).toBe(7);
    expect(c.series).toBe('VD2');                       // numai litere, cifre și liniuțe
    expect((await getCompany(db)).name).toBe('Vila Duduleanu SRL');   // ce nu a fost trimis rămâne
  });
  it('fără nume, CUI și adresă nu se poate emite nimic', async () => {
    await db.query('DELETE FROM settings');
    await expect(issue()).rejects.toThrow(/Completează întâi datele pensiunii.*numele.*CUI.*adresa/s);
  });
});

describe('emiterea', () => {
  it('dă numere la rând, fără goluri, și le scrie și pe rezervare', async () => {
    const a = await issue(), b = await issue(), c = await issue();
    expect([a.number, b.number, c.number]).toEqual([1, 2, 3]);
    expect(a.series).toBe('VD');
    const [r] = await db.query<{ invoice_no: string; invoice_date: string }>('SELECT invoice_no, invoice_date FROM reservations WHERE id = $1', [resId]);
    expect(r.invoice_no).toBe(invoiceNo('VD', 3));
    expect(r.invoice_date).toBe(c.issuedOn);
  });
  it('o emitere care eșuează nu consumă un număr', async () => {
    await issue();
    expect(await status(issue({ buyerName: '  ' }))).toBe(400);
    expect(await status(issue({ lines: [] }))).toBe(400);
    expect((await issue()).number).toBe(2);
  });
  it('fiecare serie are contorul ei', async () => {
    expect((await issue()).number).toBe(1);
    expect((await issue({ series: 'ALTA' })).number).toBe(1);
    expect((await issue()).number).toBe(2);
  });
  it('copiază datele pensiunii în factură, ca să nu se schimbe mai târziu', async () => {
    const inv = await issue();
    await saveCompany(db, { name: 'Alt nume SRL', address: 'Altă stradă' });
    const again = await readInvoice(db, inv.id);
    expect(again.seller.name).toBe('Vila Duduleanu SRL');
    expect(again.seller.address).toBe('Str. Principală 1, Vâlcea');
  });
  it('refuză linii fără descriere, cu cantitate zero sau cu preț negativ', async () => {
    expect(await status(issue({ lines: [{ description: ' ', qty: 1, unitPrice: 10 }] }))).toBe(400);
    expect(await status(issue({ lines: [{ description: 'X', qty: 0, unitPrice: 10 }] }))).toBe(400);
    expect(await status(issue({ lines: [{ description: 'X', qty: 1, unitPrice: -5 }] }))).toBe(400);
  });
  it('scadența nu poate fi înaintea facturii', async () => {
    expect(await status(issue({ issuedOn: '2026-08-10', dueOn: '2026-08-01' }))).toBe(400);
    expect((await issue({ issuedOn: '2026-08-10', dueOn: '2026-08-20' })).dueOn).toBe('2026-08-20');
  });
});

describe('socoteala', () => {
  it('fără TVA, totalul e suma liniilor', async () => {
    const inv = await issue({ lines: [{ description: 'Cazare', qty: 3, unitPrice: 220 }, { description: 'Mic dejun', qty: 6, unitPrice: 25 }] });
    expect(inv.total).toBe(810);
    expect(inv.vat).toBe(0);
    expect(inv.net).toBe(810);
  });
  it('cu TVA, prețul scris e cel cu TVA inclus, iar TVA-ul se scoate din el', async () => {
    await saveCompany(db, { vatPayer: true, vatRate: 11 });
    const inv = await issue({ lines: [{ description: 'Cazare', qty: 1, unitPrice: 111 }] });
    expect(inv.total).toBe(111);
    expect(inv.net).toBe(100);
    expect(inv.vat).toBe(11);
  });
  it('dacă nu ești plătitor de TVA, o cotă trimisă din greșeală e ignorată', async () => {
    const inv = await issue({ vatRate: 21, lines: [{ description: 'Cazare', qty: 1, unitPrice: 100 }] });
    expect(inv.vatRate).toBe(0);
    expect(inv.vat).toBe(0);
  });
});

describe('propunerea pentru o ședere', () => {
  it('ia oaspetele, camerele, nopțile și totalul rezervării', async () => {
    const d = await draftFor(db, resId);
    const [r] = await db.query<{ total: number; pax: number }>('SELECT total, pax FROM reservations WHERE id = $1', [resId]);
    expect(d.buyerName.length).toBeGreaterThan(2);
    expect(d.lines).toHaveLength(1);
    expect(d.lines[0].description).toMatch(/^Cazare .+ (noapte|nopți) \(/);
    expect(d.lines[0].qty * d.lines[0].unitPrice).toBeCloseTo(Number(r.total), 2);
    expect(d.series).toBe('VD');
    expect(d.missing).toEqual([]);
  });
  it('a doua oară, datele clientului vin de pe factura dinainte', async () => {
    await issue({ buyerName: 'Firma Mea SRL', buyerTaxId: 'RO999', buyerAddress: 'Str. Lungă 3' });
    const d = await draftFor(db, resId);
    expect(d).toMatchObject({ buyerName: 'Firma Mea SRL', buyerTaxId: 'RO999', buyerAddress: 'Str. Lungă 3' });
  });
  it('spune ce lipsește din datele pensiunii', async () => {
    await db.query('DELETE FROM settings');
    expect((await draftFor(db, resId)).missing).toEqual(['numele pensiunii sau al firmei', 'CUI-ul', 'adresa']);
  });
  it('404 dacă rezervarea nu mai există', async () => {
    expect(await status(draftFor(db, 'nu_exista'))).toBe(404);
  });
});

describe('stornarea', () => {
  it('face o factură nouă, cu aceleași linii în minus', async () => {
    const inv = await issue({ lines: [{ description: 'Cazare', qty: 2, unitPrice: 250 }] });
    const st = await stornoInvoice(db, inv.id);
    expect(st.kind).toBe('storno');
    expect(st.stornoOf).toBe(inv.id);
    expect(st.number).toBe(inv.number + 1);
    expect(st.total).toBe(-500);
    expect(st.lines[0].qty).toBe(-2);
    expect(st.note).toMatch(new RegExp(`Stornare a facturii ${invoiceNo(inv.series, inv.number)}`));
  });
  it('factura stornată rămâne în registru, iar rezervarea rămâne fără număr', async () => {
    const inv = await issue();
    await stornoInvoice(db, inv.id);
    expect((await listInvoices(db)).map(i => i.id)).toContain(inv.id);
    const [r] = await db.query<{ invoice_no: string; invoice_date: string | null }>('SELECT invoice_no, invoice_date FROM reservations WHERE id = $1', [resId]);
    expect(r.invoice_no).toBe('');
    expect(r.invoice_date).toBeNull();
    expect((await issue()).number).toBe(3);      // se poate emite alta, corectă
  });
  it('nu se stornează de două ori și nici o stornare', async () => {
    const inv = await issue();
    const st = await stornoInvoice(db, inv.id);
    expect(await status(stornoInvoice(db, inv.id))).toBe(400);
    expect(await status(stornoInvoice(db, st.id))).toBe(400);
    expect(await status(stornoInvoice(db, 'nu_exista'))).toBe(404);
  });
});

describe('registrul', () => {
  it('întoarce facturile cu liniile lor, cele mai noi întâi', async () => {
    await issue({ issuedOn: '2026-08-01' });
    await issue({ issuedOn: '2026-09-01' });
    const list = await listInvoices(db);
    expect(list.map(i => i.issuedOn)).toEqual(['2026-09-01', '2026-08-01']);
    expect((await readInvoice(db, list[0].id)).lines).toHaveLength(1);
    expect(await status(readInvoice(db, 'nu_exista'))).toBe(404);
  });
  it('ștergerea rezervării nu șterge factura', async () => {
    const inv = await issue();
    await db.query('DELETE FROM reservations WHERE id = $1', [resId]);
    expect((await readInvoice(db, inv.id)).reservationId).toBeNull();
  });
});
