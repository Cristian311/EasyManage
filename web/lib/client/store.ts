'use client';
// Everything the browser keeps in memory: the data from the server, what the calendar shows, open windows, toasts.
// Changes show at once (optimistic) and go back if the server refuses them.
import { create } from 'zustand';
import type { AppState, Expense, Guest, Invoice, InvoiceCustomer, InvoiceLine, Method, Rates, Reservation, Settings } from '@/domain/types';
import { addDays, money, todayIso } from '@/domain/dates';
import { invoiceNo } from '@/domain/invoice';
import { api } from './api';

export interface View { prop: string; floor: string; start: string; extra: number; zoom: number; q: string; jump: number }
export interface ModalPre { roomIds?: string[]; checkIn?: string; checkOut?: string; guestId?: string; source?: string }
export interface ModalState { editId: string | null; pre: ModalPre | null }
export interface Toast { id: number; msg: string; kind: '' | 'ok' | 'bad'; action?: { label: string; run: () => void }; sticky?: boolean }
export interface MenuItem { t: string; s?: string; dng?: boolean; hr?: boolean; disabled?: boolean; room?: string; go?: () => void }
export interface MenuState { x: number; y: number; title?: string; items: MenuItem[]; minWidth?: number }
export interface Fin { month: string; prop: string; cur: 'RON' | 'EUR'; rate: number }
export type ResPatch = Partial<Pick<Reservation, 'roomIds' | 'checkIn' | 'checkOut' | 'pax' | 'total' | 'source' | 'status' | 'notes' | 'invoiceNo' | 'guestId'>>;
export interface NewReservation {
  guestId?: string; guestName?: string; roomIds: string[]; checkIn: string; checkOut: string;
  pax: number; total: number; source: string; status: string; notes: string; advance: number;
}
export interface RoomFields { name: string; type: string; capacity: number; price: number; color: string; desc: string; active: boolean; propertyId: string; floorId: string | null }
export interface ExpenseFields { amount: number; date: string; category: string; desc: string; propertyId: string | null; recurring: boolean; until?: string }
export interface NewInvoice { reservationId: string | null; issuedOn: string; dueOn: string | null; customer: InvoiceCustomer; lines: InvoiceLine[]; notes: string }

interface Store {
  data: AppState | null;
  loadError: string | null;
  view: View;
  drawerId: string | null;
  modal: ModalState | null;
  roomModal: { editId: string | null } | null;
  expModal: { editId: string | null } | null;
  invModal: { reservationId: string | null } | null;
  menu: MenuState | null;
  toasts: Toast[];
  focus: boolean;
  menuOpen: boolean;           // the menu held open by the button, on pages where it is only a rail (the calendar)
  addMode: string | null;      // reservation that is getting extra rooms drawn onto it
  flashId: string | null;
  fin: Fin;
  load(): Promise<void>;
  setData(d: AppState): void;
  setView(p: Partial<View>): void;
  jumpTo(d: string): void;
  focusRes(id: string): void;
  openDrawer(id: string): void;
  closeDrawer(): void;
  openModal(pre?: ModalPre | null, editId?: string | null): void;
  closeModal(): void;
  openRoomModal(editId?: string | null): void;
  closeRoomModal(): void;
  openExpModal(editId?: string | null): void;
  closeExpModal(): void;
  openInvModal(reservationId?: string | null): void;
  closeInvModal(): void;
  openMenu(m: MenuState): void;
  closeMenu(): void;
  toast(msg: string, kind?: Toast['kind'], action?: Toast['action'], ms?: number): number;
  dismiss(id: number): void;
  setFocus(on: boolean): void;
  setMenuOpen(on: boolean): void;
  setAddMode(id: string | null): void;
  setFin(p: Partial<Fin>): void;
  createReservation(x: NewReservation): Promise<{ error: string | null; id?: string }>;
  patchReservation(id: string, patch: ResPatch, opts?: { undoLabel?: string; quiet?: boolean }): Promise<string | null>;
  mergeReservations(keepId: string, otherId: string, roomIds: string[]): Promise<void>;
  addPayment(id: string, amount: number, method: Method): Promise<string | null>;
  deleteReservation(id: string): Promise<void>;
  setRates(roomIds: string[], from: string, to: string, price: number | null, wkOnly: boolean, label: string): Promise<void>;
  admin(method: 'POST' | 'PATCH' | 'DELETE' | 'PUT', url: string, body?: unknown, okMsg?: string): Promise<string | null>;
  saveExpense(id: string | null, x: ExpenseFields): Promise<string | null>;
  deleteExpense(id: string, undoable?: boolean): Promise<void>;
  saveSettings(x: Settings): Promise<string | null>;
  createInvoice(x: NewInvoice): Promise<{ error: string | null; invoice?: Invoice }>;
  cancelInvoice(id: string): Promise<void>;
  resetDemo(): Promise<void>;
}

