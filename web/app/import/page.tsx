'use client';
// Importul rezervărilor dintr-un tabel: întâi se verifică și se arată ce s-ar întâmpla, apoi se scrie.
import { useState } from 'react';
import Link from 'next/link';
import { sampleCsv, type ImportRow } from '@/domain/import';
import { fmtD, money, todayIso } from '@/domain/dates';
import { SRC } from '@/domain/labels';
import { api } from '@/lib/client/api';
import { useData, useStore } from '@/lib/client/store';

interface Report { rows: (ImportRow & { created?: boolean })[]; problem: string | null; ok: number; bad: number; created: number }

export default function ImportPage() {
  const data = useData(), toast = useStore(s => s.toast), reload = useStore(s => s.load), me = useStore(s => s.me);
  const [csv, setCsv] = useState(''), [rep, setRep] = useState<Report | null>(null), [busy, setBusy] = useState(false), [done, setDone] = useState(false);

  const send = async (dryRun: boolean) => {
    setBusy(true);
    try {
      const r = await api<Report>('/api/import/reservations', 'POST', { csv, dryRun });
      setRep(r);
      if (!dryRun) { setDone(true); await reload(); toast(`${r.created} ${r.created === 1 ? 'rezervare importată' : 'rezervări importate'}`, 'ok'); }
    } catch (e) { toast((e as Error).message, 'bad'); }
    finally { setBusy(false); }
  };
  const pick = async (f?: File) => { if (!f) return; setCsv(await f.text()); setRep(null); setDone(false); };
  const sample = () => {
    const room = data.rooms.find(r => r.active && !r.parentId)?.name ?? '101';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + sampleCsv(room, todayIso())], { type: 'text/csv;charset=utf-8' }));
    a.download = 'model-import-rezervari.csv'; a.click();
  };

  if (me?.role !== 'owner') return <section className="page on"><div className="topbar"><h1>Import</h1></div><div className="scroll"><div className="ph"><h2>Numai proprietarul poate importa</h2><Link className="btn" href="/rezervari">Înapoi</Link></div></div></section>;

  return (
    <section className="page on">
      <div className="topbar"><Link className="btn" href="/rezervari">‹ Rezervări</Link><h1 style={{ marginLeft: 10 }}>Importă rezervări</h1></div>
      <div className="scroll">
        <div className="card" style={{ padding: '16px 18px', marginBottom: 16 }}>
          <p style={{ margin: '0 0 10px', color: 'var(--ink-2)' }}>
            Pune rezervările din caiet sau din alt program într-un tabel Excel și salvează-l ca <b>CSV</b>. Coloane: <b>Oaspete, Camera, Sosire, Plecare</b> (obligatorii),
            apoi Telefon, Persoane, Total, Avans, Sursa, Observatii. Datele se scriu 14.08.2026. Mai multe camere la o rezervare: <code>101 + 102</code>.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
            <button className="btn" onClick={sample}>Descarcă modelul</button>
            <label className="btn" style={{ cursor: 'pointer' }}>Alege fișierul CSV<input type="file" accept=".csv,text/csv,text/plain" hidden onChange={e => pick(e.target.files?.[0])} /></label>
            <span style={{ color: 'var(--ink-3)' }}>sau lipește rândurile mai jos</span>
          </div>
          <div className="f"><textarea value={csv} onChange={e => { setCsv(e.target.value); setRep(null); setDone(false); }} placeholder="Oaspete;Camera;Sosire;Plecare;Total" style={{ minHeight: 140, fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 12.5 }} /></div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn primary" disabled={busy || !csv.trim()} onClick={() => send(true)}>Verifică</button>
            {rep && !rep.problem && !done && rep.ok > 0 && (
              <button className="btn ok" disabled={busy} onClick={() => { if (confirm(`Import ${rep.ok} ${rep.ok === 1 ? 'rezervare' : 'rezervări'}?${rep.bad ? `\n\n${rep.bad} rânduri cu probleme rămân pe dinafară.` : ''}`)) send(false); }}>
                Importă {rep.ok} {rep.ok === 1 ? 'rezervare' : 'rezervări'}
              </button>
            )}
            {rep && !rep.problem && <span style={{ color: 'var(--ink-2)' }}><b style={{ color: 'var(--ok)' }}>{done ? rep.created + ' importate' : rep.ok + ' bune'}</b>{rep.bad > 0 && <> · <b style={{ color: 'var(--bad)' }}>{rep.bad} cu probleme</b></>}</span>}
          </div>
          {rep?.problem && <div className="auth-err" style={{ marginTop: 12, marginBottom: 0 }}>{rep.problem}</div>}
        </div>

        {rep && rep.rows.length > 0 && (
          <div className="card tbl-wrap">
            <table className="t">
              <thead><tr><th>Rând</th><th>Oaspete</th><th>Cameră</th><th>Sosire</th><th>Plecare</th><th className="r">Pers.</th><th className="r">Total</th><th>Sursă</th><th>Ce se întâmplă</th></tr></thead>
              <tbody>
                {rep.rows.map(r => (
                  <tr key={r.line} style={{ cursor: 'default' }}>
                    <td data-l="Rând">{r.line}</td>
                    <td data-l="Oaspete"><b>{r.guest || '—'}</b>{!r.guestId && !r.errors.length && <span className="urole" style={{ marginLeft: 6 }}>nou</span>}</td>
                    <td data-l="Cameră">{r.rooms || '—'}</td>
                    <td data-l="Sosire">{r.checkIn ? fmtD(r.checkIn) : '—'}</td><td data-l="Plecare">{r.checkOut ? fmtD(r.checkOut) : '—'}</td>
                    <td data-l="Pers." className="r">{r.pax}</td><td data-l="Total" className="r">{money(r.total)}</td><td data-l="Sursă">{SRC[r.source]}</td>
                    <td data-l="Ce se întâmplă" style={{ whiteSpace: 'normal', color: r.errors.length ? 'var(--bad)' : 'var(--ok)', fontWeight: 600 }}>
                      {r.errors.length ? r.errors.join('; ') : r.created ? 'importată' : 'intră'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
