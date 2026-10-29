'use client';
// Rama comună a paginilor de intrare: sigla, titlul, mesajul de eroare și butonul mare.
import type { ReactNode } from 'react';

export default function AuthCard({ title, lead, error, button, busy, onSubmit, children, note }: {
  title: string;
  lead: string;
  error: string | null;
  button: string;
  busy: boolean;
  onSubmit: () => void;
  children: ReactNode;
  note?: ReactNode;
}) {
  return (
    <form className="auth-card" onSubmit={e => { e.preventDefault(); onSubmit(); }}>
      <div className="brandline">
        <div className="mark">V</div>
        <div><div className="t1">Velora Stay</div><div className="t2">Rezervări pentru pensiuni</div></div>
      </div>
      <h1>{title}</h1>
      <p className="lead">{lead}</p>
      {error && <div className="auth-err" role="alert">{error}</div>}
      {children}
      <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Un moment…' : button}</button>
      {note && <div className="auth-note">{note}</div>}
    </form>
  );
}
