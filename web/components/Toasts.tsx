'use client';
import { useStore } from '@/lib/client/store';
import { useData } from '@/lib/client/store';
import { resGuest } from '@/domain/rules';

export default function Toasts() {
  const toasts = useStore(s => s.toasts), dismiss = useStore(s => s.dismiss);
  const addMode = useStore(s => s.addMode), setAddMode = useStore(s => s.setAddMode), data = useStore(s => s.data);
  const adding = addMode && data ? data.reservations.find(r => r.id === addMode) : null;
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.action
            ? <><span>{t.msg}</span><button type="button" onClick={() => { dismiss(t.id); t.action!.run(); }}>{t.action.label}</button></>
            : t.msg}
        </div>
      ))}
      {adding && <div className="toast"><span>Desenează camerele de adăugat pentru {resGuest(data!, adding)}. Pe aceleași zile, lângă rezervare, se unesc cu ea.</span><button type="button" onClick={() => setAddMode(null)}>Renunță</button></div>}
    </div>
  );
}
