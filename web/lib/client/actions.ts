'use client';
// Actions shared by the calendar, the drawer and the menus. They read the store directly, so any component can call them.
import { useStore } from './store';
import type { Room } from '@/domain/types';
import { fmtD, money, todayIso } from '@/domain/dates';
import { STATUS } from '@/domain/labels';
import { addOutcome, conflict, conflictAny, mergeCandidate, neighbours, quickAction, remaining, resGuest, roomById, roomLabel, sortByColumns, stayPrice } from '@/domain/rules';

const S = () => useStore.getState();
const res = (id: string) => S().data?.reservations.find(r => r.id === id);

/** Same guest, same nights, rooms now side by side: join the two stays into one. */
export function offerMerge(id: string) {
  const s = S(), r = res(id); if (!s.data || !r) return;
  const o = mergeCandidate(s.data, s.view, r); if (!o) return;
  s.mergeReservations(o.id, r.id, sortByColumns(s.data, s.view, [...o.roomIds, ...r.roomIds]));
}

/** Check-in on the arrival day, check-out on the departure day, straight from the block. */
export function doQuick(id: string) {
  const s = S(), r = res(id), qa = r && quickAction(r, todayIso()); if (!s.data || !r || !qa) return;
  if (qa.status === 'checked_out' && remaining(r) > 0) { s.openDrawer(r.id); s.toast(`Rest de plată ${money(remaining(r))}. Încasează sau confirmă plecarea din sertar.`, 'bad'); return; }
  s.patchReservation(r.id, { status: qa.status }, { undoLabel: `${resGuest(s.data, r)}: ${STATUS[qa.status]}` });
}

export async function growRoom(id: string, side: 'left' | 'right') {
  const s = S(), r = res(id); if (!s.data || !r) return;
  const rm = neighbours(s.data, s.view, r)[side]; if (!rm) return;
  if (!rm.active) { s.toast(`${rm.name} este dezactivată`, 'bad'); return; }
  const c = conflict(s.data, rm.id, r.checkIn, r.checkOut, r.id); if (c) { s.toast(`${rm.name} e ocupată de ${resGuest(s.data, c)} (${fmtD(c.checkIn)} – ${fmtD(c.checkOut)})`, 'bad'); return; }
  const add = stayPrice(s.data, [rm.id], r.checkIn, r.checkOut), roomIds = side === 'right' ? [...r.roomIds, rm.id] : [rm.id, ...r.roomIds];
  const err = await s.patchReservation(r.id, { roomIds, total: Number(r.total) + add }, { undoLabel: `${resGuest(s.data, r)} ocupă acum ${roomIds.map(x => roomById(s.data!, x)?.name).join(' + ')} · +${money(add)}` });
  if (!err) offerMerge(r.id);
}

export function shrinkRoom(id: string, side: 'left' | 'right') {
  const s = S(), r = res(id); if (!s.data || !r || r.roomIds.length < 2) return;
  const sorted = sortByColumns(s.data, s.view, r.roomIds), gone = side === 'right' ? sorted.pop()! : sorted.shift()!;
  const less = stayPrice(s.data, [gone], r.checkIn, r.checkOut);
  s.patchReservation(r.id, { roomIds: sorted, total: Math.max(0, Number(r.total) - less) }, { undoLabel: `${roomById(s.data, gone)?.name} scoasă. ${resGuest(s.data, r)} rămâne pe ${sorted.map(x => roomById(s.data!, x)?.name).join(' + ')} · −${money(less)}` });
}

