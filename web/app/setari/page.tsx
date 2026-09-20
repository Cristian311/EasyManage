'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { AppState, Me, Role, Source } from '@/domain/types';
import type { Company } from '@/domain/invoice';
import { ROLE, SRC } from '@/domain/labels';
import { api } from '@/lib/client/api';
import { useStore } from '@/lib/client/store';
import Table from '@/components/Table';
import { DEFAULT_TEMPLATE, PLACEHOLDERS, fillTemplate, messageVars } from '@/domain/message';
import { useData } from '@/lib/client/store';

type U = Me & { active: boolean };

export default function SettingsPage() {
  const admin = useStore(s => s.admin);
  const reset = useStore(s => s.resetDemo),toast = useStore(s => s.toast), me = useStore(s => s.me);
  const [users, setUsers] = useState<U[]>([]);
  const [open, setOpen] = useState(false);

  /** Orice schimbare pe conturi întoarce lista completă, deci nu mai trebuie reîncărcată separat. */
  const send = useCallback(async (url: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', body?: unknown, okMsg?: string) => {
    try {
      setUsers((await api<{ users: U[] }>(url, method, body)).users);
      if (okMsg) toast(okMsg, 'ok');
      return true;
    } catch (e) { toast((e as Error).message, 'bad'); return false; }
  }, [toast]);
  useEffect(() => { send('/api/users', 'GET'); }, [send]);

  const newPassword = async (u: U) => {
    const pw = prompt(`Parolă nouă pentru ${u.name}:`);
    if (pw === null) return;
    if (await send(`/api/users/${u.id}`, 'PATCH', { password: pw }, `Parolă schimbată pentru ${u.name}`))
      toast(u.id === me?.id ? 'Ai rămas intrat aici, dar ai ieșit de pe celelalte dispozitive' : `Spune-i lui ${u.name} parola nouă`);
  };

  return (
    <section className="page on">
      <div className="topbar"><h1>Setări</h1><div className="spacer" /><Link className="btn" href="/jurnal">Jurnal: cine a făcut ce</Link><button className="btn primary" onClick={() => setOpen(true)}>Cont nou</button></div>
      <div className="scroll">
        <div className="card tbl-wrap" style={{ marginBottom: 16 }}>
          <div className="ch">Conturi<span className="cnt">{users.length}</span></div>
          <Table rows={users} keyOf={u => u.id} empty="Niciun cont" cols={[
            { h: 'Nume', v: u => u.name, cell: u => <><b>{u.name}</b>{u.id === me?.id && <span className="urole" style={{ marginLeft: 8 }}>tu</span>}</> },
            { h: 'Email', v: u => u.email, cell: u => u.email },
            { h: 'Rol', v: u => ROLE[u.role], cell: u => <span className={`urole ${u.role}`}>{ROLE[u.role]}</span> },
            { h: 'Stare', v: u => (u.active ? 1 : 0), cell: u => (u.active ? 'Activ' : 'Oprit') },
            {
              h: '', r: true, style: { whiteSpace: 'nowrap' }, cell: u => (
                <>
                  <button className="btn sm" onClick={() => newPassword(u)}>Parolă nouă</button>{' '}
                  {u.id !== me?.id && <>
                    <button className="btn sm" onClick={() => send(`/api/users/${u.id}`, 'PATCH', { role: u.role === 'owner' ? 'reception' : 'owner' }, 'Rol schimbat')}>
                      Fă {u.role === 'owner' ? 'recepție' : 'proprietar'}
                    </button>{' '}
                    <button className="btn sm" onClick={() => send(`/api/users/${u.id}`, 'PATCH', { active: !u.active }, u.active ? 'Cont oprit' : 'Cont pornit')}>
                      {u.active ? 'Oprește' : 'Pornește'}
                    </button>{' '}
                    <button className="btn sm danger" onClick={() => { if (confirm(`Ștergi contul lui ${u.name}?`)) send(`/api/users/${u.id}`, 'DELETE', undefined, 'Cont șters'); }}>Șterge</button>
                  </>}
                </>
              ),
            },
          ]} />
        </div>

        <CompanyForm />
        <IcalCard />
        <TemplateCard />
        <BackupCard />

        <div className="ph">
          <h2>Încep cu datele mele</h2>
          <p>Șterge rezervările, oaspeții, prețurile speciale și cheltuielile de probă. Vilele, etajele, camerele, conturile și facturile rămân. Înainte se face o copie de siguranță.</p>
          <button className="btn primary" onClick={() => { if (confirm('Șterg toate rezervările, oaspeții și cheltuielile și păstrez camerele?\n\nFă asta o singură dată, când treci de la datele de probă la cele adevărate.')) admin('POST', '/api/demo/clean', undefined, 'Gata: camerele au rămas, restul e gol'); }}>Șterge datele de probă, păstrează camerele</button>
        </div>

        <div className="ph">
          <h2>De la început</h2>
          <p>Șterge toate rezervările, oaspeții și camerele și le pune pe cele demo la loc. Conturile și facturile rămân.</p>
          <button className="btn" onClick={() => { if (confirm('Șterg toate rezervările și încarc din nou vilele demo?\n\nConturile rămân.')) reset(); }}>Resetează datele demo</button>
        </div>
      </div>
      {open && <NewUser onClose={() => setOpen(false)} onSave={b => send('/api/users', 'POST', b, 'Cont creat')} />}
    </section>
  );
}

