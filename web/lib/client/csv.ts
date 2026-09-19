'use client';
import { toCsv, type CsvCol } from '@/domain/csv';

/** Salvează rândurile ca fișier .csv. Semnul de la început (BOM) îi spune Excelului că textul e UTF-8, deci diacriticele ies bine. */
export function downloadCsv<T>(name: string, rows: T[], cols: CsvCol<T>[]) {
  const blob = new Blob(['﻿' + toCsv(rows, cols)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name.replace(/[^\w.-]+/g, '_') + '.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