/** Rooms drawn while adding: next to the stay on the same nights they join it, elsewhere they become a new booking for the same guest. */
export async function finishAddRooms(id: string, rooms: Room[], inD: string, outD: string) {
  const s = S(), r = res(id); s.setAddMode(null); if (!s.data || !r || !rooms.length) return;
  if (rooms.some(x => !x.active)) { s.toast('Una dintre camere este dezactivată', 'bad'); return; }
  const o = addOutcome(s.data, s.view, r, rooms, inD, outD);
  if (o.kind === 'none') { s.toast('Desenează pe camere libere, lângă rezervare', 'bad'); return; }
  const c = o.kind === 'merge' ? conflictAny(s.data, o.ids, inD, outD, r.id) : conflictAny(s.data, o.ids, inD, outD);
  if (c) { s.toast(`${roomLabel(s.data, c)} e ocupată de ${resGuest(s.data, c)} (${fmtD(c.checkIn)} – ${fmtD(c.checkOut)})`, 'bad'); return; }
  if (o.kind === 'merge') {
    const add = stayPrice(s.data, o.ids, r.checkIn, r.checkOut), roomIds = sortByColumns(s.data, s.view, [...r.roomIds, ...o.ids]);
    const err = await s.patchReservation(r.id, { roomIds, total: Number(r.total) + add }, { undoLabel: `${resGuest(s.data, r)} are acum ${roomIds.map(x => roomById(s.data!, x)?.name).join(' + ')} · +${money(add)}` });
    if (!err) s.focusRes(r.id);
  } else {
    s.openModal({ roomIds: o.ids, checkIn: inD, checkOut: outD, guestId: r.guestId, source: r.source });
  }
}

/** Right click (or a long press) on a block. */
export function openBlockMenu(id: string, x: number, y: number) {
  const s = S(), r = res(id); if (!s.data || !r) return;
  const d = s.data, nb = neighbours(d, s.view, r), qa = quickAction(r, todayIso()), open = r.status !== 'cancelled' && r.status !== 'checked_out';
  const items = [];
  if (qa) items.push({ t: qa.label, s: STATUS[qa.status], go: () => doQuick(r.id) });
  if (open) items.push({ t: 'Adaugă camere la rezervare…', s: 'desenezi pe calendar', go: () => s.setAddMode(r.id) });
  if (nb.span > 1 && nb.last && nb.first) { items.push({ t: `Scoate ${nb.last.name}`, s: 'din dreapta', go: () => shrinkRoom(r.id, 'right') }, { t: `Scoate ${nb.first.name}`, s: 'din stânga', go: () => shrinkRoom(r.id, 'left') }); }
  items.push({ hr: true, t: '' }, { t: 'Detalii și plăți', go: () => s.openDrawer(r.id) }, { t: 'Editează', go: () => s.openModal(null, r.id) });
  if (open) items.push({ t: 'Anulează rezervarea', dng: true, go: () => { if (confirm(`Anulezi rezervarea pentru ${resGuest(d, r)}?`)) s.patchReservation(r.id, { status: 'cancelled' }, { undoLabel: `${resGuest(d, r)}: ${STATUS.cancelled}` }); } });
  s.openMenu({ x, y, title: `${resGuest(d, r)} · ${roomLabel(d, r)}`, items, minWidth: 250 });
}

/** The ⋯ on a room header or in the rooms list. */
export function openRoomMenu(roomId: string, x: number, y: number) {
  const s = S(); if (!s.data) return;
  const r = roomById(s.data, roomId); if (!r) return;
  const hasRes = s.data.reservations.some(q => q.roomIds.includes(r.id));
  s.openMenu({ x, y, items: [
    { t: '✎ Editează camera', go: () => s.openRoomModal(r.id) },
    { t: r.active ? '◌ Dezactivează' : '● Activează', go: () => s.admin('PATCH', `/api/rooms/${r.id}`, { active: !r.active }, r.active ? `${r.name} dezactivată` : `${r.name} activată`) },
    { hr: true, t: '' },
    { t: hasRes ? '🗑 Șterge (are rezervări)' : '🗑 Șterge', dng: true, disabled: hasRes, go: () => { if (confirm(`Ștergi camera ${r.name}?`)) s.admin('DELETE', `/api/rooms/${r.id}`, undefined, 'Cameră ștearsă'); } },
  ] });
}
