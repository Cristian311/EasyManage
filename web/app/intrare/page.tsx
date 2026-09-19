'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthCard from '@/components/AuthCard';
import { api } from '@/lib/client/api';
import { useStore } from '@/lib/client/store';

export default function LoginPage() {
  const router = useRouter(), load = useStore(s => s.load);
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await api('/api/auth/login', 'POST', { email, password });
      await load();
      router.replace('/calendar');
    } catch (e) { setError((e as Error).message); setBusy(false); }
  };

  return (
    <AuthCard
      title="Intră în cont" lead="Scrie emailul și parola primite." error={error}
      button="Intră" busy={busy} onSubmit={submit}
      note="Ai uitat parola? Cere-i proprietarului să îți pună una nouă din Setări."
    >
      <div className="f">
        <label htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="username" autoFocus value={email} onChange={e => setEmail(e.target.value)} placeholder="nume@exemplu.ro" />
      </div>
      <div className="f">
        <label htmlFor="pw">Parolă</label>
        <input id="pw" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
      </div>
    </AuthCard>
  );
}
