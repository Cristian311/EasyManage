'use client';
// What came in, what went out, what is left: tiles, four charts, the tables, month by month.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as RMouseEvent } from 'react';
import { useData, useStore } from '@/lib/client/store';
import { addDays, fmtD, fmtDL, todayIso } from '@/domain/dates';
import { addMonths, COMM, expensesIn, finMonth, monthEnd, monthName, occupancyByDay } from '@/domain/finance';
import { METHOD, SRC } from '@/domain/labels';
import { resGuest, roomLabel, shortProp } from '@/domain/rules';
import type { Expense, Method, Source } from '@/domain/types';
import Table from '../Table';
import { IconNext, IconPlus, IconPrev } from '../Icons';
import { downloadCsv } from '@/lib/client/csv';
import { drawDaily, drawMonthly, drawOcc, drawSrc, esc, VZ, type OccData, type Tips } from './charts';

const pct = (v: number) => Math.round(v * 100) + '%';

export default function FinancePage() {
  const data = useData(), fin = useStore(s => s.fin), setFin = useStore(s => s.setFin);
  const openExp = useStore(s => s.openExpModal), delExp = useStore(s => s.deleteExpense), saveExp = useStore(s => s.saveExpense), toast = useStore(s => s.toast), focusRes = useStore(s => s.focusRes);
  const today = useMemo(todayIso, []), m = fin.month;
  const M = useMemo(() => ({ k: fin.cur === 'EUR' ? 1 / fin.rate : 1, unit: fin.cur === 'EUR' ? ' €' : '',
    lei: (v: number) => fin.cur === 'EUR' ? Math.round(v / fin.rate).toLocaleString('ro-RO') + ' €' : Math.round(v).toLocaleString('ro-RO') + ' lei' }), [fin.cur, fin.rate]);
  const f = useMemo(() => finMonth(data, m, fin.prop), [data, m, fin.prop]);
  const P = fin.prop === 'all' ? null : data.properties.find(p => p.id === fin.prop);
  const months = useMemo(() => {
    const first = [...data.reservations.map(r => r.checkIn.slice(0, 7)), ...data.expenses.map(e => e.date.slice(0, 7))].sort()[0] || m;
    const out: string[] = []; for (let k = -5; k <= 2; k++) { const mm = addMonths(today.slice(0, 7), k); if (mm >= first) out.push(mm); } return out;
  }, [data, m, today]);
  const mSeries = useMemo(() => months.map(mm => { const q = finMonth(data, mm, fin.prop); return { m: mm, cashed: q.cashed, spent: q.spent, profit: q.profit, occ: q.occ, earned: q.earned, comm: q.comm }; }), [months, data, fin.prop]);

  /** Luna aleasă, pentru contabilă: întâi încasările, apoi cheltuielile, fiecare pe rândul ei. */
  const excel = () => {
    const pays = data.reservations.flatMap(r => r.payments.filter(p => p.date.startsWith(m)).map(p => ({
      kind: 'Încasare', date: p.date, what: `${resGuest(data, r)} · ${roomLabel(data, r)}`, method: METHOD[p.method], amount: p.amount, doc: r.invoiceNo })));
    const exps = expensesIn(data, m, fin.prop).map(e => ({ kind: 'Cheltuială', date: e.date.startsWith(m) ? e.date : m + '-01', what: [e.category, e.desc].filter(Boolean).join(' · '), method: '', amount: -e.amount, doc: '' }));
    downloadCsv(`financiar_${m}`, [...pays, ...exps].sort((a, b) => a.date.localeCompare(b.date)), [
      ['Fel', x => x.kind], ['Data', x => x.date], ['Ce', x => x.what], ['Metodă', x => x.method], ['Sumă (lei)', x => x.amount], ['Factură', x => x.doc]]);
  };

  /* ---------- charts: drawn as SVG strings at the width of their card ---------- */
  const bodyRef = useRef<HTMLDivElement>(null), tips = useRef<Tips>([]), occ = useRef<OccData | null>(null);
  const [W, setW] = useState(480);
  useLayoutEffect(() => { const el = bodyRef.current?.querySelector('.viz-body'); if (!el) return; const ro = new ResizeObserver(() => setW(Math.max(320, (el as HTMLElement).clientWidth))); ro.observe(el); return () => ro.disconnect(); }, []);
  const charts = useMemo(() => {
    const t: Tips = []; tips.current = t;
    const o = drawOcc(W, occupancyByDay(data, m, fin.prop)); occ.current = o.data;
    return { monthly: drawMonthly(W, mSeries, m, M, t), src: drawSrc(W, f.bySrc, M, t), daily: drawDaily(W, m, f.pays, today, M, t), occ: o.html };
  }, [W, data, m, fin.prop, mSeries, f, M, today]);
  const [tipHtml, setTipHtml] = useState<{ html: string; x: number; y: number } | null>(null);
  const onMove = (e: RMouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement, plot = t.closest('.vz-plot'), h = t.closest('[data-tip]') as HTMLElement | null;
    const svg = plot?.closest('svg'), X = svg?.querySelector('[data-occx]') as SVGElement | null, D = svg?.querySelector('[data-occd]') as SVGElement | null;
    if (plot && occ.current && X && D) {
      const o = occ.current, r = svg!.getBoundingClientRect(), i = Math.max(0, Math.min(o.n - 1, Math.round((e.clientX - r.left - VZ.pl) / o.step))), [x, y] = o.pts[i];
      X.setAttribute('x1', String(x)); X.setAttribute('x2', String(x)); X.style.display = ''; D.setAttribute('cx', String(x)); D.setAttribute('cy', String(y)); D.style.display = '';
      setTipHtml({ html: `<b>${fmtDL(addDays(o.a, i))}</b><div>Ocupare <b>${o.rooms ? Math.round(Math.min(1, o.used[i] / o.rooms) * 100) : 0}%</b></div><div>${o.used[i]} din ${o.rooms} camere ocupate</div>`, x: e.clientX, y: e.clientY }); return;
    }
    bodyRef.current?.querySelectorAll<SVGElement>('[data-occx],[data-occd]').forEach(el => { el.style.display = 'none'; });
    if (h) { setTipHtml({ html: tips.current[+h.dataset.tip!], x: e.clientX, y: e.clientY }); return; }
    setTipHtml(null);
  };
  const onClickBody = (e: RMouseEvent<HTMLDivElement>) => { const r = (e.target as HTMLElement).closest('.vz-hit[data-m]') as HTMLElement | null; if (r) setFin({ month: r.dataset.m! }); };

  const stopRecurring = async (x: Expense) => {
    let until = monthEnd(addMonths(m, -1)); if (until < x.date) until = addDays(x.date, -1);
    const err = await saveExp(x.id, { amount: x.amount, date: x.date, category: x.category, desc: x.desc, propertyId: x.propertyId, recurring: true, until });
    if (!err) toast(`${x.category}: nu se mai adaugă din ${monthName(m).toLowerCase()}`, '', { label: 'Anulează', run: () => { saveExp(x.id, { amount: x.amount, date: x.date, category: x.category, desc: x.desc, propertyId: x.propertyId, recurring: true, until: x.until || '' }); } });
  };
  const tile = (label: string, value: string, small: string, cls = '') => <div className={`tile ${cls}`}><label>{label}</label><b>{value}</b><small>{small}</small></div>;
  const methods = (Object.keys(METHOD) as Method[]).filter(k => f.byMethod[k]), srcs = (Object.keys(SRC) as Source[]).filter(k => f.bySrc[k]);
  const exps = f.exps.slice().sort((x, y) => Number(y.amount) - Number(x.amount));
  const pays = f.pays.slice().sort((x, y) => y.pm.date.localeCompare(x.pm.date)), shownPays = pays.slice(0, 60);
  const commonExp = expensesIn(data, m, 'all').filter(e => !e.propertyId).reduce((t, e) => t + Number(e.amount), 0);

  return (
    <section className="page on" id="page-finance">
      <div className="topbar"><h1>Financiar <small>{P ? P.name : 'toate proprietățile'}</small></h1><div className="spacer" />
        {data.properties.length > 1 && <div className="seg"><button className={fin.prop === 'all' ? 'on' : ''} onClick={() => setFin({ prop: 'all' })}>Toate</button>{data.properties.map(p => <button key={p.id} className={fin.prop === p.id ? 'on' : ''} onClick={() => setFin({ prop: p.id })}>{shortProp(p)}</button>)}</div>}
        <div className="seg" title="Afișează sumele în lei sau în euro"><button className={fin.cur === 'RON' ? 'on' : ''} onClick={() => setFin({ cur: 'RON' })}>lei</button><button className={fin.cur === 'EUR' ? 'on' : ''} onClick={() => setFin({ cur: 'EUR' })}>€</button></div>
        {fin.cur === 'EUR' && <label className="fx">1 € = <input type="number" step={0.01} min={1} defaultValue={fin.rate} onBlur={e => { const v = parseFloat(e.target.value.replace(',', '.')); if (v > 0) setFin({ rate: v }); else toast('Cursul trebuie să fie mai mare ca zero', 'bad'); }} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} /> lei</label>}
        <button className="btn icon" onClick={() => setFin({ month: addMonths(m, -1) })} title="Luna anterioară"><IconPrev /></button>
        <div className="period">{monthName(m)}</div>
        <button className="btn icon" onClick={() => setFin({ month: addMonths(m, 1) })} title="Luna următoare"><IconNext /></button>
        <button className="btn" onClick={excel}>Descarcă Excel</button>
        <button className="btn primary" onClick={() => openExp()}><IconPlus />Cheltuială</button>
      </div>
      <div className="scroll" ref={bodyRef} onMouseMove={onMove} onMouseLeave={() => setTipHtml(null)} onClickCapture={onClickBody}>
        <div className="tiles">
          {tile('Încasat', M.lei(f.cashed), `${f.pays.length} plăți în lună`)}
          {tile('Venit din nopți', M.lei(f.earned), 'nopțile lunii, indiferent când se plătesc')}
          {tile('Cheltuieli', M.lei(f.spent), `${f.exps.length} înregistrări`, f.spent ? 'warn' : '')}
          {tile('Comisioane estimate', M.lei(f.comm), 'Booking 15%, Travelminit 12%, Airbnb 3%')}
          {tile('Profit', M.lei(f.profit), 'încasat minus cheltuieli și comisioane', f.profit >= 0 ? 'ok' : 'bad')}
          {tile('De încasat', M.lei(f.outstanding), 'rest de plată la sosirile lunii', f.outstanding ? 'bad' : '')}
          {tile('Ocupare', pct(f.occ), `${f.roomNights} nopți-cameră vândute`)}
        </div>
        <div className="viz-grid">
          <div className="card viz"><div className="ch">Încasat și cheltuieli, lună de lună<span className="vz-leg"><span><i className="k s1" />Încasat</span><span><i className="k s2" />Cheltuieli</span></span></div><div className="viz-body" dangerouslySetInnerHTML={{ __html: charts.monthly }} /></div>
          <div className="card viz"><div className="ch">Venit din nopți, pe sursă<span className="cnt">{monthName(m)}</span></div><div className="viz-body" dangerouslySetInnerHTML={{ __html: charts.src }} /></div>
          <div className="card viz"><div className="ch">Încasări pe zi<span className="cnt">{monthName(m)}</span></div><div className="viz-body" dangerouslySetInnerHTML={{ __html: charts.daily }} /></div>
          <div className="card viz"><div className="ch">Ocupare pe zi<span className="cnt">{monthName(m)}</span></div><div className="viz-body" dangerouslySetInnerHTML={{ __html: charts.occ }} /></div>
        </div>
        <div className="cols">
          <div className="card"><div className="ch">Încasări pe metodă<span className="cnt">{M.lei(f.cashed)}</span></div><div className="tbl-wrap">
            <Table rows={methods} keyOf={k => k} empty="Nicio plată în lună" cols={[
              { h: 'Metodă', cell: k => METHOD[k], v: k => METHOD[k] },
              { h: 'Sumă', r: true, cell: k => M.lei(f.byMethod[k]!), v: k => f.byMethod[k]! },
              { h: 'Pondere', cell: k => <><span className="share" style={{ width: Math.round(f.byMethod[k]! / f.cashed * 80) }} />{pct(f.byMethod[k]! / f.cashed)}</>, v: k => f.byMethod[k]! },
            ]} foot={methods.length ? <tr><td>Total</td><td className="r">{M.lei(f.cashed)}</td><td /></tr> : undefined} /></div></div>
          <div className="card"><div className="ch">Pe sursă de rezervare<span className="cnt">{f.roomNights} nopți</span></div><div className="tbl-wrap">
            <Table rows={srcs} keyOf={k => k} empty="Nicio noapte vândută" cols={[
              { h: 'Sursă', cell: k => <><span className="rdot" style={{ background: `var(--src-${k}, var(--src-other))` }} />{SRC[k]}</>, v: k => SRC[k] },
              { h: 'Rezervări', r: true, cell: k => f.bySrc[k]!.res, v: k => f.bySrc[k]!.res },
              { h: 'Nopți', r: true, cell: k => f.bySrc[k]!.n, v: k => f.bySrc[k]!.n },
              { h: 'Venit', r: true, cell: k => M.lei(f.bySrc[k]!.v), v: k => f.bySrc[k]!.v },
              { h: 'Comision', r: true, cell: k => COMM[k] ? M.lei(f.bySrc[k]!.v * COMM[k]!) : '—', v: k => f.bySrc[k]!.v * (COMM[k] ?? 0) },
            ]} /></div></div>
          {!P && data.properties.length > 1 && <div className="card wide"><div className="ch">Pe proprietăți</div><div className="tbl-wrap">
            <Table rows={data.properties.map(p => ({ p, q: finMonth(data, m, p.id) }))} keyOf={x => x.p.id} cols={[
              { h: 'Proprietate', cell: x => <b>{x.p.name}</b>, v: x => x.p.name },
              { h: 'Ocupare', r: true, cell: x => pct(x.q.occ), v: x => x.q.occ },
              { h: 'Venit din nopți', r: true, cell: x => M.lei(x.q.earned), v: x => x.q.earned },
              { h: 'Încasat', r: true, cell: x => M.lei(x.q.cashed), v: x => x.q.cashed },
              { h: 'Cheltuieli', r: true, cell: x => M.lei(x.q.spent), v: x => x.q.spent },
              { h: 'Profit', r: true, cell: x => <span className={x.q.profit >= 0 ? 'pos' : 'neg'}>{M.lei(x.q.profit)}</span>, v: x => x.q.profit },
            ]} foot={<tr><td>Cheltuieli comune</td><td /><td /><td /><td className="r">{M.lei(commonExp)}</td><td /></tr>} /></div></div>}
          <div className="card wide"><div className="ch">Cheltuieli în {monthName(m).toLowerCase()}<span className="cnt">{M.lei(f.spent)}</span><button className="btn sm" onClick={() => openExp()}>+ Adaugă cheltuială</button></div><div className="tbl-wrap">
            <Table rows={exps} keyOf={e => e.id} onRow={e => openExp(e.id)} empty="Nicio cheltuială în această lună" cols={[
              { h: 'Data', cell: e => e.recurring ? 'lunar' : fmtD(e.date), v: e => e.date },
              { h: 'Categorie', cell: e => <>{e.category}{e.recurring && <span className="rec">LUNAR</span>}</>, v: e => e.category },
              { h: 'Descriere', cell: e => e.desc, v: e => e.desc, style: { whiteSpace: 'normal' } },
              { h: 'Proprietate', cell: e => e.propertyId ? data.properties.find(p => p.id === e.propertyId)?.name ?? '' : 'Comună', v: e => e.propertyId ?? '' },
              { h: 'Sumă', r: true, cell: e => M.lei(e.amount), v: e => e.amount },
              { h: '', r: true, cell: e => e.recurring ? <button className="btn sm" onClick={ev => { ev.stopPropagation(); stopRecurring(e); }}>Oprește de acum</button> : <button className="btn sm ghost" onClick={ev => { ev.stopPropagation(); delExp(e.id); }}>Șterge</button> },
            ]} foot={exps.length ? <tr><td colSpan={4}>Total</td><td className="r">{M.lei(f.spent)}</td><td /></tr> : undefined} /></div></div>
          <div className="card wide"><div className="ch">Lună de lună<span className="cnt">click pe o lună ca s-o deschizi</span></div><div className="tbl-wrap">
            <Table rows={mSeries} keyOf={x => x.m} onRow={x => { setFin({ month: x.m }); bodyRef.current?.scrollTo({ top: 0 }); }} rowClass={x => x.m === m ? 'cur' : ''} cols={[
              { h: 'Luna', cell: x => <><b>{monthName(x.m)}</b>{x.m > today.slice(0, 7) && <small style={{ color: 'var(--ink-3)' }}> în viitor</small>}</>, v: x => x.m },
              { h: 'Ocupare', r: true, cell: x => pct(x.occ), v: x => x.occ },
              { h: 'Venit din nopți', r: true, cell: x => M.lei(x.earned), v: x => x.earned },
              { h: 'Încasat', r: true, cell: x => M.lei(x.cashed), v: x => x.cashed },
              { h: 'Cheltuieli', r: true, cell: x => M.lei(x.spent), v: x => x.spent },
              { h: 'Comisioane', r: true, cell: x => M.lei(x.comm), v: x => x.comm },
              { h: 'Profit', r: true, cell: x => <span className={x.profit >= 0 ? 'pos' : 'neg'}>{M.lei(x.profit)}</span>, v: x => x.profit },
            ]} /></div></div>
          <div className="card wide"><div className="ch">Plăți încasate în {monthName(m).toLowerCase()}<span className="cnt">{pays.length}</span></div><div className="tbl-wrap">
            <Table rows={shownPays} keyOf={x => x.pm.id} onRow={x => focusRes(x.r.id)} empty="Nicio plată" cols={[
              { h: 'Data', cell: x => fmtD(x.pm.date), v: x => x.pm.date },
              { h: 'Oaspete', cell: x => <b>{resGuest(data, x.r)}</b>, v: x => resGuest(data, x.r) },
              { h: 'Cameră', cell: x => roomLabel(data, x.r), v: x => roomLabel(data, x.r) },
              { h: 'Metodă', cell: x => METHOD[x.pm.method], v: x => METHOD[x.pm.method] },
              { h: 'Notă', cell: x => x.pm.note, v: x => x.pm.note },
              { h: 'Sumă', r: true, cell: x => M.lei(x.pm.amount), v: x => x.pm.amount },
            ]} />
            {pays.length > shownPays.length && <div className="note">Afișez cele mai recente {shownPays.length} din {pays.length} plăți.</div>}</div></div>
        </div>
      </div>
      {tipHtml && <VzTip {...tipHtml} />}
    </section>
  );
}

function VzTip({ html, x, y }: { html: string; x: number; y: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x + 14, top: y + 14 });
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return; const w = el.offsetWidth, h = el.offsetHeight;
    let l = x + 14, t = y + 14; if (l + w > innerWidth - 8) l = x - w - 14; if (t + h > innerHeight - 8) t = y - h - 14; setPos({ left: l, top: t });
  }, [html, x, y]);
  useEffect(() => () => {}, []);
  return <div className="vztip" ref={ref} style={{ display: 'block', ...pos }} dangerouslySetInnerHTML={{ __html: esc('') + html }} />;
}
