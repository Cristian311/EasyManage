'use client';
// The frame around every page: menu, the reservation drawer and window, toasts. Pages appear once the data is loaded.
import { useEffect, type ReactNode } from 'react';
import { useStore } from '@/lib/client/store';
import Sidebar from './Sidebar';
import Drawer from './Drawer';
import ResModal from './ResModal';
import Toasts from './Toasts';

export default function AppShell({ children }: { children: ReactNode }) {
  const ready = useStore(s => !!s.data), loadError = useStore(s => s.loadError), load = useStore(s => s.load);
  const focus = useStore(s => s.focus), collapsed = useStore(s => s.collapsed);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className={`app ${focus ? 'focus' : ''} ${collapsed ? 'collapsed' : ''}`} id="app">
        <Sidebar />
        <div className="main">
          {ready ? children : (
            <div className="scroll" style={{ display: 'grid', placeItems: 'center' }}>
              {loadError
                ? <div className="ph"><h2>Nu am putut încărca datele</h2><p>{loadError}</p><button className="btn primary" onClick={() => load()}>Încearcă din nou</button></div>
                : <div style={{ color: 'var(--ink-3)', fontWeight: 700 }}>Se încarcă rezervările…</div>}
            </div>
          )}
        </div>
      </div>
      {ready && <><Drawer /><ResModal /></>}
      <Toasts />
    </>
  );
}
