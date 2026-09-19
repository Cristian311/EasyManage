'use client';
// The frame around every page: menu, the reservation drawer and windows, toasts. Pages appear once the data is loaded.
// Paginile de intrare (/intrare, /start) se arată fără ramă, pentru că atunci nu există încă date.
import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useStore } from '@/lib/client/store';
import Sidebar from './Sidebar';
import Drawer from './Drawer';
import ResModal from './ResModal';
import RoomModal from './RoomModal';
import ExpenseModal from './ExpenseModal';
import InvoiceModal from './InvoiceModal';
import GuestModal from './GuestModal';
import Menu from './Menu';
import Toasts from './Toasts';

const BARE = ['/intrare', '/start'];

export default function AppShell({ children }: { children: ReactNode }) {
  const ready = useStore(s => !!s.data), loadError = useStore(s => s.loadError), load = useStore(s => s.load);
  const auth = useStore(s => s.auth);
  const focus = useStore(s => s.focus), addMode = useStore(s => s.addMode);
  const menuOpen = useStore(s => s.menuOpen), setMenuOpen = useStore(s => s.setMenuOpen);
  const path = usePathname(), router = useRouter();
  const bare = BARE.includes(path);
  // the calendar needs every pixel, so there the menu slides in over the page instead of holding a column
  const slideMenu = path.startsWith('/calendar');

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const go = auth === 'login' ? '/intrare' : auth === 'setup' ? '/start' : auth === 'ok' && bare ? '/calendar' : null;
    if (go && go !== path) router.replace(go);
  }, [auth, bare, path, router]);
  useEffect(() => { if (!slideMenu) setMenuOpen(false); }, [slideMenu, setMenuOpen]);
  useEffect(() => {
    if (!menuOpen) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [menuOpen, setMenuOpen]);

  if (bare) return <><div className="auth-page">{children}</div><Toasts /></>;

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
      {ready && <><Drawer /><ResModal /><RoomModal /><ExpenseModal /><InvoiceModal /><GuestModal /><Menu /></>}
      <Toasts />
    </>
  );
}
