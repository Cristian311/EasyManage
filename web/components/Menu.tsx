'use client';
// The small menu that pops up at the pointer: actions on a block, on a room header, or the list behind a chip.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/client/store';

export default function Menu() {
  const m = useStore(s => s.menu), close = useStore(s => s.closeMenu);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (!m || !ref.current) { setPos(null); return; }
    const w = ref.current.offsetWidth, h = ref.current.offsetHeight;
    setPos({ left: Math.max(4, Math.min(m.x, window.innerWidth - w - 10)), top: Math.max(4, Math.min(m.y, window.innerHeight - h - 10)) });
  }, [m]);
  useEffect(() => {
    if (!m) return;
    const down = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('pointerdown', down, true); window.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', down, true); window.removeEventListener('keydown', key); };
  }, [m, close]);
  if (!m) return null;
  return (
    <div className="ctx" ref={ref} style={{ display: 'block', minWidth: m.minWidth ?? 190, left: pos?.left ?? m.x, top: pos?.top ?? m.y, visibility: pos ? 'visible' : 'hidden' }} role="menu">
      {m.title && <div className="lh">{m.title}</div>}
      {m.items.length ? m.items.map((it, i) => it.hr ? <hr key={i} /> : (
        <button key={i} className={it.dng ? 'dng' : ''} disabled={it.disabled} onClick={() => { close(); it.go?.(); }}>
          {it.room !== undefined ? <><span className="rm">{it.room}</span><span className="lb">{it.t}{it.s && <small>{it.s}</small>}</span></> : <>{it.t}{it.s && <small>{it.s}</small>}</>}
        </button>
      )) : <div className="empty" style={{ padding: 10 }}>Nimic azi</div>}
    </div>
  );
}