function NewUser({ onClose, onSave }: { onClose: () => void; onSave: (b: unknown) => Promise<boolean> }) {
  const [name, setName] = useState(''), [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('reception'), [busy, setBusy] = useState(false);
  const submit = async () => { setBusy(true); if (await onSave({ name, email, password, role })) onClose(); else setBusy(false); };

  return (
    <div className="overlay open" onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal sm" role="dialog">
        <div className="hd"><h2>Cont nou</h2></div>
        <div className="bd">
          <div className="f"><label>Nume</label><input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="ex: Ana Rusu" /></div>
          <div className="f"><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nume@exemplu.ro" /></div>
          <div className="f"><label>Parolă</label><input value={password} onChange={e => setPassword(e.target.value)} /><div className="hint">Cel puțin 8 caractere. Spune-i-o omului; o poate schimba oricând de aici.</div></div>
          <div className="f"><label>Rol</label>
            <select value={role} onChange={e => setRole(e.target.value as Role)}>
              <option value="reception">Recepție — calendar, rezervări, oaspeți, camere, tarife</option>
              <option value="owner">Proprietar — tot, inclusiv Financiar și Setări</option>
            </select>
          </div>
        </div>
        <div className="ft"><button className="btn" onClick={onClose}>Renunță</button><button className="btn primary" onClick={submit} disabled={busy}>Creează</button></div>
      </div>
    </div>
  );
}

/** Datele care apar pe factură. Se completează o singură dată, la început. */
function CompanyForm() {
  const toast = useStore(s => s.toast);
  const [c, setC] = useState<Company | null>(null), [busy, setBusy] = useState(false);
  useEffect(() => { api<{ company: Company }>('/api/settings').then(r => setC(r.company)).catch(e => toast((e as Error).message, 'bad')); }, [toast]);
  const set = (p: Partial<Company>) => setC(x => (x ? { ...x, ...p } : x));

  const save = async () => {
    if (!c) return;
    setBusy(true);
    try { setC((await api<{ company: Company }>('/api/settings', 'PUT', c)).company); toast('Datele pensiunii au fost salvate', 'ok'); }
    catch (e) { toast((e as Error).message, 'bad'); }
    finally { setBusy(false); }
  };

  if (!c) return null;
  return (
    <div className="card" style={{ marginBottom: 16, padding: '14px 16px 18px' }}>
      <div className="ch" style={{ padding: '0 0 12px', marginBottom: 12 }}>Datele pensiunii, așa cum apar pe factură</div>
      <div className="g2">
        <div className="f"><label>Nume firmă sau pensiune</label><input value={c.name} onChange={e => set({ name: e.target.value })} placeholder="ex: Vila Duduleanu SRL" /></div>
        <div className="f"><label>CUI</label><input value={c.taxId} onChange={e => set({ taxId: e.target.value })} placeholder="ex: RO12345678" /></div>
      </div>
      <div className="g2">
        <div className="f"><label>Nr. Registrul Comerțului</label><input value={c.regNo} onChange={e => set({ regNo: e.target.value })} placeholder="ex: J38/123/2019" /></div>
        <div className="f"><label>Adresă (sediul)</label><input value={c.address} onChange={e => set({ address: e.target.value })} placeholder="Str., nr., localitate, județ" /></div>
      </div>
      <div className="g2">
        <div className="f"><label>IBAN</label><input value={c.iban} onChange={e => set({ iban: e.target.value })} placeholder="RO49 AAAA 1B31 0075 9384 0000" /></div>
        <div className="f"><label>Banca</label><input value={c.bank} onChange={e => set({ bank: e.target.value })} placeholder="ex: Banca Transilvania" /></div>
      </div>
      <div className="g2">
        <div className="f"><label>Telefon</label><input value={c.phone} onChange={e => set({ phone: e.target.value })} /></div>
        <div className="f"><label>Email</label><input type="email" value={c.email} onChange={e => set({ email: e.target.value })} /></div>
      </div>

      <div className="g3" style={{ marginTop: 4 }}>
        <div className="f"><label>Seria facturilor</label><input value={c.series} onChange={e => set({ series: e.target.value.toUpperCase() })} placeholder="ex: VD" /><div className="hint">Numerele merg la rând: VD 0001, VD 0002…</div></div>
        <div className="f"><label>Termen de plată (zile)</label><input type="number" min={0} max={365} value={c.dueDays} onChange={e => set({ dueDays: Number(e.target.value) })} /><div className="hint">0 = plata la emitere</div></div>
        <div className="f"><label>Mențiuni pe factură</label><input value={c.note} onChange={e => set({ note: e.target.value })} placeholder="ex: Neplătitor de TVA" /></div>
      </div>

      <div className="f" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <input type="checkbox" id="vatp" checked={c.vatPayer} onChange={e => set({ vatPayer: e.target.checked })} style={{ width: 'auto' }} />
        <label htmlFor="vatp" style={{ margin: 0 }}>Sunt plătitor de TVA</label>
        {c.vatPayer && (
          <>
            <label htmlFor="vatr" style={{ margin: '0 0 0 16px' }}>Cota pentru cazare (%)</label>
            <input id="vatr" type="number" min={0} max={100} step="0.5" value={c.vatRate} onChange={e => set({ vatRate: Number(e.target.value) })} style={{ width: 90 }} />
          </>
        )}
      </div>
      {c.vatPayer && <div className="hint" style={{ marginTop: 6 }}>Cota pentru cazare s-a tot schimbat în ultimii ani. Întreabă contabila ce cotă e valabilă acum și scrie-o aici. Prețurile pe care le scrii pe factură sunt cu TVA inclus; TVA-ul se scoate din ele.</div>}

      <div style={{ marginTop: 14 }}><button className="btn primary" onClick={save} disabled={busy}>Salvează datele pensiunii</button></div>
    </div>
  );
}

interface Bk { name: string; date: string; size: number; at: string }
interface BkView { dir: string; keepDays: number; backups: Bk[] }

/** Copiile de siguranță: una pe zi se face singură; de aici se face una pe loc, se descarcă și se alege folderul. */
function BackupCard() {
  const toast = useStore(s => s.toast);
  const [v, setV] = useState<BkView | null>(null), [dir, setDir] = useState(''), [busy, setBusy] = useState(false);
  const take = (x: BkView) => { setV(x); setDir(x.dir); };
  useEffect(() => { api<BkView>('/api/backups').then(take).catch(e => toast((e as Error).message, 'bad')); }, [toast]);

  const run = async (method: 'POST' | 'PUT', body: unknown, ok: string) => {
    setBusy(true);
    try { take(await api<BkView>('/api/backups', method, body)); toast(ok, 'ok'); }
    catch (e) { toast((e as Error).message, 'bad'); }
    finally { setBusy(false); }
  };
  if (!v) return null;
  const last = v.backups[0];
  const kb = (n: number) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

  return (
    <div className="card" style={{ marginBottom: 16, padding: '14px 16px 18px' }}>
      <div className="ch" style={{ padding: '0 0 12px', marginBottom: 12 }}>Copii de siguranță<span className="cnt">{v.backups.length}</span></div>
      <p style={{ margin: '0 0 12px', color: 'var(--ink-2)' }}>
        Cât timp merge programul, se face singură o copie pe zi cu toate rezervările, plățile și facturile. Se păstrează {v.keepDays} de zile.{' '}
        {last ? <>Ultima: <b>{last.at}</b>.</> : <b style={{ color: 'var(--bad)' }}>Încă nu există nicio copie.</b>}
      </p>
      <div className="f">
        <label>Folderul în care se salvează</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={dir} onChange={e => setDir(e.target.value)} placeholder={'ex: C:\\Users\\Nume\\OneDrive\\Velora'} />
          <button className="btn" disabled={busy || dir === v.dir} onClick={() => run('PUT', { dir }, 'Folderul a fost schimbat')}>Salvează</button>
        </div>
        <div className="hint">Alege un folder din OneDrive sau Google Drive: așa copiile ajung și în afara calculatorului, iar dacă se strică discul, rezervările nu se pierd.</div>
      </div>
      <div style={{ margin: '12px 0' }}><button className="btn primary" disabled={busy} onClick={() => run('POST', undefined, 'Copie făcută')}>{busy ? 'Se face…' : 'Fă o copie acum'}</button></div>
      {v.backups.slice(0, 7).map(b => (
        <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: '1px solid var(--line-2)' }}>
          <span style={{ flex: 1 }}>{b.at}</span><span style={{ color: 'var(--ink-3)' }}>{kb(b.size)}</span>
          <a className="btn sm" href={`/api/backups/${b.name}`}>Descarcă</a>
        </div>
      ))}
      <div className="hint" style={{ marginTop: 10 }}>Ca să pui o copie înapoi: oprești programul și rulezi în folderul web <code>{'npm run db:restore -- backups\\velora-....sql.gz --da'}</code>.</div>
    </div>
  );
}

