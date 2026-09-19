// Facturi: forma lor și socoteala, fără bază de date și fără interfață, ca să poată fi verificate
// cu teste și folosite la fel pe server și în browser.
import { addDays, diffDays, fromIso, MONTHS_L, pad } from './dates';

export interface Company {
  name: string; taxId: string; regNo: string; address: string;
  iban: string; bank: string; email: string; phone: string;
  vatPayer: boolean; vatRate: number; series: string; dueDays: number; note: string;
}

export interface InvoiceLine {
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  net: number;
  vat: number;
  total: number;
}

export interface Invoice {
  id: string;
  series: string;
  number: number;
  kind: 'invoice' | 'storno';
  stornoOf: string | null;
  reservationId: string | null;
  guestId: string | null;
  issuedOn: string;
  dueOn: string | null;
  buyerName: string;
  buyerTaxId: string;
  buyerAddress: string;
  seller: Company;
  vatRate: number;
  net: number;
  vat: number;
  total: number;
  note: string;
  lines: InvoiceLine[];
}

export const EMPTY_COMPANY: Company = {
  name: '', taxId: '', regNo: '', address: '', iban: '', bank: '', email: '', phone: '',
  vatPayer: false, vatRate: 0, series: 'VS', dueDays: 0, note: '',
};

/** „VS 0042” — numărul se scrie cu cel puțin patru cifre, ca facturile să se aranjeze frumos în listă. */
export const invoiceNo = (series: string, number: number) => `${series} ${String(number).padStart(4, '0')}`;

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** O sumă în lei, scrisă românește: 1.234,50 lei */
export const lei2 = (n: number) => n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' lei';

export const fmtLong = (s: string) => { const d = fromIso(s); return `${d.getDate()} ${MONTHS_L[d.getMonth()].toLowerCase()} ${d.getFullYear()}`; };

/**
 * Completează o linie: din cantitate și preț ies valoarea fără TVA, TVA-ul și totalul.
 * Prețul scris de om e cel pe care îl vede clientul, adică **cu TVA inclus**, așa cum e obiceiul la
 * cazare; de aceea TVA-ul se scoate din el, nu se adaugă peste.
 */
export function fillLine(x: { description: string; qty: number; unit: string; unitPrice: number }, vatRate: number): InvoiceLine {
  const total = round2(x.qty * x.unitPrice);
  const net = round2(total / (1 + vatRate / 100));
  return { ...x, net, vat: round2(total - net), total };
}

/** Totalurile facturii, adunate din linii, ca să nu depindă de rotunjiri pe drum. */
export function totals(lines: InvoiceLine[]) {
  const net = round2(lines.reduce((t, l) => t + l.net, 0));
  const total = round2(lines.reduce((t, l) => t + l.total, 0));
  return { net, vat: round2(total - net), total };
}

/** Data scadenței: numărul de zile din setări, iar 0 înseamnă „la emitere”. */
export const dueDate = (issuedOn: string, dueDays: number) => (dueDays > 0 ? addDays(issuedOn, dueDays) : null);

/**
 * Linia propusă pentru o ședere: „Cazare 101 + 102, 3 nopți (12–15 aug 2026)”, cu prețul pe noapte
 * scos din totalul rezervării, ca factura să spună exact cât s-a înțeles cu oaspetele.
 */
export function stayLine(rooms: string, checkIn: string, checkOut: string, total: number, pax: number) {
  const n = Math.max(1, diffDays(checkIn, checkOut));
  return {
    description: `Cazare ${rooms}, ${n} ${n === 1 ? 'noapte' : 'nopți'} (${fmtLong(checkIn)} – ${fmtLong(checkOut)}), ${pax} ${pax === 1 ? 'persoană' : 'persoane'}`,
    qty: n,
    unit: n === 1 ? 'noapte' : 'nopți',
    unitPrice: round2(total / n),
  };
}

/** Luna unei facturi, pentru grupare: „2026-08”. */
export const invoiceMonth = (issuedOn: string) => issuedOn.slice(0, 7);

/** Ce lipsește din datele pensiunii ca să poți emite o factură. */
export function missingCompanyFields(c: Company): string[] {
  const out: string[] = [];
  if (!c.name.trim()) out.push('numele pensiunii sau al firmei');
  if (!c.taxId.trim()) out.push('CUI-ul');
  if (!c.address.trim()) out.push('adresa');
  return out;
}

export const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
