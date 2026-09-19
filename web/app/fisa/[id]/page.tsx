'use client';
// Fișa de cazare a unei rezervări, gata de tipărit și de semnat de oaspete.
import { use } from 'react';
import Link from 'next/link';
import { useData, useStore } from '@/lib/client/store';
import { fmtLong } from '@/domain/invoice';
import { missingForForm } from '@/domain/register';
import { guestById, nights, propById, roomById, roomLabel } from '@/domain/rules';

const Row = ({ l, v }: { l: string; v?: string | number | null }) => <div className="frow"><span>{l}</span><b>{v || ' '}</b></div>;

export default function StayFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const data = useData(), openGuest = useStore(s => s.openGuest);
  const r = data.reservations.find(x => x.id === id);
  if (!r) return <section className="page on"><div className="topbar"><h1>Fișă de cazare</h1></div><div className="scroll"><div className="ph"><h2>Rezervarea nu mai există</h2><Link className="btn" href="/rezervari">Înapoi la rezervări</Link></div></div></section>;

  const g = guestById(data, r.guestId), prop = propById(data, roomById(data, r.roomIds[0])?.propertyId ?? null);
  const missing = missingForForm(g);

  return (
    <section className="page on">
      <div className="topbar noprint">
        <Link className="btn" href="/rezervari">‹ Rezervări</Link><h1 style={{ marginLeft: 10 }}>Fișă de cazare</h1><div className="spacer" />
        {g && <button className="btn" onClick={() => openGuest(g.id)}>Completează datele oaspetelui</button>}
        <button className="btn primary" onClick={() => window.print()}>Tipărește</button>
      </div>
      <div className="scroll">
        {missing.length > 0 && <div className="auth-err noprint" style={{ maxWidth: 860, margin: '0 auto 12px' }}>Mai lipsesc: {missing.join(', ')}. Le poți completa acum sau le scrie oaspetele de mână pe fișa tipărită.</div>}
        <div className="invoice sheet">
          <header>
            <div><div className="big">{prop?.name ?? 'Pensiune'}</div><div>{prop?.city}</div></div>
            <div className="meta"><div className="title">Fișă de anunțare a sosirii<br />și plecării turiștilor</div></div>
          </header>
          <div className="fgrid">
            <Row l="Numele" v={g?.lastName} /><Row l="Prenumele" v={g?.firstName} />
            <Row l="Data nașterii" v={g?.birthDate ? fmtLong(g.birthDate) : ''} /><Row l="Locul nașterii" v={g?.birthPlace} />
            <Row l="Cetățenia" v={g?.citizenship} /><Row l="Țara" v={g?.country} />
          </div>
          <div className="fgrid one"><Row l="Domiciliul" v={g?.address} /></div>
          <div className="fgrid three"><Row l="Act de identitate" v={g?.idType} /><Row l="Seria" v={g?.idSeries} /><Row l="Numărul" v={g?.idNumber} /></div>
          <div className="fgrid three"><Row l="Data sosirii" v={fmtLong(r.checkIn)} /><Row l="Data plecării" v={fmtLong(r.checkOut)} /><Row l="Nopți" v={nights(r)} /></div>
          <div className="fgrid three"><Row l="Camera" v={roomLabel(data, r)} /><Row l="Persoane" v={r.pax} /><Row l="Scopul călătoriei" v="turism" /></div>
          <div className="fgrid"><Row l="Telefon" v={g?.phone} /><Row l="Email" v={g?.email} /></div>
          <p className="fnote">Declar că datele de mai sus sunt corecte. Datele sunt folosite numai pentru evidența cerută de lege a persoanelor cazate.</p>
          <div className="sign">
            <div><div className="lbl">Semnătura turistului</div><div className="line" /></div>
            <div><div className="lbl">Semnătura recepționerului</div><div className="line" /></div>
          </div>
        </div>
      </div>
    </section>
  );
}