const VIEW_KEY = 'velora-view', FIN_KEY = 'velora-fin';
let toastSeq = 0;

export const useStore = create<Store>((set, get) => {
  const replace = (r: Reservation) => set(s => s.data ? { data: { ...s.data, reservations: s.data.reservations.map(x => (x.id === r.id ? r : x)) } } : {});
  const saveView = (v: View) => { try { localStorage.setItem(VIEW_KEY, JSON.stringify({ prop: v.prop, floor: v.floor, zoom: v.zoom })); } catch {} };

  return {
    data: null,
    loadError: null,
    view: { prop: 'all', floor: 'all', start: addDays(todayIso(), -2), extra: 0, zoom: 1, q: '', jump: 0 },
    drawerId: null,
    modal: null,
    roomModal: null,
    expModal: null,
    invModal: null,
    menu: null,
    toasts: [],
    focus: false,
    menuOpen: false,
    addMode: null,
    flashId: null,
    fin: { month: todayIso().slice(0, 7), prop: 'all', cur: 'RON', rate: 5.09 },

    async load() {
      try { const saved = JSON.parse(localStorage.getItem(VIEW_KEY) || 'null'); if (saved) set(s => ({ view: { ...s.view, ...saved } })); } catch {}
      try { const f = JSON.parse(localStorage.getItem(FIN_KEY) || 'null'); if (f) set(s => ({ fin: { ...s.fin, cur: f.cur === 'EUR' ? 'EUR' : 'RON', rate: f.rate > 0 ? f.rate : s.fin.rate } })); } catch {}
      try { set({ data: await api<AppState>('/api/state'), loadError: null }); }
      catch (e) { set({ loadError: (e as Error).message }); }
    },
    setData(d) { set({ data: d }); },
    setView(p) { const v = { ...get().view, ...p }; set({ view: v }); saveView(v); },
    jumpTo(d) { set(s => ({ view: { ...s.view, start: addDays(d, -2), extra: 0, jump: s.view.jump + 1 } })); },
    focusRes(id) {
      const r = get().data?.reservations.find(x => x.id === id); if (!r) return;
      const v = get().view, end = addDays(v.start, 14);
      if (r.checkIn < v.start || r.checkIn >= end) get().jumpTo(r.checkIn);
      set({ drawerId: id, flashId: id }); setTimeout(() => set(s => (s.flashId === id ? { flashId: null } : {})), 1400);
    },
    openDrawer(id) { set({ drawerId: id }); },
    closeDrawer() { set({ drawerId: null }); },
    openModal(pre = null, editId = null) { set({ modal: { pre, editId }, drawerId: null }); },
    closeModal() { set({ modal: null }); },
    openRoomModal(editId = null) { set({ roomModal: { editId } }); },
    closeRoomModal() { set({ roomModal: null }); },
    openExpModal(editId = null) { set({ expModal: { editId } }); },
    closeExpModal() { set({ expModal: null }); },
    openInvModal(reservationId = null) { set({ invModal: { reservationId } }); },
    closeInvModal() { set({ invModal: null }); },
    openMenu(m) { set({ menu: m }); },
    closeMenu() { set({ menu: null }); },
    toast(msg, kind = '', action, ms = action ? 6000 : 2800) {
      const id = ++toastSeq; set(s => ({ toasts: [...s.toasts, { id, msg, kind, action }] }));
      if (ms > 0) setTimeout(() => get().dismiss(id), ms);
      return id;
    },
    dismiss(id) { set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })); },
    setFocus(on) { set({ focus: on }); },
    setMenuOpen(on) { set({ menuOpen: on }); },
    setAddMode(id) { set({ addMode: id, drawerId: id ? null : get().drawerId }); },
    setFin(p) { const fin = { ...get().fin, ...p }; set({ fin }); try { localStorage.setItem(FIN_KEY, JSON.stringify({ cur: fin.cur, rate: fin.rate })); } catch {} },

    async createReservation(x) {
      try {
        const { reservation, guest } = await api<{ reservation: Reservation; guest: Guest | null }>('/api/reservations', 'POST', x);
        set(s => s.data ? { data: { ...s.data, reservations: [...s.data.reservations, reservation], guests: guest ? [...s.data.guests, guest] : s.data.guests } } : {});
        return { error: null, id: reservation.id };
      } catch (e) { return { error: (e as Error).message }; }
    },

    async patchReservation(id, patch, opts = {}) {
      const prev = get().data?.reservations.find(r => r.id === id);
      if (!prev) return 'Rezervarea nu mai există.';
      replace({ ...prev, ...patch });
      try {
        const { reservation } = await api<{ reservation: Reservation }>(`/api/reservations/${id}`, 'PATCH', patch);
        replace(reservation);
        if (opts.undoLabel) {
          const back = Object.fromEntries(Object.keys(patch).map(k => [k, prev[k as keyof Reservation]])) as ResPatch;
          get().toast(opts.undoLabel, 'ok', { label: 'Anulează', run: () => { get().patchReservation(id, back).then(err => { if (!err) get().toast('Anulat'); }); } });
        }
        return null;
      } catch (e) {
        replace(prev);
        const m = (e as Error).message;
        if (!opts.quiet) get().toast(m, 'bad');
        return m;
      }
    },

    async mergeReservations(keepId, otherId, roomIds) {
      try {
        const { reservation, removedId } = await api<{ reservation: Reservation; removedId: string }>(`/api/reservations/${keepId}/merge`, 'POST', { otherId, roomIds });
        set(s => s.data ? { data: { ...s.data, reservations: s.data.reservations.filter(r => r.id !== removedId).map(r => (r.id === reservation.id ? reservation : r)) }, drawerId: s.drawerId === removedId ? reservation.id : s.drawerId } : {});
        const d = get().data!, names = reservation.roomIds.map(id => d.rooms.find(r => r.id === id)?.name).join(' + ');
        get().toast(`Combinat într-o singură rezervare: ${names}, ${money(reservation.total)}`, 'ok');
      } catch (e) { get().toast((e as Error).message, 'bad'); }
    },

    async addPayment(id, amount, method) {
      try {
        const { reservation } = await api<{ reservation: Reservation }>(`/api/reservations/${id}/payments`, 'POST', { amount, method });
        replace(reservation); get().toast(`Încasat ${money(amount)}`, 'ok'); return null;
      } catch (e) { const m = (e as Error).message; get().toast(m, 'bad'); return m; }
    },

    async deleteReservation(id) {
      try {
        await api(`/api/reservations/${id}`, 'DELETE');
        set(s => s.data ? { data: { ...s.data, reservations: s.data.reservations.filter(r => r.id !== id) }, drawerId: null } : {});
        get().toast('Rezervare ștearsă');
      } catch (e) { get().toast((e as Error).message, 'bad'); }
    },

    async setRates(roomIds, from, to, price, wkOnly, label) {
      const before = get().data?.rates ?? {};
      const snap: Rates = Object.fromEntries(roomIds.map(id => [id, { ...(before[id] ?? {}) }]));
      try {
        const { rates } = await api<{ rates: Rates }>('/api/rates', 'PUT', { roomIds, from, to, price, wkOnly });
        set(s => s.data ? { data: { ...s.data, rates: { ...s.data.rates, ...rates } } } : {});
        get().toast(label, 'ok', { label: 'Anulează', run: async () => {
          // put back every night of those rooms exactly as it was
          try {
            await api('/api/rates', 'PUT', { roomIds, from, to, price: null, wkOnly: false });
            for (const id of roomIds) for (const [d, v] of Object.entries(snap[id])) if (d >= from && d <= to) await api('/api/rates', 'PUT', { roomIds: [id], from: d, to: d, price: v, wkOnly: false });
            set(s => s.data ? { data: { ...s.data, rates: { ...s.data.rates, ...snap } } } : {}); get().toast('Anulat');
          } catch (e) { get().toast((e as Error).message, 'bad'); }
        } });
      } catch (e) { get().toast((e as Error).message, 'bad'); }
    },

    async admin(method, url, body, okMsg) {
      try { set({ data: await api<AppState>(url, method, body) }); if (okMsg) get().toast(okMsg, 'ok'); return null; }
      catch (e) { const m = (e as Error).message; get().toast(m, 'bad'); return m; }
    },

    async saveExpense(id, x) {
      try {
        const { expense } = await api<{ expense: Expense }>(id ? `/api/expenses/${id}` : '/api/expenses', id ? 'PATCH' : 'POST', x);
        set(s => s.data ? { data: { ...s.data, expenses: id ? s.data.expenses.map(e => (e.id === id ? expense : e)) : [...s.data.expenses, expense] } } : {});
        return null;
      } catch (e) { const m = (e as Error).message; get().toast(m, 'bad'); return m; }
    },
    async deleteExpense(id, undoable = true) {
      const x = get().data?.expenses.find(e => e.id === id); if (!x) return;
      try {
        await api(`/api/expenses/${id}`, 'DELETE');
        set(s => s.data ? { data: { ...s.data, expenses: s.data.expenses.filter(e => e.id !== id) } } : {});
        if (undoable) get().toast(`Cheltuială ștearsă: ${x.desc || x.category}`, '', { label: 'Anulează', run: () => { get().saveExpense(null, { amount: x.amount, date: x.date, category: x.category, desc: x.desc, propertyId: x.propertyId, recurring: x.recurring, until: x.until }); } });
      } catch (e) { get().toast((e as Error).message, 'bad'); }
    },

    async saveSettings(x) {
      try {
        const { settings } = await api<{ settings: Settings }>('/api/settings', 'PUT', x);
        set(s => s.data ? { data: { ...s.data, settings } } : {}); get().toast('Setările au fost salvate', 'ok'); return null;
      } catch (e) { const m = (e as Error).message; get().toast(m, 'bad'); return m; }
    },

    async createInvoice(x) {
      try {
        const { invoice, reservation } = await api<{ invoice: Invoice; reservation: Reservation | null }>('/api/invoices', 'POST', x);
        set(s => s.data ? { data: { ...s.data, invoices: [...s.data.invoices, invoice], settings: { ...s.data.settings, invoiceNext: invoice.number + 1 } } } : {});
        if (reservation) replace(reservation);
        get().toast(`Factura ${invoiceNo(invoice)} a fost emisă`, 'ok');
        return { error: null, invoice };
      } catch (e) { const m = (e as Error).message; get().toast(m, 'bad'); return { error: m }; }
    },

    async cancelInvoice(id) {
      try {
        const { invoice, reservation } = await api<{ invoice: Invoice; reservation: Reservation | null }>(`/api/invoices/${id}`, 'PATCH', { status: 'cancelled' });
        set(s => s.data ? { data: { ...s.data, invoices: s.data.invoices.map(i => (i.id === id ? invoice : i)) } } : {});
        if (reservation) replace(reservation);
        get().toast(`Factura ${invoiceNo(invoice)} a fost anulată`);
      } catch (e) { get().toast((e as Error).message, 'bad'); }
    },

    async resetDemo() {
      try { set({ data: await api<AppState>('/api/demo/reset', 'POST'), drawerId: null }); get().toast('Datele demo au fost încărcate din nou', 'ok'); }
      catch (e) { get().toast((e as Error).message, 'bad'); }
    },
  };
});

/** The data, once loaded; pages are only shown after that. */
export const useData = () => useStore(s => s.data) as AppState;
