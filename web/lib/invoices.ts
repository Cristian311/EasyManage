// Emiterea și citirea facturilor. Regulile de socoteală stau în domain/invoice.ts.
import type { Company, Invoice, InvoiceLine } from '@/domain/invoice';
import { dueDate, fillLine, invoiceNo, missingCompanyFields, round2, stayLine, totals } from '@/domain/invoice';
import { isIsoDate, todayIso } from '@/domain/dates';
import type { Db, Q } from './db';
import { DomainError } from './errors';
import { newId } from './ids';
import { getCompany } from './settings';

const INV_COLS = `id, series, \`number\`, kind, storno_of AS \`stornoOf\`, reservation_id AS \`reservationId\`,
  guest_id AS \`guestId\`, issued_on AS \`issuedOn\`, due_on AS \`dueOn\`, buyer_name AS \`buyerName\`,
  buyer_tax_id AS \`buyerTaxId\`, buyer_address AS \`buyerAddress\`, seller, vat_rate AS \`vatRate\`,
  net, vat, total, note`;
const LINE_COLS = 'invoice_id AS `invoiceId`, description, qty, unit, unit_price AS `unitPrice`, net, vat, total';

type RawInvoice = Omit<Invoice, 'seller' | 'lines'> & { seller: string };
const parse = (r: RawInvoice, lines: InvoiceLine[] = []): Invoice => ({ ...r, seller: JSON.parse(r.seller) as Company, lines });

/* ---------- citire ---------- */

/** Lista, fără linii: atât îi trebuie paginii Facturi. */
export async function listInvoices(db: Db): Promise<Invoice[]> {
  const rows = await db.query<RawInvoice>(`SELECT ${INV_COLS} FROM invoices ORDER BY issued_on DESC, series, \`number\` DESC`);
  return rows.map(r => parse(r));
}

export async function getInvoice(q: Q, id: string): Promise<Invoice | null> {
  const [r] = await q<RawInvoice>(`SELECT ${INV_COLS} FROM invoices WHERE id = $1`, [id]);
  if (!r) return null;
  const lines = await q<InvoiceLine>(`SELECT ${LINE_COLS} FROM invoice_lines WHERE invoice_id = $1 ORDER BY position`, [id]);
  return parse(r, lines);
}

export async function readInvoice(db: Db, id: string): Promise<Invoice> {
  const inv = await getInvoice(db.query, id);
  if (!inv) throw new DomainError(404, 'Factura nu există.');
  return inv;
}

/** Ce s-a emis deja pentru o rezervare, ca sertarul să arate factura în loc să propună încă una. */
export const invoicesForReservation = (db: Db, resId: string) =>
  db.query<RawInvoice>(`SELECT ${INV_COLS} FROM invoices WHERE reservation_id = $1 ORDER BY created_at`, [resId]).then(rs => rs.map(r => parse(r)));

/* ---------- propunerea de factură pentru o ședere ---------- */

export interface Draft {
  reservationId: string;
  buyerName: string; buyerTaxId: string; buyerAddress: string;
  issuedOn: string; dueOn: string | null;
  series: string; vatRate: number; note: string;
  lines: { description: string; qty: number; unit: string; unitPrice: number }[];
  company: Company;
  missing: string[];
}