interface IcalFeed { id: string; roomId: string; roomName: string; source: Source; url: string; lastSync: string | null; lastError: string }
interface IcalReport { roomName: string; added: number; changed: number; cancelled: number; conflicts: string[]; error: string }

/** Linkurile de calendar (.ics) de pe Booking, Airbnb, Travelminit, câte unul pe cameră. */
function IcalCard() {
  const data = useData(), toast = useStore(s => s.toast), setData = useStore(s => s.setData);
  const [feeds, setFeeds] = useState<IcalFeed[] | null>(null), [busy, setBusy] = useState(false), [report, setReport] = useState<IcalReport[] | null>(null);
  const [outRoom, setOutRoom] = useState(''), [outUrl, setOutUrl] = useState('');
  const [roomId, setRoomId] = useState(''), [source, setSource] = useState<Source>('booking'), [url, setUrl] = useState('');
  useEffect(() => { api<{ feeds: IcalFeed[] }>('/api/ical').then(r => setFeeds(r.feeds)).catch(e => toast((e as Error).message, 'bad')); }, [toast]);
  if (!feeds) return null;

  const add = async () => {
    setBusy(true);
    try { setFeeds((await api<{ feeds: IcalFeed[] }>('/api/ical', 'POST', { roomId, source, url })).feeds); setUrl(''); toast('Calendar adăugat. Apasă „Citește acum” ca să aduci rezervările.', 'ok'); }
    catch (e) { toast((e as Error).message, 'bad'); }
    finally { setBusy(false); }
  };
  const remove = async (f: IcalFeed) => {
    if (!confirm(`Scoți calendarul ${SRC[f.source]} de la ${f.roomName}?\n\nRezervările deja aduse rămân.`)) return;
    try { setFeeds((await api<{ feeds: IcalFeed[] }>(`/api/ical/${f.id}`, 'DELETE')).feeds); } catch (e) { toast((e as Error).message, 'bad'); }
  };
  const sync = async () => {
    setBusy(true);
    try {
      const r = await api<{ report: IcalReport[]; feeds: IcalFeed[]; state: AppState }>('/api/ical/sync', 'POST');
      setFeeds(r.feeds); setReport(r.report); setData(r.state);
      const n = r.report.reduce((s, x) => s + x.added + x.changed + x.cancelled, 0), bad = r.report.some(x => x.error || x.conflicts.length);
      toast(bad ? 'Citit, dar sunt probleme. Vezi mai jos.' : n ? `Citit: ${n} schimbări` : 'Citit: nimic nou', bad ? 'bad' : 'ok');
    } catch (e) { toast((e as Error).message, 'bad'); }
    finally { setBusy(false); }
  };
  const showLink = async (renew: boolean) => {
    try {
      const { path } = await api<{ path: string }>('/api/ical/token', 'POST', { roomId: outRoom, renew });
      const full = window.location.origin + path; setOutUrl(full);
      try { await navigator.clipboard.writeText(full); toast('Link copiat', 'ok'); } catch {}
    } catch (e) { toast((e as Error).message, 'bad'); }
  };
  const when = (at: string | null) => { if (!at) return 'încă necitit'; const [d, t] = at.split(' '); return `${d.split('-').reverse().join('.')} ${t?.slice(0, 5) ?? ''}`; };
  const rooms = data.rooms.filter(r => r.active);

  return (
    <div className="card" style={{ marginBottom: 16, padding: '14px 16px 18px' }}>
      <div className="ch" style={{ padding: '0 0 12px', marginBottom: 12 }}>Calendare Booking, Airbnb, Travelminit<span className="cnt">{feeds.length}</span></div>
      <p style={{ margin: '0 0 12px', color: 'var(--ink-2)' }}>
        Pune aici linkul de calendar (.ics) al fiecărei camere, luat de pe site (la Booking: Tarife și disponibilitate → Sincronizare calendare → Exportă).
        Programul îl citește singur din 15 în 15 minute: rezervările de acolo apar în calendar, iar camera nu mai poate fi dată a doua oară.
        Site-urile nu trimit numele și prețul, deci pe acelea le completezi tu.
      </p>
      {feeds.map(f => (
        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: '1px solid var(--line-2)', flexWrap: 'wrap' }}>
          <b style={{ minWidth: 60 }}>{f.roomName}</b><span className="urole">{SRC[f.source]}</span>
          <span style={{ flex: 1, minWidth: 120, color: f.lastError ? 'var(--bad)' : 'var(--ink-3)', fontSize: 12.5 }}>{f.lastError || `citit: ${when(f.lastSync)}`}</span>
          <button className="btn sm" onClick={() => remove(f)}>Scoate</button>
        </div>
      ))}
      <div className="g3" style={{ marginTop: 12 }}>
        <div className="f"><label>Camera</label>
          <select value={roomId} onChange={e => setRoomId(e.target.value)}><option value="">Alege…</option>{rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
        <div className="f"><label>Site-ul</label>
          <select value={source} onChange={e => setSource(e.target.value as Source)}>{(['booking', 'airbnb', 'travelminit', 'other'] as Source[]).map(s => <option key={s} value={s}>{SRC[s]}</option>)}</select></div>
        <div className="f"><label>Linkul calendarului</label><input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…ics" /></div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn" disabled={busy || !roomId || !url.trim()} onClick={add}>Adaugă calendarul</button>
        <button className="btn primary" disabled={busy || !feeds.length} onClick={sync}>{busy ? 'Se citește…' : 'Citește acum'}</button>
      </div>
      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--line-2)' }}>
        <div className="sec-t">Și invers: linkul nostru, de pus pe site</div>
        <p style={{ margin: '6px 0 10px', color: 'var(--ink-2)' }}>
          Ca site-ul să închidă singur nopțile rezervate la telefon, îi dai linkul camerei (la Booking: Sincronizare calendare → Importă).
          Linkul arată doar ce nopți sunt ocupate, fără nume și fără prețuri. Merge numai când programul e pus pe internet, nu de pe calculatorul de acasă.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={outRoom} onChange={e => { setOutRoom(e.target.value); setOutUrl(''); }} style={{ maxWidth: 220 }}><option value="">Alege camera…</option>{rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
          <button className="btn" disabled={!outRoom} onClick={() => showLink(false)}>Arată linkul</button>
          {outUrl && <button className="btn sm" onClick={() => { if (confirm('Fac un link nou? Cel vechi nu va mai merge și trebuie schimbat pe site.')) showLink(true); }}>Link nou</button>}
        </div>
        {outUrl && <input readOnly value={outUrl} onFocus={e => e.currentTarget.select()} style={{ marginTop: 8, width: '100%' }} />}
      </div>
      {report && report.some(r => r.error || r.conflicts.length || r.added || r.changed || r.cancelled) && (
        <div className="notes" style={{ marginTop: 12 }}>
          {report.map((r, i) => (
            <div key={i}><b>{r.roomName}</b>: {r.error ? <span style={{ color: 'var(--bad)' }}>{r.error}</span> : `${r.added} noi, ${r.changed} mutate, ${r.cancelled} anulate`}
              {r.conflicts.map((c, j) => <div key={j} style={{ color: 'var(--bad)' }}>Nu a intrat: {c}</div>)}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Mesajul de confirmare trimis oaspetelui pe WhatsApp sau pe email, cu previzualizare pe o rezervare adevărată. */
function TemplateCard() {
  const data = useData(), toast = useStore(s => s.toast), loadMsg = useStore(s => s.loadMsg);
  const [t, setT] = useState<string | null>(null), [sender, setSender] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { api<{ template: string; sender: string }>('/api/message-template').then(m => { setT(m.template); setSender(m.sender); }).catch(e => toast((e as Error).message, 'bad')); }, [toast]);
  if (t === null) return null;
  const sample = data.reservations.find(r => r.status !== 'cancelled' && r.payments.length > 0) ?? data.reservations[0];

  const save = async (text: string) => {
    setBusy(true);
    try { const m = await api<{ template: string }>('/api/message-template', 'PUT', { template: text }); setT(m.template); await loadMsg(true); toast('Mesajul a fost salvat', 'ok'); }
    catch (e) { toast((e as Error).message, 'bad'); }
    finally { setBusy(false); }
  };

  return (
    <div className="card" style={{ marginBottom: 16, padding: '14px 16px 18px' }}>
      <div className="ch" style={{ padding: '0 0 12px', marginBottom: 12 }}>Mesajul de confirmare pentru oaspeți</div>
      <p style={{ margin: '0 0 12px', color: 'var(--ink-2)' }}>Din sertarul unei rezervări, „Confirmă pe WhatsApp” deschide conversația cu acest text deja scris. Nu costă nimic și nu se trimite nimic fără să apeși tu „Trimite”.</p>
      <div className="g2">
        <div className="f">
          <label>Textul</label>
          <textarea value={t} onChange={e => setT(e.target.value)} style={{ minHeight: 230, fontFamily: 'inherit' }} />
          <div className="hint">Se înlocuiesc singure: {PLACEHOLDERS.map(([k, d]) => <span key={k} title={d} style={{ marginRight: 8, whiteSpace: 'nowrap' }}><code>{k}</code></span>)}</div>
        </div>
        <div className="f">
          <label>Cum arată pentru {sample ? 'o rezervare de-a ta' : 'oaspete'}</label>
          <div className="notes" style={{ whiteSpace: 'pre-wrap', minHeight: 230, margin: 0 }}>{sample ? fillTemplate(t, messageVars(data, sample, sender)) : t}</div>
        </div>
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button className="btn primary" disabled={busy} onClick={() => save(t)}>Salvează mesajul</button>
        <button className="btn" disabled={busy || t === DEFAULT_TEMPLATE} onClick={() => save('')}>Înapoi la cel de la început</button>
      </div>
    </div>
  );
}
