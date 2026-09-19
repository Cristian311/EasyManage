// Setările programului, ținute ca perechi nume/valoare în tabelul settings.
import type { Company } from '@/domain/invoice';
import { EMPTY_COMPANY } from '@/domain/invoice';
import { DEFAULT_TEMPLATE } from '@/domain/message';
import type { Db, Q } from './db';

const KEYS: Record<keyof Company, string> = {
  name: 'company_name', taxId: 'company_tax_id', regNo: 'company_reg_no', address: 'company_address',
  iban: 'company_iban', bank: 'company_bank', email: 'company_email', phone: 'company_phone',
  vatPayer: 'vat_payer', vatRate: 'vat_rate', series: 'invoice_series', dueDays: 'invoice_due_days', note: 'invoice_note',
};

const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(String(v ?? '').replace(',', '.')) || 0);

/** Datele pensiunii, cu valorile implicite acolo unde nu s-a scris încă nimic. */
export async function getCompany(q: Q | Db): Promise<Company> {
  const run: Q = typeof q === 'function' ? q : q.query;
  const rows = await run<{ name: string; value: string }>('SELECT name, `value` FROM settings');
  const got = new Map(rows.map(r => [r.name, r.value]));
  const read = (k: keyof Company) => got.get(KEYS[k]);
  return {
    ...EMPTY_COMPANY,
    name: read('name') ?? '', taxId: read('taxId') ?? '', regNo: read('regNo') ?? '', address: read('address') ?? '',
    iban: read('iban') ?? '', bank: read('bank') ?? '', email: read('email') ?? '', phone: read('phone') ?? '',
    vatPayer: read('vatPayer') === '1',
    vatRate: num(read('vatRate')),
    series: (read('series') || EMPTY_COMPANY.series).toUpperCase(),
    dueDays: Math.max(0, Math.round(num(read('dueDays')))),
    note: read('note') ?? '',
  };
}

/** Scrie numai câmpurile trimise; restul rămân cum erau. */
export async function saveCompany(db: Db, raw: unknown): Promise<Company> {
  const b = (raw ?? {}) as Record<string, unknown>;
  const cur = await getCompany(db);
  const next: Company = {
    name: 'name' in b ? str(b.name, 200) : cur.name,
    taxId: 'taxId' in b ? str(b.taxId, 40) : cur.taxId,
    regNo: 'regNo' in b ? str(b.regNo, 40) : cur.regNo,
    address: 'address' in b ? str(b.address) : cur.address,
    iban: 'iban' in b ? str(b.iban, 40).toUpperCase().replace(/\s+/g, '') : cur.iban,
    bank: 'bank' in b ? str(b.bank, 80) : cur.bank,
    email: 'email' in b ? str(b.email, 160) : cur.email,
    phone: 'phone' in b ? str(b.phone, 60) : cur.phone,
    vatPayer: 'vatPayer' in b ? b.vatPayer === true : cur.vatPayer,
    vatRate: 'vatRate' in b ? Math.min(100, Math.max(0, num(b.vatRate))) : cur.vatRate,
    // seria intră în numărul facturii, deci numai litere, cifre și liniuțe
    series: 'series' in b ? (str(b.series, 12).toUpperCase().replace(/[^A-Z0-9-]/g, '') || cur.series) : cur.series,
    dueDays: 'dueDays' in b ? Math.min(365, Math.max(0, Math.round(num(b.dueDays)))) : cur.dueDays,
    note: 'note' in b ? str(b.note, 1000) : cur.note,
  };
  const rows = (Object.keys(KEYS) as (keyof Company)[]).map(k => {
    const v = next[k];
    return [KEYS[k], typeof v === 'boolean' ? (v ? '1' : '0') : String(v)];
  });
  await db.tx(async q => {
    for (const [name, value] of rows) {
      await q('INSERT INTO settings (name, `value`) VALUES ($1,$2) ON DUPLICATE KEY UPDATE `value` = $2, updated_at = now()', [name, value]);
    }
  });
  return next;
}

/* ---------- șablonul mesajului de confirmare ---------- */

export interface MessageTemplate { template: string; sender: string; isDefault: boolean }

/** Șablonul și numele care semnează. Îl citește și recepția, pentru că ea trimite confirmările. */
export async function getTemplate(db: Db): Promise<MessageTemplate> {
  const rows = await db.query<{ name: string; value: string }>("SELECT name, `value` FROM settings WHERE name IN ('confirm_template', 'company_name')");
  const got = new Map(rows.map(r => [r.name, r.value]));
  const saved = (got.get('confirm_template') ?? '').trim();
  return { template: saved || DEFAULT_TEMPLATE, sender: got.get('company_name') ?? '', isDefault: !saved };
}

/** Un șablon gol înseamnă „înapoi la cel implicit”. */
export async function saveTemplate(db: Db, raw: unknown): Promise<MessageTemplate> {
  const t = typeof raw === 'string' ? raw.trim().slice(0, 3000) : '';
  await db.query("INSERT INTO settings (name, `value`) VALUES ('confirm_template', $1) ON DUPLICATE KEY UPDATE `value` = $1, updated_at = now()", [t]);
  return getTemplate(db);
}
