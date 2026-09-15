// The firm's data and the invoice register. A number, once given, stays: a wrong invoice is cancelled, never deleted,
// so the register has no holes.
import type { Db, Q } from './db';
import type { Invoice, InvoiceLine, Settings } from '@/domain/types';
import { todayIso } from '@/domain/dates';
import { invoiceNo, invoiceTotals, r2, validateInvoice } from '@/domain/invoice';
import { DomainError } from './errors';
import { newId } from './ids';
import { getReservation } from './repo';

type Body = Record<string, unknown>;
const asBody = (v: unknown): Body => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new DomainError(400, 'Cerere invalidă.'); return v as Body; };
const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v) ? +v : undefined);
const bool = (v: unknown) => (typeof v === 'boolean' ? v : undefined);

/* ---------- settings ---------- */
const SET_COLS = `company_name AS name, cui, reg_com AS "regCom", address, iban, bank, phone, email, vat_payer AS "vatPayer", vat_rate AS "vatRate",
  invoice_series AS "invoiceSeries", invoice_next AS "invoiceNext", check_in_time AS "checkInTime", check_out_time AS "checkOutTime", confirm_text AS "confirmText"`;
export async function loadSettings(q: Q, lock = false): Promise<Settings> {
  const [s] = await q<Settings>(`SELECT ${SET_COLS} FROM settings WHERE id = 'main'${lock ? ' FOR UPDATE' : ''}`);
  return s;
}

export async function updateSettings(db: Db, raw: unknown) {
  const b = asBody(raw), cur = await loadSettings(db.query);
  const s: Settings = {
    name: str(b.name, 200) ?? cur.name, cui: str(b.cui, 40) ?? cur.cui, regCom: str(b.regCom, 60) ?? cur.regCom, address: str(b.address, 500) ?? cur.address,
    iban: str(b.iban, 60) ?? cur.iban, bank: str(b.bank, 100) ?? cur.bank, phone: str(b.phone, 60) ?? cur.phone, email: str(b.email, 200) ?? cur.email,
    vatPayer: bool(b.vatPayer) ?? cur.vatPayer, vatRate: num(b.vatRate) ?? cur.vatRate,
    invoiceSeries: str(b.invoiceSeries, 12) ?? cur.invoiceSeries, invoiceNext: num(b.invoiceNext) ?? cur.invoiceNext,
    checkInTime: str(b.checkInTime, 5) ?? cur.checkInTime, checkOutTime: str(b.checkOutTime, 5) ?? cur.checkOutTime, confirmText: str(b.confirmText, 1000) ?? cur.confirmText,
  };
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,11}$/.test(s.invoiceSeries)) throw new DomainError(400, 'Seria facturii: litere, cifre și cratimă, cel mult 12 caractere.');
  if (![s.checkInTime, s.checkOutTime].every(t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t))) throw new DomainError(400, 'Orele de check-in și check-out trebuie să fie de forma 14:00.');
  if (!Number.isInteger(s.vatRate) || s.vatRate < 0 || s.vatRate > 99) throw new DomainError(400, 'Cota de TVA trebuie să fie un număr întreg între 0 și 99.');
  if (!Number.isInteger(s.invoiceNext) || s.invoiceNext < 1) throw new DomainError(400, 'Următorul număr de factură trebuie să fie cel puțin 1.');
  const [{ m }] = await db.query<{ m: number }>('SELECT coalesce(max(number), 0)::int AS m FROM invoices WHERE series = $1', [s.invoiceSeries]);
  if (s.invoiceNext <= m) throw new DomainError(400, `În seria ${s.invoiceSeries} există deja factura cu numărul ${m}; următorul număr trebuie să fie cel puțin ${m + 1}.`);
  await db.query(`UPDATE settings SET company_name=$1, cui=$2, reg_com=$3, address=$4, iban=$5, bank=$6, phone=$7, email=$8, vat_payer=$9, vat_rate=$10,
    invoice_series=$11, invoice_next=$12, check_in_time=$13, check_out_time=$14, confirm_text=$15 WHERE id = 'main'`,
    [s.name, s.cui, s.regCom, s.address, s.iban, s.bank, s.phone, s.email, s.vatPayer, s.vatRate, s.invoiceSeries, s.invoiceNext, s.checkInTime, s.checkOutTime, s.confirmText]);
  return { settings: await loadSettings(db.query) };
}

/* ---------- invoices ---------- */
// the json columns come back as text and are parsed here, the same way on both drivers
const INV_COLS = `id, series, number, reservation_id AS "reservationId", issued_on::text AS "issuedOn", due_on::text AS "dueOn", status,
  supplier::text AS supplier, customer::text AS customer, lines::text AS lines, subtotal::float8 AS subtotal, vat::float8 AS vat, total::float8 AS total, notes, created_at::text AS "createdAt"`;
