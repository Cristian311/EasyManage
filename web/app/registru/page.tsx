'use client';
// Registrul turiștilor pe o perioadă: toate sosirile, cu actul și camera, de tipărit sau de dus în Excel.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useData } from '@/lib/client/store';
import { fmtD, todayIso } from '@/domain/dates';
import { fmtLong } from '@/domain/invoice';
import { registerRows } from '@/domain/register';
import { downloadCsv } from '@/lib/client/csv';

export default function RegisterPage() {
  const data = useData(), T = todayIso();
  const [from, setFrom] = useState(T.slice(0, 8) + '01'), [to, setTo] = useState(T);
  const rows = useMemo(() => registerRows(data, from, to), [data, from, to]);
  const noDoc = rows.filter(r => !r.doc).length;

  const excel = () => downloadCsv(`registru-turisti_${from}_${to}`, rows, [
    ['Nr.', r => r.no], ['Nume și prenume', r => r.name], ['Act de identitate', r => r.doc], ['Cetățenia', r => r.citizenship],
    ['Domiciliul', r => r.address], ['Sosire', r => r.checkIn], ['Plecare', r => r.checkOut], ['Nopți', r => r.nights], ['Camera', r => r.rooms], ['Persoane', r => r.pax],
  ]);

  return (
    <section className="page on">
      <div className="topbar noprint">
        <Link className="btn" href="/rezervari">‹ Rezervări</Link><h1 style={{ marginLeft: 10 }}>Registrul turiștilor</h1><div className="spacer" />
        <div className="f" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 150 }} /><span>–</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: 150 }} />
        </div>
        <button className="btn" onClick={excel} disabled={!rows.length}>Descarcă Excel</button>
        <button className="btn primary" onClick={() => window.print()} disabled={!rows.length}>Tipărește</button>
      </div>
      <div className="scroll">
        {noDoc > 0 && <div className="auth-err noprint" style={{ maxWidth: 1100, margin: '0 auto 12px' }}>{noDoc} {noDoc === 1 ? 'oaspete nu are' : 'oaspeți nu au'} actul trecut. Apasă pe nume ca să deschizi fișa și să completezi.</div>}
        <div className="invoice sheet wide">
          <header><div><div className="big">Registrul turiștilor</div><div>{fmtLong(from)} – {fmtLong(to)} · {rows.length} {rows.length === 1 ? 'sosire' : 'sosiri'}</div></div></header>
          <table className="inv-t" style={{ marginTop: 14 }}>
            <thead><tr><th className="n">#</th><th>Nume și prenume</th><th>Act</th><th>Cetățenia</th><th>Sosire</th><th>Plecare</th><th className="r">Nopți</th><th>Camera</th><th className="r">Pers.</th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.reservationId}>
                  <td className="n">{r.no}</td><td><Link href={`/fisa/${r.reservationId}`}>{r.name}</Link></td><td>{r.doc || '—'}</td><td>{r.citizenship || '—'}</td>
                  <td>{fmtD(r.checkIn)}</td><td>{fmtD(r.checkOut)}</td><td className="r">{r.nights}</td><td>{r.rooms}</td><td className="r">{r.pax}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--ink-3)', padding: 24 }}>Nicio sosire în perioada aleasă</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
