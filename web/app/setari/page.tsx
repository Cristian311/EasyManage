'use client';
import { useCallback, useEffect, useState } from 'react';
import type { Me, Role } from '@/domain/types';
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

        <div className="ph">
          <h2>Date despre pensiune</h2>
          <p>Nume, adresă, CUI, ore de check-in și check-out. Vin odată cu facturile.</p>
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
