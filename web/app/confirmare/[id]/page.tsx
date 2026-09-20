'use client';
// Confirmarea rezervării, de tipărit sau de salvat ca PDF și trimis oaspetelui.
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useData, useStore } from '@/lib/client/store';
import { api } from '@/lib/client/api';
import { fmtLong, lei2 } from '@/domain/invoice';
import { fillTemplate, mailLink, messageVars, waLink } from '@/domain/message';
import { guestById, guestName, nights, paid, propById, remaining, roomById, roomLabel } from '@/domain/rules';
import type { Contact } from '@/lib/settings';
import { IconPrint } from '@/components/Icons';

const Row = ({ l, v }: { l: string; v?: string | number | null }) => <div className="frow"><span>{l}</span><b>{v || ' '}</b></div>;

export default function ConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const data = useData(), toast = useStore(s => s.toast), loadMsg = useStore(s => s.loadMsg);
  const [c, setC] = useState<Contact | null>(null);
  useEffect(() => { api<{ contact: Contact }>('/api/contact').then(x => setC(x.contact)).catch(e => toast((e as Error).message, 'bad')); }, [toast]);
  const r = data.reservations.find(x => x.id === id);
  if (!r) return <section className="page on"><div className="topbar"><h1>Confirmare</h1></div><div className="scroll"><div className="ph"><h2>Rezervarea nu mai există</h2><Link className="btn" href="/rezervari">Înapoi la rezervări</Link></div></div></section>;

  const g = guestById(data, r.guestId), prop = propById(data, roomById(data, r.roomIds[0])?.propertyId ?? null);
  const n = nights(r), p = paid(r), rest = remaining(r);

  /** Același text ca la „Confirmă pe WhatsApp”, ca oaspetele să primească la fel, oricum i-ai trimite. */
  const send = async (how: 'wa' | 'mail') => {
    const m = await loadMsg(); if (!m || !g) return;
    const text = fillTemplate(m.template, messageVars(data, r, m.sender));
    const url = how === 'wa' ? waLink(g.phone, text) : mailLink(g.email, `Confirmare rezervare ${fmtLong(r.checkIn)}`, text);
    if (!url) { toast(how === 'wa' ? 'Oaspetele nu are un număr de telefon valid' : 'Oaspetele nu are o adresă de email validă', 'bad'); return; }
    window.open(url, '_blank', 'noopener');
  };

  return (
    <section className="page on">
      <div className="topbar noprint">
        <Link className="btn" href="/rezervari">‹ Rezervări</Link><h1 style={{ marginLeft: 10 }}>Confirmare</h1><div className="spacer" />
        {g?.phone && <button className="btn" onClick={() => send('wa')}>Trimite pe WhatsApp</button>}
        {g?.email && <button className="btn" onClick={() => send('mail')}>Trimite pe email</button>}
        <button className="btn primary" onClick={() => window.print()}><IconPrint />Tipărește / PDF</button>
      </div>
      <div className="scroll">
        {r.status === 'cancelled' && <div className="auth-err noprint" style={{ maxWidth: 860, margin: '0 auto 12px' }}>Rezervarea este anulată. Confirmarea de mai jos nu mai e valabilă.</div>}
        <div className="invoice sheet">
          <header>
            <div>
              <div className="big">{c?.name || prop?.name || 'Pensiune'}</div>
              {c?.address && <div>{c.address}</div>}
              {(c?.phone || c?.email) && <div>{[c?.phone, c?.email].filter(Boolean).join(' · ')}</div>}
            </div>
            <div className="meta"><div className="title">Confirmare de rezervare</div><div className="no">{fmtLong(r.checkIn)}</div></div>
          </header>

          <div className="fgrid one"><Row l="Oaspete" v={guestName(g)} /></div>
          <div className="fgrid"><Row l="Telefon" v={g?.phone} /><Row l="Email" v={g?.email} /></div>
          <div className="fgrid three">
            <Row l="Sosire" v={`${fmtLong(r.checkIn)}, de la ${c?.checkIn ?? '14:00'}`} />
            <Row l="Plecare" v={`${fmtLong(r.checkOut)}, până la ${c?.checkOut ?? '12:00'}`} />
            <Row l="Nopți" v={n} />
          </div>
          <div className="fgrid three">
            <Row l={r.roomIds.length > 1 ? 'Camere' : 'Cameră'} v={roomLabel(data, r)} />
            <Row l="Persoane" v={r.pax} />
            <Row l="Unde" v={[prop?.name, prop?.city].filter(Boolean).join(', ')} />
          </div>
          <div className="fgrid three">
            <Row l="Total" v={lei2(Number(r.total))} />
            <Row l="Avans primit" v={p > 0 ? lei2(p) : '—'} />
            <Row l={rest > 0 ? 'Rest de plată la sosire' : 'De plată'} v={rest > 0 ? lei2(rest) : 'achitat integral'} />
          </div>
          {rest > 0 && c?.iban && <div className="fgrid one"><Row l="Plata prin transfer" v={`${c.iban}${c.bank ? `, ${c.bank}` : ''}`} /></div>}
          {r.notes && <div className="fgrid one"><Row l="Observații" v={r.notes} /></div>}

          <p className="fnote">
            Vă așteptăm cu drag! Dacă planurile se schimbă, anunțați-ne din timp.
            {c?.phone ? ` Ne găsiți la ${c.phone}.` : ''}
          </p>
        </div>
      </div>
    </section>
  );
}
