'use client';
// A list you can sort by clicking a column header (again to reverse). On a phone every row becomes a small card.
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';

export interface Col<T> {
  h: string;                                  // header text; also the label shown on phones
  cell: (r: T) => ReactNode;
  v?: (r: T) => string | number | null;        // sort value; omit for columns that do not sort
  r?: boolean;                                 // right-aligned (numbers)
  style?: CSSProperties;
}
interface Props<T> {
  cols: Col<T>[]; rows: T[]; keyOf: (r: T) => string;
  onRow?: (r: T) => void; rowClass?: (r: T) => string; empty?: string; foot?: ReactNode; initial?: { col: number; dir: 1 | -1 };
}

const cmp = (x: string | number | null, y: string | number | null) => {
  if (x == null && y == null) return 0; if (x == null) return -1; if (y == null) return 1;
  if (typeof x === 'number' && typeof y === 'number') return x - y;
  if (typeof x === 'number') return -1; if (typeof y === 'number') return 1;
  return x.localeCompare(y, 'ro');
};

export default function Table<T>({ cols, rows, keyOf, onRow, rowClass, empty, foot, initial }: Props<T>) {
  const [sort, setSort] = useState<{ col: number; dir: 1 | -1 } | null>(initial ?? null);
  const sorted = useMemo(() => {
    if (!sort || !cols[sort.col]?.v) return rows;
    const v = cols[sort.col].v!;
    return rows.map((r, i) => ({ r, i, k: v(r) })).sort((a, b) => sort.dir * cmp(a.k, b.k) || a.i - b.i).map(x => x.r);
  }, [rows, sort, cols]);
  const click = (i: number) => {
    const c = cols[i]; if (!c.v) return;
    if (sort && sort.col === i) { setSort({ col: i, dir: sort.dir === 1 ? -1 : 1 }); return; }
    const first = rows[0] ? c.v(rows[0]) : null;   // amounts and counts: biggest first
    setSort({ col: i, dir: typeof first === 'number' ? -1 : 1 });
  };
  return (
    <>
      <table className="t">
        <thead><tr>{cols.map((c, i) => (
          <th key={i} className={`${c.r ? 'r' : ''} ${sort?.col === i ? (sort.dir === 1 ? 's-asc' : 's-desc') : ''}`} onClick={() => click(i)} style={c.v ? undefined : { cursor: 'default' }}>{c.h}</th>
        ))}</tr></thead>
        <tbody>
          {sorted.map(r => (
            <tr key={keyOf(r)} onClick={onRow ? () => onRow(r) : undefined} className={rowClass?.(r)} style={onRow ? undefined : { cursor: 'default' }}>
              {cols.map((c, i) => <td key={i} data-l={c.h} className={c.r ? 'r' : ''} style={c.style}>{c.cell(r)}</td>)}
            </tr>
          ))}
        </tbody>
        {foot && <tfoot>{foot}</tfoot>}
      </table>
      {!rows.length && empty && <div className="empty">{empty}</div>}
    </>
  );
}
