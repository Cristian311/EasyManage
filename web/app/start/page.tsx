'use client';
// Prima pornire: nu există încă niciun cont, deci se face contul proprietarului.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthCard from '@/components/AuthCard';
import { api } from '@/lib/client/api';
import { useStore } from '@/lib/client/store';

export default function SetupPage() {
  const router = useRouter(), load = useStore(s => s.load);
  const [name, setName] = useState(''), [email, setEmail] = useState('');
  const [password, setPassword] = useState(''), [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false);

  const submit = async () => {
    if (password !== again) { setError('Cele două parole nu sunt la fel.'); return; }
    setBusy(true); setError(null);
    try {
      await api('/api/auth/setup', 'POST', { name, email, password });
      await load();
      router.replace('/calendar');
    } catch (e) { setError((e as Error).message); setBusy(false); }
  };

  return (
    <AuthCard
      title="Bun venit" lead="Fă-ți contul de proprietar. Cu el vei putea adăuga mai târziu conturi pentru recepție."
      error={error} button="Creează contul" busy={busy} onSubmit={submit}
      note="Ține minte parola: nimeni nu ți-o poate spune mai târziu, pentru că nu e păstrată nicăieri."
    >
      <div className="f">
        <label htmlFor="name">Numele tău</label>
        <input id="name" autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="ex: Ion Popescu" />
      </div>
      <div className="f">
        <label htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="nume@exemplu.ro" />
      </div>
      <div className="f">
        <label htmlFor="pw">Parolă</label>
        <input id="pw" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />
        <div className="hint">Cel puțin 8 caractere.</div>
      </div>
      <div className="f">
        <label htmlFor="pw2">Scrie parola încă o dată</label>
        <input id="pw2" type="password" autoComplete="new-password" value={again} onChange={e => setAgain(e.target.value)} />
      </div>
    </AuthCard>
  );
}
