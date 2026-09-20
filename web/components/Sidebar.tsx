'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { useStore } from '@/lib/client/store';
import { todayIso } from '@/domain/dates';
import { ROLE, initials } from '@/domain/labels';
import { isActiveRes, propById } from '@/domain/rules';
import { IconCalendar, IconChart, IconClean, IconFinance, IconGuests, IconInvoice, IconList, IconMoon, IconRates, IconRooms, IconSearch, IconSettings, IconToday } from './Icons';

const NAV = [
  { href: '/azi', label: 'Azi', Icon: IconToday, badge: true },
  { href: '/calendar', label: 'Calendar', Icon: IconCalendar },
  { href: '/rezervari', label: 'Rezervări', Icon: IconList },
  { href: '/libere', label: 'Camere libere', Icon: IconSearch },
  { href: '/oaspeti', label: 'Oaspeți', Icon: IconGuests },
  { href: '/curatenie', label: 'Curățenie', Icon: IconClean },
  { sec: 'Administrare' },
  { href: '/camere', label: 'Camere', Icon: IconRooms },
  { href: '/tarife', label: 'Tarife', Icon: IconRates },
  { href: '/financiar', label: 'Financiar', Icon: IconFinance, owner: true },
  { href: '/ocupare', label: 'Ocupare', Icon: IconChart, owner: true },
  { href: '/facturi', label: 'Facturi', Icon: IconInvoice, owner: true },
  { href: '/setari', label: 'Setări', Icon: IconSettings, owner: true },
] as const;

export default function Sidebar() {
  const path = usePathname();
  const data = useStore(s => s.data), view = useStore(s => s.view), setMenuOpen = useStore(s => s.setMenuOpen);
  const me = useStore(s => s.me), logout = useStore(s => s.logout);
  const badge = useMemo(() => {
    if (!data) return 0; const t = todayIso();
    return data.reservations.filter(r => isActiveRes(r) && r.status !== 'checked_out' && (r.checkIn === t || r.checkOut === t)).length;
  }, [data]);
  const sub = data ? (propById(data, view.prop)?.name ?? data.properties[0]?.name ?? '') : '';
  const toggleTheme = () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('velora-theme', next); } catch {}
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="mark">V</div>
        <div><div className="name">Velora Stay</div><div className="sub">{sub}</div></div>
      </div>
      <nav className="nav">
        {NAV.map((n, i) => 'sec' in n ? <div className="sec" key={i}>{n.sec}</div> : (
          'owner' in n && me?.role !== 'owner' ? null : (
            <Link key={n.href} href={n.href} onClick={() => setMenuOpen(false)} className={`nav-item ${path.startsWith(n.href) ? 'active' : ''} ${'soon' in n ? 'soonwrap' : ''}`}>
              <n.Icon /><span>{n.label}</span>
              {'badge' in n && badge > 0 && <span className="badge">{badge}</span>}
              {'soon' in n && <span className="soon">curând</span>}
            </Link>
          )
        ))}
      </nav>
      <div className="side-foot">
        <button className="nav-item" onClick={toggleTheme}><IconMoon /><span>Temă</span></button>
        <button className="user" onClick={() => { if (confirm('Ieși din cont?')) logout(); }} title="Ieși din cont">
          <div className="av">{initials(me?.name ?? '')}</div>
          <div><div className="u1">{me?.name ?? '—'}</div><div className="u2">{me ? ROLE[me.role] : 'Ieși'}</div></div>
        </button>
      </div>
    </aside>
  );
}
