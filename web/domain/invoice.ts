// Invoices: numbering, amounts and the default lines for a stay. Pure functions, used in the browser and on the server.
import type { AppState, InvoiceCustomer, InvoiceLine, Reservation } from './types';
import { fmtD, isIsoDate } from './dates';
import { nights, roomLabel } from './rules';

export const r2 = (n: number) => Math.round(n * 100) / 100;
export const invoiceNo = (i: { series: string; number: number }) => `${i.series}-${String(i.number).padStart(4, '0')}`;
export const amount = (n: number) => n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Prices include VAT, like the prices of the rooms; the net part is taken out of the total. */
export function lineTotals(l: InvoiceLine) {
  const total = r2(l.qty * l.price), net = r2(total / (1 + l.vat / 100));
  return { net, vat: r2(total - net), total };
}
export function invoiceTotals(lines: InvoiceLine[]) {
  const t = { subtotal: 0, vat: 0, total: 0 };
  lines.forEach(l => { const x = lineTotals(l); t.subtotal += x.net; t.vat += x.vat; t.total += x.total; });
  return { subtotal: r2(t.subtotal), vat: r2(t.vat), total: r2(t.total) };
}

/** One line for the stay: per night when the total splits evenly, otherwise the whole stay as one item. */
export function stayLines(s: AppState, r: Reservation, vat: number): InvoiceLine[] {
  const n = nights(r), rooms = roomLabel(s, r), when = `${fmtD(r.checkIn)} – ${fmtD(r.checkOut)} ${r.checkOut.slice(0, 4)}`;
  const label = r.roomIds.length > 1 ? `camerele ${rooms}` : `camera ${rooms}`;
  const perNight = r2(r.total / n);
  if (r2(perNight * n) === r2(r.total)) return [{ desc: `Cazare ${label}, ${when}`, qty: n, unit: n === 1 ? 'noapte' : 'nopți', price: perNight, vat }];
  return [{ desc: `Cazare ${label}, ${n} ${n === 1 ? 'noapte' : 'nopți'}, ${when}`, qty: 1, unit: 'sejur', price: r2(r.total), vat }];
}

export interface InvoiceFields { customer: InvoiceCustomer; lines: InvoiceLine[]; issuedOn: string; dueOn: string | null }
/** The message for the receptionist when something is missing, or null when the invoice can be issued. */
export function validateInvoice(x: InvoiceFields): string | null {
  if (!x.customer.name.trim()) return 'Scrie numele clientului.';
  if (!isIsoDate(x.issuedOn)) return 'Data facturii nu este validă.';
  if (x.dueOn && (!isIsoDate(x.dueOn) || x.dueOn < x.issuedOn)) return 'Scadența trebuie să fie după data facturii.';
  if (!x.lines.length) return 'Factura trebuie să aibă cel puțin un rând.';
  for (const l of x.lines) {
    if (!l.desc.trim()) return 'Fiecare rând are nevoie de o descriere.';
    if (!(l.qty > 0) || !Number.isFinite(l.qty)) return `Cantitatea de la „${l.desc}” nu este validă.`;
    if (!(l.price >= 0) || !Number.isFinite(l.price)) return `Prețul de la „${l.desc}” nu este valid.`;
    if (!(l.vat >= 0 && l.vat < 100)) return 'Cota de TVA nu este validă.';
  }
  return null;
}
