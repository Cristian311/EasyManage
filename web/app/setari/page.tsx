'use client';
import { useEffect, useState } from 'react';
import { useData, useStore } from '@/lib/client/store';
import { invoiceNo } from '@/domain/invoice';
import type { Settings } from '@/domain/types';

export default function SettingsPage() {
  const data = useData(), save = useStore(s => s.saveSettings), reset = useStore(s => s.resetDemo);
  const [f, setF] = useState<Settings>(data.settings), [saving, setSaving] = useState(false);
  useEffect(() => { setF(data.settings); }, [data.settings]);
  const set = (p: Partial<Settings>) => setF(x => ({ ...x, ...p }));
  const submit = async () => { setSaving(true); await save({ ...f, vatRate: Number(f.vatRate), invoiceNext: Number(f.invoiceNext) }); setSaving(false); };
  const pad = { padding: 16, display: 'flex', flexDirection: 'column' as const, gap: 12 };

  return (
    <section className="page on" id="page-settings">
      <div className="topbar"><h1>Setări</h1><div className="spacer" /><button className="btn primary" onClick={submit} disabled={saving}>Salvează</button></div>
      <div className="scroll">
        <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div className="ch">Firma <span className="cnt">așa apare pe facturi</span></div>
            <div style={pad}>
              <div className="g2">
                <div className="f"><label>Denumire</label><input value={f.name} onChange={e => set({ name: e.target.value })} placeholder="ex: Pensiunea Vila Duduleanu SRL" /></div>
                <div className="f"><label>CUI / CIF</label><input value={f.cui} onChange={e => set({ cui: e.target.value })} placeholder="RO12345678" /></div>
              </div>
              <div className="g2">
                <div className="f"><label>Nr. Reg. Com.</label><input value={f.regCom} onChange={e => set({ regCom: e.target.value })} placeholder="J08/1234/2019" /></div>
                <div className="f"><label>Telefon</label><input value={f.phone} onChange={e => set({ phone: e.target.value })} /></div>
              </div>
              <div className="f"><label>Adresă</label><input value={f.address} onChange={e => set({ address: e.target.value })} placeholder="Strada, nr., localitate, județ" /></div>
              <div className="g2">
                <div className="f"><label>Email</label><input value={f.email} onChange={e => set({ email: e.target.value })} /></div>
                <div className="f"><label>Bancă</label><input value={f.bank} onChange={e => set({ bank: e.target.value })} /></div>
              </div>
              <div className="f"><label>IBAN</label><input value={f.iban} onChange={e => set({ iban: e.target.value })} placeholder="RO49 AAAA 1B31 0075 9384 0000" /></div>
            </div>
          </div>
          <div className="card">
            <div className="ch">Facturare</div>
            <div style={pad}>
              <div className="f" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id="vatp" checked={f.vatPayer} onChange={e => set({ vatPayer: e.target.checked })} style={{ width: 'auto' }} />
                <label htmlFor="vatp" style={{ margin: 0 }}>Plătitor de TVA</label>
              </div>
              <div className="g3">
                <div className="f"><label>Cota TVA la cazare (%)</label><input type="number" min={0} max={99} value={f.vatRate} disabled={!f.vatPayer} onChange={e => set({ vatRate: Number(e.target.value) })} /></div>
                <div className="f"><label>Seria facturilor</label><input value={f.invoiceSeries} maxLength={12} onChange={e => set({ invoiceSeries: e.target.value })} /></div>
                <div className="f"><label>Următorul număr</label><input type="number" min={1} value={f.invoiceNext} onChange={e => set({ invoiceNext: Number(e.target.value) })} /></div>
              </div>
              <div className="f"><span className="hint">Următoarea factură va fi <b>{invoiceNo({ series: f.invoiceSeries || '?', number: Number(f.invoiceNext) || 1 })}</b>. Prețurile camerelor includ TVA; pe factură apar separat baza și TVA-ul.
                Numerele nu se refolosesc: o factură greșită se anulează și rămâne în registru.</span></div>
            </div>
          </div>
          <div className="card">
            <div className="ch">Confirmare rezervare <span className="cnt">ce primește oaspetele</span></div>
            <div style={pad}>
              <div className="g2">
                <div className="f"><label>Check-in de la ora</label><input type="time" value={f.checkInTime} onChange={e => set({ checkInTime: e.target.value })} /></div>
                <div className="f"><label>Check-out până la ora</label><input type="time" value={f.checkOutTime} onChange={e => set({ checkOutTime: e.target.value })} /></div>
              </div>
              <div className="f"><label>Mențiuni (avans, anulare, reguli)</label>
                <textarea value={f.confirmText} maxLength={1000} onChange={e => set({ confirmText: e.target.value })} placeholder="ex: Rezervarea se confirmă la plata avansului de 30% în cel mult 3 zile. Anulare gratuită cu 7 zile înainte de sosire." /></div>
            </div>
          </div>
          <div className="card">
            <div className="ch">Date demo</div>
            <div style={pad}>
              <p style={{ margin: 0, color: 'var(--ink-2)' }}>Șterge tot și încarcă din nou vilele demo, cu rezervările și facturile lor.</p>
              <div><button className="btn" onClick={() => { if (confirm('Șterg toate datele și încarc din nou vilele demo?')) reset(); }}>Resetează datele demo</button></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
