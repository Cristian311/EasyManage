'use client';
import { useEffect, useRef, useState } from 'react';
import { useData, useStore } from '@/lib/client/store';
import { todayIso } from '@/domain/dates';
import { EXP_CATS } from '@/domain/finance';
import { IconClose } from './Icons';

export default function ExpenseModal() {
  const m = useStore(s => s.expModal);
  return m ? <Form key={m.editId ?? 'new'} editId={m.editId} /> : null;
}

function Form({ editId }: { editId: string | null }) {
  const data = useData(), fin = useStore(s => s.fin), setFin = useStore(s => s.setFin), close = useStore(s => s.closeExpModal), save = useStore(s => s.saveExpense), toast = useStore(s => s.toast);
  const x = editId ? data.expenses.find(e => e.id === editId) : undefined;
  const T = todayIso();
  const [amount, setAmount] = useState(x ? String(x.amount) : ''), [date, setDate] = useState(x?.date ?? (fin.month === T.slice(0, 7) ? T : fin.month + '-01'));
  const [cat, setCat] = useState(x?.category ?? 'Utilități'), [pid, setPid] = useState(x?.propertyId ?? (fin.prop === 'all' ? '' : fin.prop));
  const [desc, setDesc] = useState(x?.desc ?? ''), [rec, setRec] = useState(x?.recurring ?? false), [saving, setSaving] = useState(false);
  const amtRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => amtRef.current?.focus(), 50); }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [close]);

  const submit = async () => {
    const a = Math.round(Number(amount)); if (!(a > 0)) { toast('Scrie suma cheltuielii', 'bad'); amtRef.current?.focus(); return; }
    if (!date) { toast('Alege data', 'bad'); return; }
    setSaving(true);
    const err = await save(editId, { amount: a, date, category: cat, desc: desc.trim(), propertyId: pid || null, recurring: rec, until: x?.until || '' });
    setSaving(false); if (err) return;
    setFin({ month: rec && date.slice(0, 7) > fin.month ? date.slice(0, 7) : rec ? fin.month : date.slice(0, 7) });
    toast(editId ? 'Cheltuială actualizată' : `Cheltuială adăugată: ${a.toLocaleString('ro-RO')} lei${rec ? ' pe lună' : ''}`, 'ok'); close();
  };

  return (
    <div className="overlay open" onPointerDown={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal sm" role="dialog">
        <div className="hd"><h2>{x ? 'Editează cheltuiala' : 'Cheltuială nouă'}</h2><div className="spacer" /><button className="btn icon ghost" onClick={close}><IconClose /></button></div>
        <div className="bd">
          <div className="g2">
            <div className="f"><label>Sumă (lei)</label><input ref={amtRef} type="number" min={0} step={10} value={amount} onChange={e => setAmount(e.target.value)} placeholder="ex: 1200" onKeyDown={e => { if (e.key === 'Enter') submit(); }} /></div>
            <div className="f"><label>Data</label><input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          </div>
          <div className="g2">
            <div className="f"><label>Categorie</label><select value={cat} onChange={e => setCat(e.target.value)}>{EXP_CATS.map(c => <option key={c}>{c}</option>)}</select></div>
            <div className="f"><label>Proprietate</label><select value={pid} onChange={e => setPid(e.target.value)}><option value="">Comună, pentru toate</option>{data.properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          </div>
          <div className="f"><label>Descriere</label><input value={desc} onChange={e => setDesc(e.target.value)} placeholder="ex: factură curent, salariu cameristă" /></div>
          <div className="f" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><input type="checkbox" id="eRec" checked={rec} onChange={e => setRec(e.target.checked)} style={{ width: 'auto' }} /><label htmlFor="eRec" style={{ margin: 0 }}>Se repetă în fiecare lună, începând cu luna aleasă</label></div>
        </div>
        <div className="ft"><button className="btn" onClick={close}>Renunță</button><button className="btn primary" onClick={submit} disabled={saving}>Salvează</button></div>
      </div>
    </div>
  );
}
