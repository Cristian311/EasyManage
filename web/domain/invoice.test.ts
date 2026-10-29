// Socoteala facturilor: fără bază de date, deci se verifică repede și la sânge.
import { describe, expect, it } from 'vitest';
import { EMPTY_COMPANY, dueDate, fillLine, fmtLong, invoiceNo, lei2, missingCompanyFields, round2, stayLine, totals } from './invoice';

describe('numărul facturii', () => {
  it('are cel puțin patru cifre, dar nu taie numerele mari', () => {
    expect(invoiceNo('VD', 7)).toBe('VD 0007');
    expect(invoiceNo('VD', 1234)).toBe('VD 1234');
    expect(invoiceNo('VS', 12345)).toBe('VS 12345');
  });
});

describe('o linie', () => {
  it('fără TVA, valoarea e cantitatea ori prețul', () => {
    expect(fillLine({ description: 'Cazare', qty: 3, unit: 'nopți', unitPrice: 220 }, 0)).toMatchObject({ net: 660, vat: 0, total: 660 });
  });
  it('cu TVA, prețul scris îl conține deja, iar TVA-ul se scoate din el', () => {
    expect(fillLine({ description: 'Cazare', qty: 1, unit: 'noapte', unitPrice: 111 }, 11)).toMatchObject({ net: 100, vat: 11, total: 111 });
    const l = fillLine({ description: 'Cazare', qty: 2, unit: 'nopți', unitPrice: 250 }, 9);
    expect(l.total).toBe(500);
    expect(round2(l.net + l.vat)).toBe(500);         // fără bani pierduți la rotunjire
  });
  it('o cantitate negativă (stornare) dă sume în minus', () => {
    expect(fillLine({ description: 'Cazare', qty: -2, unit: 'nopți', unitPrice: 250 }, 0).total).toBe(-500);
  });
  it('rotunjește la bani, nu mai departe', () => {
    expect(fillLine({ description: 'X', qty: 3, unit: 'buc', unitPrice: 33.333 }, 0).total).toBe(100);
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
  });
});

describe('totalurile', () => {
  it('se adună din linii, iar TVA-ul e diferența, ca totalul să iasă exact', () => {
    const lines = [fillLine({ description: 'A', qty: 1, unit: 'buc', unitPrice: 33.33 }, 19), fillLine({ description: 'B', qty: 1, unit: 'buc', unitPrice: 66.67 }, 19)];
    const t = totals(lines);
    expect(t.total).toBe(100);
    expect(round2(t.net + t.vat)).toBe(100);
  });
  it('fără linii, zero', () => expect(totals([])).toEqual({ net: 0, vat: 0, total: 0 }));
});

describe('linia propusă pentru o ședere', () => {
  it('spune camerele, nopțile, perioada și persoanele', () => {
    const l = stayLine('101 + 102', '2026-08-12', '2026-08-15', 1500, 4);
    expect(l.description).toBe('Cazare 101 + 102, 3 nopți (12 august 2026 – 15 august 2026), 4 persoane');
    expect(l).toMatchObject({ qty: 3, unit: 'nopți', unitPrice: 500 });
  });
  it('la singular: o noapte, o persoană', () => {
    const l = stayLine('P1', '2026-08-12', '2026-08-13', 180, 1);
    expect(l.description).toContain('1 noapte');
    expect(l.description).toContain('1 persoană');
    expect(l.unit).toBe('noapte');
  });
  it('prețul pe noapte ori nopțile dă totalul rezervării, cât se poate la bani', () => {
    const l = stayLine('101', '2026-08-01', '2026-08-04', 1000, 2);
    expect(l.unitPrice).toBe(333.33);
    expect(Math.abs(l.qty * l.unitPrice - 1000)).toBeLessThan(0.05);
  });
});

describe('scadența și datele', () => {
  it('0 zile înseamnă plata la emitere, deci fără scadență', () => {
    expect(dueDate('2026-08-10', 0)).toBeNull();
    expect(dueDate('2026-08-25', 10)).toBe('2026-09-04');
  });
  it('data scrisă pe factură e pe românește', () => expect(fmtLong('2026-09-01')).toBe('1 septembrie 2026'));
  it('sumele au mereu două zecimale', () => {
    expect(lei2(1234.5)).toMatch(/^1\.234,50 lei$/);
    expect(lei2(0)).toBe('0,00 lei');
  });
});

describe('datele pensiunii', () => {
  it('spune exact ce lipsește', () => {
    expect(missingCompanyFields(EMPTY_COMPANY)).toEqual(['numele pensiunii sau al firmei', 'CUI-ul', 'adresa']);
    expect(missingCompanyFields({ ...EMPTY_COMPANY, name: 'Vila', taxId: 'RO1', address: ' ' })).toEqual(['adresa']);
    expect(missingCompanyFields({ ...EMPTY_COMPANY, name: 'Vila', taxId: 'RO1', address: 'Str. 1' })).toEqual([]);
  });
});
