'use client';
import { useSyncExternalStore } from 'react';

/** True while the CSS media query matches, e.g. useMedia('(max-width:720px)'). */
export function useMedia(query: string) {
  return useSyncExternalStore(
    cb => { const m = matchMedia(query); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb); },
    () => matchMedia(query).matches,
    () => false,
  );
}
