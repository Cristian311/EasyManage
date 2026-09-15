'use client';
// The frame around every page: menu, the reservation drawer and windows, toasts. Pages appear once the data is loaded.
import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useStore } from '@/lib/client/store';
import Sidebar from './Sidebar';
import Drawer from './Drawer';
import ResModal from './ResModal';
import RoomModal from './RoomModal';
import ExpenseModal from './ExpenseModal';
import InvoiceModal from './InvoiceModal';
import Menu from './Menu';
import Toasts from './Toasts';

export default function AppShell({ children }: { children: ReactNode }) {
  const ready = useStore(s => !!s.data), loadError = useStore(s => s.loadError), load = useStore(s => s.load);
  const focus = useStore(s => s.focus), addMode = useStore(s => s.addMode);
  const menuOpen = useStore(s => s.menuOpen), setMenuOpen = useStore(s => s.setMenuOpen);
  // the calendar needs every pixel, so there the menu slides in over the page instead of holding a column
  const slideMenu = usePathname().startsWith('/calendar');
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!slideMenu) setMenuOpen(false); }, [slideMenu, setMenuOpen]);
  useEffect(() => {
    if (!menuOpen) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [menuOpen, setMenuOpen]);

  return (
    <>
      <div className={`app ${focus ? 'focus' : ''} ${addMode ? 'adding' : ''} ${slideMenu ? 'nomenu' : ''} ${slideMenu && menuOpen ? 'menuopen' : ''}`} id="app">
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
      {slideMenu && menuOpen && <div className="menu-back" onClick={() => setMenuOpen(false)} />}
      {ready && <><Drawer /><ResModal /><RoomModal /><ExpenseModal /><InvoiceModal /><Menu /></>}
      <Toasts />
    </>
  );
}
