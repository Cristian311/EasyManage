'use client';
// Everything the browser keeps in memory: the data from the server, what the calendar shows, open windows, toasts.
// Changes show at once (optimistic) and go back if the server refuses them.
import { create } from 'zustand';
import type { AppState, Guest, Method, Reservation } from '@/domain/types';
import { addDays, money, todayIso } from '@/domain/dates';
import { api } from './api';

export interface View { prop: string; floor: string; start: string; extra: number; zoom: number; q: string; jump: number }
export interface ModalState { editId: string | null; pre: { roomIds?: string[]; checkIn?: string; checkOut?: string } | null }
export interface Toast { id: number; msg: string; kind: '' | 'ok' | 'bad'; action?: { label: string; run: () => void } }
export type ResPatch = Partial<Pick<Reservation, 'roomIds' | 'checkIn' | 'checkOut' | 'pax' | 'total' | 'source' | 'status' | 'notes' | 'invoiceNo' | 'guestId'>>;
export interface NewReservation {
  guestId?: string; guestName?: string; roomIds: string[]; checkIn: string; checkOut: string;
  pax: number; total: number; source: string; status: string; notes: string; advance: number;
}

interface Store {
  data: AppState | null;
  loadError: string | null;
  view: View;
  drawerId: string | null;
  modal: ModalState | null;
  toasts: Toast[];
  focus: boolean;
  collapsed: boolean;
  load(): Promise<void>;
  setView(p: Partial<View>): void;
  jumpTo(d: string): void;
  openDrawer(id: string): void;
  closeDrawer(): void;
  openModal(pre?: ModalState['pre'], editId?: string | null): void;
  closeModal(): void;
  toast(msg: string, kind?: Toast['kind'], action?: Toast['action'], ms?: number): void;
  dismiss(id: number): void;
  setFocus(on: boolean): void;
  setCollapsed(on: boolean): void;
  createReservation(x: NewReservation): Promise<string | null>;
  patchReservation(id: string, patch: ResPatch, opts?: { undoLabel?: string; quiet?: boolean }): Promise<string | null>;
  addPayment(id: string, amount: number, method: Method): Promise<string | null>;
  deleteReservation(id: string): Promise<void>;
  resetDemo(): Promise<void>;
}

const VIEW_KEY = 'velora-view';
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
    toasts: [],
    focus: false,
    collapsed: false,

    async load() {
      try { const saved = JSON.parse(localStorage.getItem(VIEW_KEY) || 'null'); if (saved) set(s => ({ view: { ...s.view, ...saved } })); } catch {}
      try { set({ data: await api<AppState>('/api/state'), loadError: null }); }
      catch (e) { set({ loadError: (e as Error).message }); }
    },
    setView(p) { const v = { ...get().view, ...p }; set({ view: v }); saveView(v); },
    jumpTo(d) { set(s => ({ view: { ...s.view, start: addDays(d, -2), extra: 0, jump: s.view.jump + 1 } })); },
    openDrawer(id) { set({ drawerId: id }); },
    closeDrawer() { set({ drawerId: null }); },
    openModal(pre = null, editId = null) { set({ modal: { pre, editId }, drawerId: null }); },
    closeModal() { set({ modal: null }); },
    toast(msg, kind = '', action, ms = action ? 6000 : 2800) {
      const id = ++toastSeq; set(s => ({ toasts: [...s.toasts, { id, msg, kind, action }] }));
      setTimeout(() => get().dismiss(id), ms);
    },
    dismiss(id) { set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })); },
    setFocus(on) { set({ focus: on }); },
    setCollapsed(on) { set({ collapsed: on }); },

    async createReservation(x) {
      try {
        const { reservation, guest } = await api<{ reservation: Reservation; guest: Guest | null }>('/api/reservations', 'POST', x);
        set(s => s.data ? { data: { ...s.data, reservations: [...s.data.reservations, reservation], guests: guest ? [...s.data.guests, guest] : s.data.guests } } : {});
        return null;
      } catch (e) { return (e as Error).message; }
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

    async resetDemo() {
      try { set({ data: await api<AppState>('/api/demo/reset', 'POST'), drawerId: null }); get().toast('Datele demo au fost încărcate din nou', 'ok'); }
      catch (e) { get().toast((e as Error).message, 'bad'); }
    },
  };
});

/** The data, once loaded; pages are only shown after that. */
export const useData = () => useStore(s => s.data) as AppState;
