'use client';
import { useStore } from '@/lib/client/store';

export default function Toasts() {
  const toasts = useStore(s => s.toasts), dismiss = useStore(s => s.dismiss);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.action
            ? <><span>{t.msg}</span><button type="button" onClick={() => { dismiss(t.id); t.action!.run(); }}>{t.action.label}</button></>
            : t.msg}
        </div>
      ))}
    </div>
  );
}
