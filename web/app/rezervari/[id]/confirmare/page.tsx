'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useData, useStore } from '@/lib/client/store';
import { fmtD } from '@/domain/dates';
import { confirmationText, mailtoLink, waLink } from '@/domain/confirmation';
import { guestById, guestName, roomLabel } from '@/domain/rules';
import ConfirmationSheet from '@/components/ConfirmationSheet';
import { IconPrint } from '@/components/Icons';
import { useGoToReservation } from '@/components/useGoToReservation';

export default function ConfirmationPage() {
  const { id } = useParams<{ id: string }>();
  const data = useData(), toast = useStore(s => s.toast), goTo = useGoToReservation();
  const r = data.reservations.find(x => x.id === id);
  if (!r) return (
    <section className="page on"><div className="topbar"><Link className="btn ghost" href="/rezervari">← Rezervări</Link></div>
      <div className="scroll"><div className="ph"><h2>Rezervarea nu există</h2><p>Poate a fost ștearsă; reîncarcă pagina.</p></div></div></section>
  );
  const g = guestById(data, r.guestId), text = confirmationText(data, r), wa = g?.phone ? waLink(g.phone, text) : null;
  const subject = `Confirmare rezervare ${roomLabel(data, r)}, ${fmtD(r.checkIn)} – ${fmtD(r.checkOut)}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); toast('Textul a fost copiat', 'ok'); }
    catch { toast('Nu am putut copia; selectează textul de jos', 'bad'); }
  };
  return (
    <section className="page on" id="page-confirmation">
      <div className="topbar no-print">
        <button className="btn ghost" onClick={() => goTo(r)}>← Rezervarea</button>
        <h1>Confirmare · {guestName(g)}</h1>
        <div className="spacer" />
        {wa && <a className="btn" href={wa} target="_blank" rel="noreferrer">WhatsApp</a>}
        {g?.email && <a className="btn" href={mailtoLink(g.email, subject, text)}>Email</a>}
        <button className="btn" onClick={copy}>Copiază textul</button>
        <button className="btn primary" onClick={() => window.print()}><IconPrint />Tipărește / PDF</button>
      </div>
      <div className="scroll">
        <ConfirmationSheet data={data} r={r} />
        <div className="card no-print" style={{ maxWidth: 820, margin: '14px auto 0' }}>
          <div className="ch">Textul pentru WhatsApp sau email</div>
          <textarea readOnly value={text} onFocus={e => e.currentTarget.select()}
            style={{ display: 'block', width: '100%', minHeight: 300, border: 0, padding: 16, background: 'transparent', resize: 'vertical', font: 'inherit', lineHeight: 1.5, outline: 0 }} />
        </div>
      </div>
    </section>
  );
}