export async function draftFor(db: Db, reservationId: string): Promise<Draft> {
  const company = await getCompany(db);
  const [r] = await db.query<{ guestId: string; checkIn: string; checkOut: string; pax: number; total: number; status: string; guest: string; rooms: string | null }>(
    `SELECT r.guest_id AS \`guestId\`, r.check_in AS \`checkIn\`, r.check_out AS \`checkOut\`, r.pax, r.total, r.status,
            TRIM(CONCAT(g.first_name, ' ', g.last_name)) AS guest,
            (SELECT GROUP_CONCAT(rm.name ORDER BY rr.position SEPARATOR ' + ') FROM reservation_rooms rr
               JOIN rooms rm ON rm.id = rr.room_id WHERE rr.reservation_id = r.id) AS rooms
       FROM reservations r JOIN guests g ON g.id = r.guest_id WHERE r.id = $1`, [reservationId]);
  if (!r) throw new DomainError(404, 'Rezervarea nu mai există.');

  // dacă oaspetele a mai primit o factură, îi luăm datele de atunci, ca să nu fie rescrise
  const [before] = await db.query<{ buyerName: string; buyerTaxId: string; buyerAddress: string }>(
    'SELECT buyer_name AS `buyerName`, buyer_tax_id AS `buyerTaxId`, buyer_address AS `buyerAddress` FROM invoices WHERE guest_id = $1 ORDER BY created_at DESC LIMIT 1',
    [r.guestId]);

  const extras = await db.query<{ label: string; qty: number; unitPrice: number }>(
    'SELECT label, qty, unit_price AS `unitPrice` FROM reservation_extras WHERE reservation_id = $1 ORDER BY created_at, id', [reservationId]);
  const extrasSum = extras.reduce((t, e) => t + Number(e.qty) * Number(e.unitPrice), 0);

  const today = todayIso();
  return {
    reservationId,
    buyerName: before?.buyerName || r.guest,
    buyerTaxId: before?.buyerTaxId ?? '',
    buyerAddress: before?.buyerAddress ?? '',
    issuedOn: today,
    dueOn: dueDate(today, company.dueDays),
    series: company.series,
    vatRate: company.vatPayer ? company.vatRate : 0,
    note: company.note,
    // serviciile în plus sunt deja cuprinse în total, deci linia de cazare e restul
    lines: [stayLine(r.rooms ?? '—', r.checkIn, r.checkOut, Math.max(0, Math.round((Number(r.total) - extrasSum) * 100) / 100), r.pax),
      ...extras.map(e => ({ description: e.label, qty: Number(e.qty), unit: 'buc', unitPrice: Number(e.unitPrice) }))],
    company,
    missing: missingCompanyFields(company),
  };
}

/* ---------- emitere ---------- */

/** Următorul număr liber din serie. Rândul e blocat până la capătul tranzacției, deci două emiteri
 *  în același moment primesc numere diferite, iar dacă scrierea eșuează numărul nu se pierde. */
async function nextNumber(q: Q, series: string): Promise<number> {
  await q('INSERT INTO invoice_series (code, next_no) VALUES ($1, 1) ON DUPLICATE KEY UPDATE code = code', [series]);
  const [row] = await q<{ next_no: number }>('SELECT next_no FROM invoice_series WHERE code = $1 FOR UPDATE', [series]);
  await q('UPDATE invoice_series SET next_no = next_no + 1 WHERE code = $1', [series]);
  return Number(row.next_no);
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const numOf = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(String(v ?? '').replace(',', '.')));

function readLines(raw: unknown, vatRate: number): InvoiceLine[] {
  if (!Array.isArray(raw) || !raw.length) throw new DomainError(400, 'Factura are nevoie de cel puțin o linie.');
  if (raw.length > 50) throw new DomainError(400, 'Prea multe linii pe factură.');
  return raw.map((x, i) => {
    const l = (x ?? {}) as Record<string, unknown>;
    const description = text(l.description, 300);
    const qty = numOf(l.qty), unitPrice = numOf(l.unitPrice);
    if (!description) throw new DomainError(400, `Scrie ce se facturează pe linia ${i + 1}.`);
    if (!Number.isFinite(qty) || qty === 0) throw new DomainError(400, `Cantitatea de pe linia ${i + 1} nu e validă.`);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new DomainError(400, `Prețul de pe linia ${i + 1} nu e valid.`);
    return fillLine({ description, qty: round2(qty), unit: text(l.unit, 20) || 'buc', unitPrice: round2(unitPrice) }, vatRate);
  });
}

