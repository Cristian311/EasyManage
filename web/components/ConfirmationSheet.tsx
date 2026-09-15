// The reservation confirmation on paper: the same white sheet as the invoice.
import type { AppState, Reservation } from '@/domain/types';
import { fmtDL, money, todayIso } from '@/domain/dates';
import { guestById, guestName, nights, paid, propById, remaining, roomById } from '@/domain/rules';

export default function ConfirmationSheet({ data, r }: { data: AppState; r: Reservation }) {
  const st = data.settings, g = guestById(data, r.guestId), n = nights(r), p = paid(r), rest = remaining(r);
  const prop = propById(data, roomById(data, r.roomIds[0])?.propertyId ?? null);
  return (
    <div className="sheet">
      {r.status === 'cancelled' && <div className="stamp">ANULATĂ</div>}
      <div className="top">
        <div className="party">
          <b>{st.name || prop?.name || '—'}</b>
          {st.address && <span>{st.address}</span>}
          {(st.phone || st.email) && <span>{[st.phone, st.email].filter(Boolean).join(' · ')}</span>}
        </div>
        <div className="meta">
          <h1>CONFIRMARE</h1>
          <span className="no">Rezervare</span>
          <span>Emisă: {fmtDL(todayIso())}</span>
        </div>
      </div>
      <div className="parties">
        <div className="party">
          <span className="lbl">Oaspete</span>
          <b>{guestName(g)}</b>
          {g?.phone && <span>{g.phone}</span>}
          {g?.email && <span>{g.email}</span>}
          <span>{r.pax} {r.pax === 1 ? 'persoană' : 'persoane'}</span>
        </div>
        <div className="party">
          <span className="lbl">Unde</span>
          <b>{prop?.name ?? '—'}</b>
          {prop?.city && <span>{prop.city}</span>}
          <span>Check-in de la {st.checkInTime} · check-out până la {st.checkOutTime}</span>
        </div>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Cameră</th><th>Tip</th><th>Sosire</th><th>Plecare</th><th className="r">Nopți</th></tr></thead>
          <tbody>
            {r.roomIds.map(id => { const rm = roomById(data, id); return (
              <tr key={id}><td><b>{rm?.name ?? '—'}</b></td><td>{rm?.type ?? ''}</td><td>{fmtDL(r.checkIn)}</td><td>{fmtDL(r.checkOut)}</td><td className="r">{n}</td></tr>
            ); })}
          </tbody>
        </table>
      </div>
      <div className="totals">
        <div><span>Total sejur</span><span>{money(r.total)}</span></div>
        {p > 0 && <div><span>Avans încasat</span><span>{money(p)}</span></div>}
        <div className="big"><span>{rest > 0 ? 'Rest de plată' : 'Achitat integral'}</span><span>{rest > 0 ? money(rest) : '✓'}</span></div>
      </div>
      {st.iban && <div className="foot" style={{ color: '#111', fontSize: 12.5 }}>Plata prin transfer: <b>{st.iban}</b>{st.bank ? `, ${st.bank}` : ''}</div>}
      {st.confirmText && <div className="foot" style={{ color: '#111', fontSize: 12.5, whiteSpace: 'pre-wrap' }}>{st.confirmText}</div>}
      <div className="foot"><span>Vă așteptăm cu drag!</span></div>
    </div>
  );
}
