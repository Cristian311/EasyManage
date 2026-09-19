// Importul de rezervări: aceeași verificare ca la previzualizare, apoi fiecare rând bun intră pe drumul
// obișnuit (createReservation), deci cu toate regulile și cu plasa de siguranță din baza de date.
import { parseCsv } from '@/domain/csv';
import { planImport, plain, type ImportRow } from '@/domain/import';
import { guestName } from '@/domain/rules';
import type { Db } from './db';
import { DomainError } from './errors';
import { createReservation, loadState } from './repo';

export interface ImportReport { rows: (ImportRow & { created?: boolean })[]; problem: string | null; ok: number; bad: number; created: number }

export async function importReservations(db: Db, raw: unknown): Promise<ImportReport> {
  const b = (raw ?? {}) as { csv?: unknown; dryRun?: unknown };
  if (typeof b.csv !== 'string' || !b.csv.trim()) throw new DomainError(400, 'Alege un fișier sau lipește rândurile din Excel.');
  if (b.csv.length > 2_000_000) throw new DomainError(400, 'Fișierul e prea mare. Împarte-l în bucăți de câteva mii de rânduri.');

  const state = await loadState(db);
  const { rows, problem } = planImport(parseCsv(b.csv), state);
  const report: ImportReport = { rows, problem, ok: rows.filter(r => !r.errors.length).length, bad: rows.filter(r => r.errors.length).length, created: 0 };
  if (problem || b.dryRun !== false) return report;

  // oaspeții noi se fac o singură dată, chiar dacă apar pe mai multe rânduri
  const guestIds = new Map(state.guests.map(g => [plain(guestName(g)), g.id]));
  for (const r of report.rows) {
    if (r.errors.length) continue;
    try {
      const known = guestIds.get(plain(r.guest));
      const out = await createReservation(db, {
        roomIds: r.roomIds, checkIn: r.checkIn, checkOut: r.checkOut, pax: r.pax, total: r.total, source: r.source, notes: r.notes,
        advance: r.advance, ...(known ? { guestId: known } : { guestName: r.guest, guestPhone: r.phone }),
      });
      if (out.guest) guestIds.set(plain(r.guest), out.guest.id);
      r.created = true; report.created++;
    } catch (e) {
      // între verificare și scriere se poate să fi apărut altă rezervare; rândul rămâne pe dinafară, restul merg mai departe
      r.errors.push(e instanceof DomainError ? e.message : 'nu a putut fi salvat');
      report.ok--; report.bad++;
    }
  }
  return report;
}
