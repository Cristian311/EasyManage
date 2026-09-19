// Unde cade fiecare bloc pe calendar. Partea delicată: o rezervare pe camere care nu sunt una lângă alta
// se desenează în bucăți, iar două sejururi alăturate ale aceluiași oaspete se leagă printr-o punte.
import { describe, expect, it } from 'vitest';
import type { AppState, Reservation } from '@/domain/types';
import { ALL, guest, res, room, state } from '@/domain/fixtures';
import { columns } from '@/domain/rules';
import { layoutBlocks } from './layout';

const COLW = 120, ROWH = 28, ZOOM = 1, D0 = '2026-09-10', NDAYS = 14, TODAY = '2026-09-10';

const line = (reservations: Reservation[]): AppState =>
  state(reservations, { rooms: [room('A'), room('B'), room('C'), room('D')], guests: [guest('g'), guest('g2', { firstName: 'Ion', lastName: 'Rus' })] });

const lay = (s: AppState, rowh = ROWH, colw = COLW) => layoutBlocks(s, columns(s, ALL), D0, NDAYS, colw, rowh, ZOOM, TODAY);

describe('blocuri', () => {
  it('camere alăturate dau un singur bloc, lat cât ele', () => {
    const { blocks } = lay(line([res('r1', ['B', 'C'], '2026-09-12', '2026-09-15')]));
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ key: 'r1:0', ci: 1, span: 2, segment: false, top: 2 * ROWH, h: 3 * ROWH });
  });
  it('camere depărtate dau bucăți separate ale aceleiași rezervări', () => {
    const { blocks } = lay(line([res('r1', ['A', 'C'], '2026-09-12', '2026-09-14')]));
    expect(blocks.map(b => [b.key, b.ci, b.span, b.segment])).toEqual([['r1:0', 0, 1, true], ['r1:1', 2, 1, true]]);
  });
  it('ordinea camerelor în rezervare nu schimbă desenul', () => {
    const { blocks } = lay(line([res('r1', ['C', 'B'], '2026-09-12', '2026-09-14')]));
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ ci: 1, span: 2 });
  });

  it('o rezervare începută înainte de fereastră intră cu vârful tăiat', () => {
    const { blocks } = lay(line([res('r1', ['A'], '2026-09-08', '2026-09-12')]));
    expect(blocks).toHaveLength(1);
    expect(blocks[0].top).toBe(-2 * ROWH);
    expect(blocks[0].h).toBe(4 * ROWH);
  });
  it('ce e cu totul în afara ferestrei nu se desenează', () => {
    const before = res('r1', ['A'], '2026-09-01', '2026-09-10');      // pleacă exact în prima dimineață
    const after = res('r2', ['A'], '2026-09-24', '2026-09-26');       // fereastra ține până pe 24
    expect(lay(line([before])).blocks).toHaveLength(0);
    expect(lay(line([after])).blocks).toHaveLength(0);
  });
  it('o cameră care nu e pe calendar nu desenează nimic', () => {
    expect(lay(line([res('r1', ['X'], '2026-09-12', '2026-09-14')])).blocks).toHaveLength(0);
  });

  it('culoarea spune dintr-o privire ce fel de rezervare e', () => {
    const one = (r: Reservation) => lay(line([r])).blocks[0].color;
    expect(one(res('r', ['A'], '2026-09-12', '2026-09-14', { source: 'booking' }))).toBe('var(--src-booking, var(--src-other))');
    expect(one(res('r', ['A'], '2026-09-12', '2026-09-14', { status: 'cancelled' }))).toBe('var(--st-cancel)');
    expect(one(res('r', ['A'], TODAY, '2026-09-14'))).toBe('var(--src-due)');        // ar trebui să sosească azi
  });

  it('blocul îngust arată doar numele; cel înalt arată și detaliile, iar notițele la urmă', () => {
    const short = lay(line([res('r1', ['A'], '2026-09-12', '2026-09-13')]), 18).blocks[0];
    expect(short.tier).toBe(0);
    expect(short.nl).toBe(1);

    const tall = lay(line([res('r1', ['A'], '2026-09-12', '2026-09-15')]), 60).blocks[0];
    expect(tall.tier).toBe(3);
    const withNotes = lay(line([res('r1', ['A'], '2026-09-12', '2026-09-15', { notes: 'Sosire târzie' })]), 60).blocks[0];
    expect(withNotes.tier).toBe(4);
  });

  it('butonul rapid apare doar dacă are loc în bloc', () => {
    const sosire = (colw: number, rowh: number, checkOut = '2026-09-14') => lay(line([res('r1', ['A'], TODAY, checkOut)]), rowh, colw).blocks[0];
    expect(sosire(120, 60)).toMatchObject({ showQa: true, qa: { status: 'checked_in' } });
    expect(sosire(80, 60).showQa).toBe(false);                      // coloană prea îngustă
    expect(sosire(120, 18, '2026-09-11').showQa).toBe(false);       // o singură noapte: nu încape (tier 0)
  });

  it('alerta zilei ajunge pe bloc', () => {
    const b = lay(line([res('r1', ['A'], '2026-09-08', '2026-09-14')])).blocks[0];
    expect(b.alert?.level).toBe('warn');
    expect(b.qa?.status).toBe('checked_in');
  });
});

describe('punți între sejururi', () => {
  const same = (over = {}) => line([
    res('r1', ['B'], '2026-09-12', '2026-09-16'),
    res('r2', ['C'], '2026-09-13', '2026-09-15', over),
  ]);

  it('leagă două sejururi ale aceluiași oaspete pe camere alăturate', () => {
    const { bridges } = lay(same());
    expect(bridges).toHaveLength(1);
    expect(bridges[0]).toMatchObject({ key: 'r1>r2', left: 2 * COLW - 5, past: false });
    expect(bridges[0].height).toBeGreaterThan(0);
  });
  it('nu leagă oaspeți diferiți, rezervări anulate sau camere depărtate', () => {
    expect(lay(same({ guestId: 'g2' })).bridges).toHaveLength(0);
    expect(lay(same({ status: 'cancelled' })).bridges).toHaveLength(0);
    expect(lay(line([res('r1', ['A'], '2026-09-12', '2026-09-16'), res('r2', ['C'], '2026-09-13', '2026-09-15')])).bridges).toHaveLength(0);
  });
  it('nu leagă sejururi care abia se ating', () => {
    expect(lay(line([res('r1', ['B'], '2026-09-12', '2026-09-14'), res('r2', ['C'], '2026-09-14', '2026-09-16')])).bridges).toHaveLength(0);
  });
});
