// Camerele scoase din vânzare, pe un MySQL adevărat.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { tinyState } from '@/domain/fixtures';
import { BLOCK_GUEST } from '@/domain/register';
import { type Db } from './db';
import { freshDb, resetTo } from './testdb';
import { DomainError } from './errors';
import { createBlock, deleteBlock } from './blocks';
import { createReservation, loadState, updateReservation } from './repo';

let db: Db;
beforeAll(async () => { db = await freshDb(); }, 120_000);
afterAll(() => db.close());
beforeEach(() => resetTo(db, tinyState()));

const ROOM = 'r4';
const status = async (p: Promise<unknown>) => { try { await p; return 200; } catch (e) { return e instanceof DomainError ? e.status : 500; } };
const block = (over: Record<string, unknown> = {}) => createBlock(db, { roomIds: [ROOM], checkIn: '2030-03-10', checkOut: '2030-03-14', reason: 'zugrăvit', ...over });

describe('blocarea unei camere', () => {
  it('se face pe oaspetele tehnic, cu zero lei și motivul la observații', async () => {
    const { reservation } = await block();
    expect(reservation).toMatchObject({ kind: 'block', guestId: BLOCK_GUEST, total: 0, notes: 'zugrăvit', roomIds: [ROOM], status: 'confirmed' });
    const s = await loadState(db);
    expect(s.reservations.find(r => r.id === reservation.id)!.kind).toBe('block');
  });

  it('camera blocată nu mai poate fi dată nimănui în zilele acelea, dar e liberă înainte și după', async () => {
    await block();
    expect(await status(createReservation(db, { guestName: 'Vrea Camera', roomIds: [ROOM], checkIn: '2030-03-12', checkOut: '2030-03-16', pax: 2, total: 400 }))).toBe(409);
    expect(await status(createReservation(db, { guestName: 'Dupa', roomIds: [ROOM], checkIn: '2030-03-14', checkOut: '2030-03-16', pax: 2, total: 400 }))).toBe(200);
    expect(await status(createReservation(db, { guestName: 'Inainte', roomIds: [ROOM], checkIn: '2030-03-08', checkOut: '2030-03-10', pax: 2, total: 400 }))).toBe(200);
  });

  it('nu se poate bloca o cameră deja rezervată', async () => {
    await createReservation(db, { guestName: 'Era Deja', roomIds: [ROOM], checkIn: '2030-03-11', checkOut: '2030-03-13', pax: 2, total: 400 });
    expect(await status(block())).toBe(409);
  });

  it('cere un motiv, camere adevărate și date cu noimă', async () => {
    expect(await status(block({ reason: '   ' }))).toBe(400);
    expect(await status(block({ roomIds: [] }))).toBe(400);
    expect(await status(block({ roomIds: ['nu_exista'] }))).toBe(400);
    expect(await status(block({ checkOut: '2030-03-10' }))).toBe(400);
  });

  it('se scoate de tot și camera redevine liberă', async () => {
    const { reservation } = await block();
    await deleteBlock(db, reservation.id);
    expect((await loadState(db)).reservations.some(r => r.id === reservation.id)).toBe(false);
    expect(await status(createReservation(db, { guestName: 'Acum Se Poate', roomIds: [ROOM], checkIn: '2030-03-10', checkOut: '2030-03-14', pax: 2, total: 400 }))).toBe(200);
    expect(await status(deleteBlock(db, reservation.id))).toBe(404);
  });

  it('„scoate blocarea” nu poate șterge o rezervare adevărată', async () => {
    const { reservation } = await createReservation(db, { guestName: 'Om Adevarat', roomIds: [ROOM], checkIn: '2030-04-01', checkOut: '2030-04-03', pax: 2, total: 400 });
    expect(await status(deleteBlock(db, reservation.id))).toBe(400);
    expect((await loadState(db)).reservations.some(r => r.id === reservation.id)).toBe(true);
  });

  it('o rezervare obișnuită rămâne ședere, chiar și după ce e schimbată', async () => {
    const { reservation } = await createReservation(db, { guestName: 'Om', roomIds: [ROOM], checkIn: '2030-05-01', checkOut: '2030-05-03', pax: 2, total: 400 });
    expect(reservation.kind).toBe('stay');
    const { reservation: after } = await updateReservation(db, reservation.id, { total: 500 });
    expect(after.kind).toBe('stay');
  });
});
