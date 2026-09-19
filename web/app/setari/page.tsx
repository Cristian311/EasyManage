'use client';
import { useCallback, useEffect, useState } from 'react';
import type { Me, Role } from '@/domain/types';
import type { Company } from '@/domain/invoice';
import { ROLE } from '@/domain/labels';
import { api } from '@/lib/client/api';
import { useStore } from '@/lib/client/store';
import Table from '@/components/Table';

type U = Me & { active: boolean };

export default function SettingsPage() {
  const reset = useStore(s => s.resetDemo), toast = useStore(s => s.toast), me = useStore(s => s.me);
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
      <div className="topbar"><h1>Setări</h1><div className="spacer" /><button className="btn primary" onClick={() => setOpen(true)}>Cont nou</button></div>
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
