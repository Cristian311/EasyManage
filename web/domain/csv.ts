// CSV pe care Excelul românesc îl deschide direct: câmpuri despărțite cu „;”, zecimale cu virgulă.
// Fără bază de date, fără interfață.

export type CsvCol<T> = [header: string, value: (row: T) => string | number | boolean | null | undefined];

/** Un câmp: ghilimele dacă are „;”, ghilimele sau rând nou; numerele cu virgulă, ca Excelul să le vadă ca numere. */
export function csvField(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v).replace('.', ',') : '';
  if (typeof v === 'boolean') return v ? 'da' : 'nu';
  // un text care începe cu = + - @ ar fi luat de Excel drept formulă; apostroful îl ține text
  const s = /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
  return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function toCsv<T>(rows: T[], cols: CsvCol<T>[]): string {
  const lines = [cols.map(c => csvField(c[0])).join(';'), ...rows.map(r => cols.map(c => csvField(c[1](r))).join(';'))];
  return lines.join('\r\n') + '\r\n';
}

/** Citește un CSV: desparte singur după „;”, „,” sau tab, ține cont de ghilimele și de rândurile noi din câmpuri. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const count = (ch: string) => firstLine.split(ch).length - 1;
  const sep = count(';') >= count(',') && count(';') >= count('\t') ? ';' : count('\t') > count(',') ? '\t' : ',';

  const rows: string[][] = []; let row: string[] = [], cur = '', quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') { if (src[i + 1] === '"') { cur += '"'; i++; } else quoted = false; }
      else cur += c;
    } else if (c === '"' && cur === '') quoted = true;
    else if (c === sep) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cur); cur = ''; rows.push(row); row = [];
    } else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(f => f.trim() !== ''));
}