async function insert(q: Q, inv: Omit<Invoice, 'id'> & { id: string }) {
  await q(`INSERT INTO invoices (id, series, \`number\`, kind, storno_of, reservation_id, guest_id, issued_on, due_on,
      buyer_name, buyer_tax_id, buyer_address, seller, vat_rate, net, vat, total, note)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
    [inv.id, inv.series, inv.number, inv.kind, inv.stornoOf, inv.reservationId, inv.guestId, inv.issuedOn, inv.dueOn,
      inv.buyerName, inv.buyerTaxId, inv.buyerAddress, JSON.stringify(inv.seller), inv.vatRate, inv.net, inv.vat, inv.total, inv.note]);
  for (const [i, l] of inv.lines.entries()) {
    await q('INSERT INTO invoice_lines (id, invoice_id, position, description, qty, unit, unit_price, net, vat, total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [newId('il_'), inv.id, i, l.description, l.qty, l.unit, l.unitPrice, l.net, l.vat, l.total]);
  }
}

/** Trece numărul facturii și pe rezervare, ca să se vadă în sertar și în listă. */
const stampReservation = (q: Q, resId: string | null, no: string, date: string | null) =>
  resId ? q('UPDATE reservations SET invoice_no = $2, invoice_date = $3, updated_at = now() WHERE id = $1', [resId, no, date]) : Promise.resolve([]);

export async function createInvoice(db: Db, raw: unknown): Promise<Invoice> {
  const b = (raw ?? {}) as Record<string, unknown>;
  const company = await getCompany(db);
  const missing = missingCompanyFields(company);
  if (missing.length) throw new DomainError(400, `Completează întâi datele pensiunii în Setări: ${missing.join(', ')}.`);

  const buyerName = text(b.buyerName, 200);
  if (!buyerName) throw new DomainError(400, 'Scrie numele clientului.');
  const issuedOn = isIsoDate(b.issuedOn) ? b.issuedOn : todayIso();
  const dueOn = b.dueOn === null || b.dueOn === '' ? null : isIsoDate(b.dueOn) ? b.dueOn : dueDate(issuedOn, company.dueDays);
  if (dueOn && dueOn < issuedOn) throw new DomainError(400, 'Scadența nu poate fi înaintea datei facturii.');
  const vatRate = company.vatPayer ? (b.vatRate === undefined ? company.vatRate : Math.min(100, Math.max(0, numOf(b.vatRate) || 0))) : 0;
  const lines = readLines(b.lines, vatRate);
  const series = (text(b.series, 12).toUpperCase().replace(/[^A-Z0-9-]/g, '') || company.series);
  const reservationId = text(b.reservationId, 40) || null;

  return db.tx(async q => {
    let guestId: string | null = null;
    if (reservationId) {
      const [r] = await q<{ guest_id: string }>('SELECT guest_id FROM reservations WHERE id = $1', [reservationId]);
      if (!r) throw new DomainError(404, 'Rezervarea nu mai există.');
      guestId = r.guest_id;
    }
    const inv: Invoice = {
      id: newId('inv_'), series, number: await nextNumber(q, series), kind: 'invoice', stornoOf: null,
      reservationId, guestId, issuedOn, dueOn, buyerName,
      buyerTaxId: text(b.buyerTaxId, 40), buyerAddress: text(b.buyerAddress, 300),
      seller: company, vatRate, ...totals(lines), note: text(b.note, 1000) || company.note, lines,
    };
    await insert(q, inv);
    await stampReservation(q, reservationId, invoiceNo(inv.series, inv.number), inv.issuedOn);
    return inv;
  });
}

/**
 * Stornarea: o factură nouă, cu aceleași linii în minus, care o anulează pe cea greșită.
 * Factura veche rămâne în registru — așa cere legea, o factură emisă nu se șterge.
 */
export async function stornoInvoice(db: Db, id: string): Promise<Invoice> {
  return db.tx(async q => {
    const old = await getInvoice(q, id);
    if (!old) throw new DomainError(404, 'Factura nu există.');
    if (old.kind === 'storno') throw new DomainError(400, 'O factură de stornare nu se mai stornează.');
    const [already] = await q('SELECT id FROM invoices WHERE storno_of = $1', [id]);
    if (already) throw new DomainError(400, 'Factura a fost deja stornată.');

    const lines = old.lines.map(l => ({ ...l, qty: -l.qty, net: -l.net, vat: -l.vat, total: -l.total }));
    const inv: Invoice = {
      ...old, id: newId('inv_'), series: old.series, number: await nextNumber(q, old.series),
      kind: 'storno', stornoOf: old.id, issuedOn: todayIso(), dueOn: null,
      ...totals(lines), lines,
      note: `Stornare a facturii ${invoiceNo(old.series, old.number)} din ${old.issuedOn}.`,
    };
    await insert(q, inv);
    // rezervarea rămâne fără factură, ca să se poată emite alta corectă
    if (old.reservationId) await stampReservation(q, old.reservationId, '', null);
    return inv;
  });
}