type InvRow = Omit<Invoice, 'supplier' | 'customer' | 'lines'> & { supplier: string; customer: string; lines: string };
const parse = (r: InvRow): Invoice => ({ ...r, supplier: JSON.parse(r.supplier), customer: JSON.parse(r.customer), lines: JSON.parse(r.lines) });

export async function loadInvoices(q: Q): Promise<Invoice[]> {
  return (await q<InvRow>(`SELECT ${INV_COLS} FROM invoices ORDER BY issued_on, series, number`)).map(parse);
}
async function getInvoice(q: Q, id: string): Promise<Invoice | null> {
  const [r] = await q<InvRow>(`SELECT ${INV_COLS} FROM invoices WHERE id = $1`, [id]);
  return r ? parse(r) : null;
}

function lineList(v: unknown): InvoiceLine[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 50).map(l => { const b = asBody(l); return { desc: str(b.desc, 300) ?? '', qty: num(b.qty) ?? NaN, unit: str(b.unit, 20) || 'buc', price: num(b.price) ?? NaN, vat: num(b.vat) ?? 0 }; });
}

/** Issues an invoice with the next number of the series; for a stay, the reservation gets the number too. */
export async function createInvoice(db: Db, raw: unknown) {
  const b = asBody(raw), c = asBody(b.customer ?? {});
  const x = {
    reservationId: str(b.reservationId, 100) || null,
    issuedOn: str(b.issuedOn) || todayIso(), dueOn: str(b.dueOn) || null,
    customer: { name: str(c.name, 200) ?? '', cui: str(c.cui, 40) ?? '', regCom: str(c.regCom, 60) ?? '', address: str(c.address, 500) ?? '' },
    lines: lineList(b.lines), notes: str(b.notes, 1000) ?? '',
  };
  const err = validateInvoice(x); if (err) throw new DomainError(400, err);
  return db.tx(async q => {
    const s = await loadSettings(q, true);
    if (!s.name || !s.cui) throw new DomainError(400, 'Completează numele firmei și CUI-ul în Setări înainte de prima factură.');
    const lines = x.lines.map(l => ({ ...l, desc: l.desc.trim(), qty: r2(l.qty), price: r2(l.price), vat: s.vatPayer ? Math.round(l.vat) : 0 }));
    if (x.reservationId) {
      if (!(await getReservation(q, x.reservationId))) throw new DomainError(404, 'Rezervarea nu mai există.');
      const [dup] = await q<{ series: string; number: number }>(`SELECT series, number FROM invoices WHERE reservation_id = $1 AND status = 'issued'`, [x.reservationId]);
      if (dup) throw new DomainError(400, `Rezervarea are deja factura ${invoiceNo(dup)}. Anuleaz-o întâi dacă vrei alta.`);
    }
    const no = { series: s.invoiceSeries, number: s.invoiceNext }, t = invoiceTotals(lines), id = newId('inv_');
    const supplier = { name: s.name, cui: s.cui, regCom: s.regCom, address: s.address, iban: s.iban, bank: s.bank, phone: s.phone, email: s.email, vatPayer: s.vatPayer };
    await q(`UPDATE settings SET invoice_next = invoice_next + 1 WHERE id = 'main'`);
    try {
      await q(`INSERT INTO invoices (id, series, number, reservation_id, issued_on, due_on, supplier, customer, lines, subtotal, vat, total, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7::text::jsonb,$8::text::jsonb,$9::text::jsonb,$10,$11,$12,$13)`,
        [id, no.series, no.number, x.reservationId, x.issuedOn, x.dueOn, JSON.stringify(supplier), JSON.stringify(x.customer), JSON.stringify(lines), t.subtotal, t.vat, t.total, x.notes]);
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw new DomainError(409, `Numărul ${invoiceNo(no)} există deja. Mărește „următorul număr” în Setări.`);
      throw e;
    }
    let reservation = null;
    if (x.reservationId) {
      await q('UPDATE reservations SET invoice_no = $2, invoice_date = $3, updated_at = now() WHERE id = $1', [x.reservationId, invoiceNo(no), x.issuedOn]);
      reservation = await getReservation(q, x.reservationId);
    }
    return { invoice: (await getInvoice(q, id))!, reservation };
  });
}

/** The invoice stays in the register, marked cancelled; the stay can be invoiced again. */
export async function cancelInvoice(db: Db, id: string) {
  return db.tx(async q => {
    const cur = await getInvoice(q, id); if (!cur) throw new DomainError(404, 'Factura nu există.');
    if (cur.status === 'cancelled') throw new DomainError(400, 'Factura este deja anulată.');
    await q(`UPDATE invoices SET status = 'cancelled' WHERE id = $1`, [id]);
    let reservation = null;
    if (cur.reservationId) {
      await q(`UPDATE reservations SET invoice_no = '', invoice_date = NULL, updated_at = now() WHERE id = $1 AND invoice_no = $2`, [cur.reservationId, invoiceNo(cur)]);
      reservation = await getReservation(q, cur.reservationId);
    }
    return { invoice: (await getInvoice(q, id))!, reservation };
  });
}
