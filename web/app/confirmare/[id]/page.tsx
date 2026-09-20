'use client';
// Confirmarea rezervării, de tipărit sau de salvat ca PDF și trimis oaspetelui.
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useData, useStore } from '@/lib/client/store';
import { api } from '@/lib/client/api';
import { fmtLong, lei2 } from '@/domain/invoice';
import { fillTemplate, langFor, mailLink, messageVars, waLink, type Lang } from '@/domain/message';
import { guestById, guestName, nights, paid, propById, remaining, roomById, roomLabel } from '@/domain/rules';
import type { Contact } from '@/lib/settings';
import { IconPrint } from '@/components/Icons';

const Row = ({ l, v }: { l: string; v?: string | number | null }) => <div className="frow"><span>{l}</span><b>{v || ' '}</b></div>;

/** Aceleași rubrici, în două limbi; oaspetele străin primește foaia pe care o înțelege. */
const RO = {
  title: 'Confirmare de rezervare', subject: 'Confirmare rezervare', guest: 'Oaspete', phone: 'Telefon', email: 'Email',
  arrival: 'Sosire', departure: 'Plecare', nights: 'Nopți', from: 'de la', until: 'până la', room: 'Cameră', rooms: 'Camere',
  people: 'Persoane', where: 'Unde', total: 'Total', deposit: 'Avans primit', balance: 'Rest de plată la sosire', toPay: 'De plată',
  paid: 'achitat integral', transfer: 'Plata prin transfer', notes: 'Observații', house: 'Pensiune',
  foot: 'Vă așteptăm cu drag! Dacă planurile se schimbă, anunțați-ne din timp.', reach: 'Ne găsiți la',
  cancelled: 'Rezervarea este anulată. Confirmarea de mai jos nu mai e valabilă.',
};
const EN = {
  title: 'Booking confirmation', subject: 'Booking confirmation', guest: 'Guest', phone: 'Phone', email: 'Email',
  arrival: 'Arrival', departure: 'Departure', nights: 'Nights', from: 'from', until: 'until', room: 'Room', rooms: 'Rooms',
  people: 'Guests', where: 'Where', total: 'Total', deposit: 'Deposit received', balance: 'Balance due on arrival', toPay: 'To pay',
  paid: 'paid in full', transfer: 'Bank transfer', notes: 'Notes', house: 'Guesthouse',
  foot: 'We look forward to welcoming you! If your plans change, please let us know in advance.', reach: 'You can reach us at',
  cancelled: 'This booking was cancelled. The confirmation below is no longer valid.',
};

export default function ConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const data = useData(), toast = useStore(s => s.toast), loadMsg = useStore(s => s.loadMsg);
  const [c, setC] = useState<Contact | null>(null), [lang, setLang] = useState<Lang | null>(null);
  useEffect(() => { api<{ contact: Contact }>('/api/contact').then(x => setC(x.contact)).catch(e => toast((e as Error).message, 'bad')); }, [toast]);
  const r = data.reservations.find(x => x.id === id);
  if (!r) return <section className="page on"><div className="topbar"><h1>Confirmare</h1></div><div className="scroll"><div className="ph"><h2>Rezervarea nu mai există</h2><Link className="btn" href="/rezervari">Înapoi la rezervări</Link></div></div></section>;

  const g = guestById(data, r.guestId), prop = propById(data, roomById(data, r.roomIds[0])?.propertyId ?? null);
  const n = nights(r), p = paid(r), rest = remaining(r);
  // oaspeții din afara țării primesc foaia în engleză; se poate schimba din butoane
  const L = lang ?? langFor(g?.country);
  const t = L === 'en' ? EN : RO;

  /** Același text ca la „Confirmă pe WhatsApp”, ca oaspetele să primească la fel, oricum i-ai trimite. */
  const send = async (how: 'wa' | 'mail') => {
    const m = await loadMsg(); if (!m || !g) return;
    const text = fillTemplate(L === 'en' ? m.templateEn : m.template, messageVars(data, r, m.sender, L));
    const url = how === 'wa' ? waLink(g.phone, text) : mailLink(g.email, `${t.subject} ${fmtLong(r.checkIn)}`, text);
    if (!url) { toast(how === 'wa' ? 'Oaspetele nu are un număr de telefon valid' : 'Oaspetele nu are o adresă de email validă', 'bad'); return; }
    window.open(url, '_blank', 'noopener');
  };

  return (
    <section className="page on">
      <div className="topbar noprint">
        <Link className="btn" href="/rezervari">‹ Rezervări</Link><h1 style={{ marginLeft: 10 }}>Confirmare</h1><div className="spacer" />
        {g?.phone && <button className="btn" onClick={() => send('wa')}>Trimite pe WhatsApp</button>}
        {g?.email && <button className="btn" onClick={() => send('mail')}>Trimite pe email</button>}
        <div className="seg" title="Limba foii">
          <button className={L === 'ro' ? 'on' : ''} onClick={() => setLang('ro')}>RO</button>
          <button className={L === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
        </div>
        <button className="btn primary" onClick={() => window.print()}><IconPrint />Tipărește / PDF</button>
      </div>
      <div className="scroll">
        {r.status === 'cancelled' && <div className="auth-err noprint" style={{ maxWidth: 860, margin: '0 auto 12px' }}>{t.cancelled}</div>}
        <div className="invoice sheet">
          <header>
            <div>
              <div className="big">{c?.name || prop?.name || t.house}</div>
              {c?.address && <div>{c.address}</div>}
              {(c?.phone || c?.email) && <div>{[c?.phone, c?.email].filter(Boolean).join(' · ')}</div>}
            </div>
            <div className="meta"><div className="title">{t.title}</div><div className="no">{fmtLong(r.checkIn)}</div></div>
          </header>

          <div className="fgrid one"><Row l={t.guest} v={guestName(g)} /></div>
          <div className="fgrid"><Row l={t.phone} v={g?.phone} /><Row l={t.email} v={g?.email} /></div>
          <div className="fgrid three">
            <Row l={t.arrival} v={`${fmtLong(r.checkIn)}, ${t.from} ${c?.checkIn ?? '14:00'}`} />
            <Row l={t.departure} v={`${fmtLong(r.checkOut)}, ${t.until} ${c?.checkOut ?? '12:00'}`} />
            <Row l={t.nights} v={n} />
          </div>
          <div className="fgrid three">
            <Row l={r.roomIds.length > 1 ? t.rooms : t.room} v={roomLabel(data, r)} />
            <Row l={t.people} v={r.pax} />
            <Row l={t.where} v={[prop?.name, prop?.city].filter(Boolean).join(', ')} />
          </div>
          <div className="fgrid three">
            <Row l={t.total} v={lei2(Number(r.total))} />
            <Row l={t.deposit} v={p > 0 ? lei2(p) : '—'} />
            <Row l={rest > 0 ? t.balance : t.toPay} v={rest > 0 ? lei2(rest) : t.paid} />
          </div>
          {rest > 0 && c?.iban && <div className="fgrid one"><Row l={t.transfer} v={`${c.iban}${c.bank ? `, ${c.bank}` : ''}`} /></div>}
          {r.notes && <div className="fgrid one"><Row l={t.notes} v={r.notes} /></div>}

          <p className="fnote">
            {t.foot}{c?.phone ? ` ${t.reach} ${c.phone}.` : ''}
          </p>
        </div>
      </div>
    </section>
  );
}
