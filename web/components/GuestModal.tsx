'use client';
// Datele unui oaspete: nume, contact și actul de identitate pentru fișa de cazare.
import { useEffect, useState } from 'react';
import type { Guest } from '@/domain/types';
import { useData, useStore } from '@/lib/client/store';
import { IconClose } from './Icons';

export const ID_TYPES = ['Carte de identitate', 'Pașaport', 'Permis de conducere', 'Alt act'];

export default function GuestModal() {
  const id = useStore(s => s.guestModal);
  return id ? <Form key={id} id={id} /> : null;
}

function Form({ id }: { id: string }) {
  const data = useData(), close = useStore(s => s.closeGuest), save = useStore(s => s.saveGuest), toast = useStore(s => s.toast);
  const g0 = data.guests.find(g => g.id === id);
  const [g, setG] = useState<Guest | undefined>(g0), [busy, setBusy] = useState(false);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [close]);
  if (!g) return null;
  const set = (p: Partial<Guest>) => setG(x => (x ? { ...x, ...p } : x));

  const submit = async () => {
    if (!g.firstName.trim()) { toast('Scrie numele oaspetelui', 'bad'); return; }
    setBusy(true);
    const err = await save(id, g);
    setBusy(false);
    if (!err) { toast('Datele oaspetelui au fost salvate', 'ok'); close(); }
  };

  return (
    <div className="overlay open" onPointerDown={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal" role="dialog" aria-label="Date oaspete">
        <div className="hd"><h2>Date oaspete</h2><div className="spacer" /><button className="btn icon ghost" onClick={close}><IconClose /></button></div>
        <div className="bd">
          <div className="g2">
            <div className="f"><label>Prenume</label><input autoFocus value={g.firstName} onChange={e => set({ firstName: e.target.value })} /></div>
            <div className="f"><label>Nume de familie</label><input value={g.lastName} onChange={e => set({ lastName: e.target.value })} /></div>
          </div>
          <div className="g2">
            <div className="f"><label>Telefon</label><input value={g.phone} onChange={e => set({ phone: e.target.value })} /></div>
            <div className="f"><label>Email</label><input type="email" value={g.email} onChange={e => set({ email: e.target.value })} /></div>
          </div>

          <div className="sec-t" style={{ marginTop: 6 }}>Pentru fișa de cazare</div>
          <div className="g3">
            <div className="f"><label>Act de identitate</label>
              <select value={g.idType ?? ''} onChange={e => set({ idType: e.target.value })}><option value="">—</option>{ID_TYPES.map(t => <option key={t}>{t}</option>)}</select>
            </div>
            <div className="f"><label>Seria</label><input value={g.idSeries ?? ''} onChange={e => set({ idSeries: e.target.value.toUpperCase() })} placeholder="ex: VX" /></div>
            <div className="f"><label>Numărul</label><input value={g.idNumber ?? ''} onChange={e => set({ idNumber: e.target.value })} placeholder="ex: 123456" /></div>
          </div>
          <div className="g3">
            <div className="f"><label>Data nașterii</label><input type="date" value={g.birthDate ?? ''} onChange={e => set({ birthDate: e.target.value || null })} /></div>
            <div className="f"><label>Locul nașterii</label><input value={g.birthPlace ?? ''} onChange={e => set({ birthPlace: e.target.value })} /></div>
            <div className="f"><label>Cetățenia</label><input value={g.citizenship ?? ''} onChange={e => set({ citizenship: e.target.value })} placeholder="ex: română" /></div>
          </div>
          <div className="g2">
            <div className="f"><label>Domiciliul</label><input value={g.address ?? ''} onChange={e => set({ address: e.target.value })} placeholder="Str., nr., localitate, județ" /></div>
            <div className="f"><label>Țara</label><input value={g.country} onChange={e => set({ country: e.target.value })} /></div>
          </div>
          <div className="f"><label>Observații despre oaspete</label><textarea value={g.notes} onChange={e => set({ notes: e.target.value })} placeholder="ex: vine cu un câine mic, preferă etajul 1" /></div>
        </div>
        <div className="ft"><button className="btn" onClick={close}>Renunță</button><button className="btn primary" onClick={submit} disabled={busy}>Salvează</button></div>
      </div>
    </div>
  );
}
