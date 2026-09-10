'use client';
import { useStore } from '@/lib/client/store';

export default function SettingsPage() {
  const reset = useStore(s => s.resetDemo);
  return (
    <section className="page on">
      <div className="topbar"><h1>Setări</h1></div>
      <div className="scroll">
        <div className="ph">
          <h2>Proprietate și cont</h2>
          <p>Nume, adresă, CUI, ore de check-in și check-out, utilizatori. Vin odată cu autentificarea.</p>
          <button className="btn" onClick={() => { if (confirm('Șterg toate datele și încarc din nou vilele demo?')) reset(); }}>Resetează datele demo</button>
        </div>
      </div>
    </section>
  );
}
