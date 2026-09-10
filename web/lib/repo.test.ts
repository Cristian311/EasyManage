// Runs against a real PostgreSQL (PGlite in memory): the schema, the triggers and the double-booking constraint.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addDays, todayIso } from '@/domain/dates';
import { createDb, type Db } from './db';
import { seedDemo } from './seed';
import { addPayment, createReservation, loadState, updateReservation } from './repo';
import { DomainError, isRoomTaken } from './errors';

let db: Db;
let roomA: string, roomB: string, guestId: string;
const far = addDays(todayIso(), 400);   // nights nobody has booked

beforeAll(async () => {
  db = await createDb('memory://');
  await seedDemo(db);
  const s = await loadState(db);
  [roomA, roomB] = s.rooms.filter(r => r.capacity === 2).map(r => r.id);
  guestId = s.guests[0].id;
});
afterAll(() => db.close());

const book = (over: Record<string, unknown> = {}) => createReservation(db, { guestId, roomIds: [roomA], checkIn: far, checkOut: addDays(far, 3), pax: 2, total: 600, ...over });
const status = async (p: Promise<unknown>) => { try { await p; return 200; } catch (e) { return e instanceof DomainError ? e.status : 500; } };

describe('database', () => {
  it('loads the demo: two villas, 37 rooms, a full August', async () => {
    const s = await loadState(db);
    expect(s.properties.map(p => p.name)).toEqual(['Vila Duduleanu', 'Vila Mateo']);
    expect(s.rooms).toHaveLength(37);
    expect(s.reservations.length).toBeGreaterThan(800);
    expect(s.reservations.every(r => r.roomIds.length >= 1)).toBe(true);
  });

  it('creates a booking with a new guest and an advance', async () => {
    const { reservation, guest } = await book({ guestId: undefined, guestName: 'Test Oaspete', advance: 200, checkIn: addDays(far, 50), checkOut: addDays(far, 52) });
    expect(guest?.lastName).toBe('Oaspete');
    expect(reservation.payments[0].amount).toBe(200);
  });

  it('refuses an overlap with a message, allows back-to-back', async () => {
    const { reservation } = await book();
    expect(await status(book({ checkIn: addDays(far, 2), checkOut: addDays(far, 4) }))).toBe(409);
    await expect(book({ checkIn: addDays(far, 1), checkOut: addDays(far, 2) })).rejects.toThrow(/este ocupată de/);
    expect(await status(book({ checkIn: addDays(far, 3), checkOut: addDays(far, 5) }))).toBe(200);
    // moving to another room and other nights in one step
    const moved = await updateReservation(db, reservation.id, { roomIds: [roomB], checkIn: addDays(far, 10), checkOut: addDays(far, 12) });
    expect(moved.reservation.roomIds).toEqual([roomB]);
    // the old nights are free again
    expect(await status(book({ checkIn: far, checkOut: addDays(far, 1) }))).toBe(200);
  });

  it('a cancelled booking frees the room; bringing it back checks again', async () => {
    const { reservation } = await book({ roomIds: [roomB], checkIn: addDays(far, 20), checkOut: addDays(far, 22) });
    await updateReservation(db, reservation.id, { status: 'cancelled' });
    const other = await book({ roomIds: [roomB], checkIn: addDays(far, 20), checkOut: addDays(far, 21) });
    expect(other.reservation.id).toBeTruthy();
    expect(await status(updateReservation(db, reservation.id, { status: 'confirmed' }))).toBe(409);
  });

  it('the database itself refuses a double booking, even without the app check', async () => {
    const { reservation } = await book({ roomIds: [roomA], checkIn: addDays(far, 30), checkOut: addDays(far, 33) });
    const s = await loadState(db);
    const gid = s.guests[1].id;
    let err: unknown = null;
    try {
      await db.tx(async q => {
        await q(`INSERT INTO reservations (id, guest_id, check_in, check_out, pax, total) VALUES ('x_sql', $1, $2, $3, 2, 100)`, [gid, addDays(far, 31), addDays(far, 32)]);
        await q(`INSERT INTO reservation_rooms (reservation_id, room_id) VALUES ('x_sql', $1)`, [roomA]);
      });
    } catch (e) { err = e; }
    expect(isRoomTaken(err)).toBe(true);
    expect(reservation.id).toBeTruthy();
  });

  it('records payments and rejects nonsense', async () => {
    const { reservation } = await book({ checkIn: addDays(far, 40), checkOut: addDays(far, 41) });
    const r = await addPayment(db, reservation.id, { amount: 150, method: 'card' });
    expect(r.reservation.payments.map(p => p.amount)).toEqual([150]);
    expect(await status(addPayment(db, reservation.id, { amount: -5 }))).toBe(400);
    expect(await status(book({ checkIn: addDays(far, 45), checkOut: addDays(far, 45) }))).toBe(400);
  });
});
