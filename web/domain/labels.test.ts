// Cuvintele de la recepție și listele din baza de date trebuie să spună același lucru: dacă cineva adaugă
// o sursă în aplicație și uită de migrare (sau invers), INSERT-ul pică abia în producție. Aici pică aici.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { METHOD, METHODS, PAY_L, SOURCES, SRC, SRC_SHORT, STATUS, STATUSES } from './labels';

const sql = fs.readFileSync(fileURLToPath(new URL('../db/migrations/001_init.sql', import.meta.url)), 'utf8');
/** Valorile permise dintr-un CHECK (col IN ('a','b')) al schemei. */
const checkList = (col: string) => {
  const m = new RegExp(`CHECK \\(${col} IN \\(([^)]+)\\)\\)`).exec(sql);
  if (!m) throw new Error(`Nu am găsit CHECK pentru "${col}" în 001_init.sql`);
  return m[1].split(',').map(x => x.trim().replace(/^'|'$/g, '')).sort();
};

describe('etichete', () => {
  it('sursele din aplicație sunt exact cele acceptate de baza de date', () => expect(SOURCES.slice().sort()).toEqual(checkList('source')));
  it('statusurile din aplicație sunt exact cele acceptate de baza de date', () => expect(STATUSES.slice().sort()).toEqual(checkList('status')));
  it('metodele de plată din aplicație sunt exact cele acceptate de baza de date', () => expect(METHODS.slice().sort()).toEqual(checkList('method')));

  it('fiecare sursă are și o formă scurtă', () => expect(Object.keys(SRC_SHORT).sort()).toEqual(SOURCES.slice().sort()));
  it('fiecare stare de plată are o etichetă', () => expect(Object.keys(PAY_L).sort()).toEqual(['paid', 'partial', 'unpaid']));
  it('nicio etichetă nu e goală', () => {
    for (const map of [STATUS, SRC, SRC_SHORT, METHOD, PAY_L])
      for (const [k, v] of Object.entries(map)) expect(v, k).toMatch(/\S/);
  });
});
