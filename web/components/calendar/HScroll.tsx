'use client';
// The room scrollbar above the chart: a wide pill that mirrors the chart's own horizontal scroll, lined up with the
// room columns. Drag the thumb, click the track to move about a screen of rooms, or turn the wheel over it.
// The thumb is moved straight on the element, so scrolling never re-renders the chart.
import { useEffect, useRef, type PointerEvent as RPointerEvent, type RefObject, type WheelEvent as RWheelEvent } from 'react';

export default function HScroll({ target, inset }: { target: RefObject<HTMLDivElement | null>; inset: number }) {
  const track = useRef<HTMLDivElement>(null), thumb = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = target.current, tr = track.current, th = thumb.current; if (!el || !tr || !th) return;
    // sizes are measured only when something resizes; a scroll just slides the thumb, without asking for layout
    let max = 0, span = 0;
    const place = () => { if (max > 1) th.style.transform = `translateX(${span * el.scrollLeft / max}px)`; };
    const measure = () => {
      max = el.scrollWidth - el.clientWidth; const on = max > 1;
      if (tr.hidden === on) tr.hidden = !on;   // every room fits: no bar
      if (!on) return;
      const w = tr.clientWidth, tw = Math.max(44, w * el.clientWidth / el.scrollWidth);
      th.style.width = tw + 'px'; span = w - tw; place();
    };
    measure();
    el.addEventListener('scroll', place, { passive: true });
    // the chart's width follows the window, the rooms' width follows the zoom and the room list
    const ro = new ResizeObserver(measure); ro.observe(el); ro.observe(tr);
    const head = el.querySelector('.rhead'); if (head) ro.observe(head);
    return () => { el.removeEventListener('scroll', place); ro.disconnect(); };
  }, [target]);

  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    const el = target.current, tr = track.current, th = thumb.current; if (!el || !tr || !th || e.button !== 0) return;
    e.preventDefault();
    if (!th.contains(e.target as Node)) {
      const r = th.getBoundingClientRect();
      el.scrollBy({ left: (e.clientX < r.left ? -1 : 1) * (el.clientWidth - inset) * 0.9, behavior: 'smooth' });
      return;
    }
    const x0 = e.clientX, s0 = el.scrollLeft, k = (el.scrollWidth - el.clientWidth) / Math.max(1, tr.clientWidth - th.offsetWidth);
    th.setPointerCapture(e.pointerId); tr.classList.add('drag');
    const move = (ev: PointerEvent) => { el.scrollLeft = s0 + (ev.clientX - x0) * k; };
    const up = () => {
      th.removeEventListener('pointermove', move); th.removeEventListener('pointerup', up); th.removeEventListener('pointercancel', up);
      tr.classList.remove('drag');
    };
    th.addEventListener('pointermove', move); th.addEventListener('pointerup', up); th.addEventListener('pointercancel', up);
  };
  const onWheel = (e: RWheelEvent<HTMLDivElement>) => {
    const el = target.current; if (!el) return;
    el.scrollLeft += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  };

  // a mirror of the chart's native bar, so screen readers get that one and this stays out of their way
  return (
    <div className="hscroll" ref={track} style={{ marginLeft: inset }} onPointerDown={onDown} onWheel={onWheel} aria-hidden="true">
      <div className="hs-thumb" ref={thumb} />
    </div>
  );
}
