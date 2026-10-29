// Trecerea de la datele de probă la cele adevărate, pe un MySQL adevărat.
import { afterAll, beforeAll, expect, it } from 'vitest';
import { tinyState } from '@/domain/fixtures';
import { type Db } from './db';
import { freshDb, resetTo } from './testdb';
import { createReservation, loadState } from './repo';
import { startClean } from './seed';

let db: Db;
beforeAll(async () => { db = await freshDb(); }, 120_000);
afterAll(() => db.close());

it('șterge rezervările, oaspeții, prețurile și cheltuielile, dar lasă vilele și camerele, gata de rezervări noi', async () => {
  const before = tinyState();
  await resetTo(db, before);
  await startClean(db);
  const s = await loadState(db);
  expect([s.reservations.length, s.guests.length, s.expenses.length, Object.keys(s.rates).length]).toEqual([0, 0, 0, 0]);
  expect([s.properties.length, s.floors.length, s.rooms.length]).toEqual([before.properties.length, before.floors.length, before.rooms.length]);
  expect((await db.query<{ n: number }>('SELECT COUNT(*) AS n FROM room_nights'))[0].n).toBe(0);
  const { reservation } = await createReservation(db, { guestName: 'Primul Oaspete', roomIds: [before.rooms[0].id], checkIn: '2030-01-10', checkOut: '2030-01-12', pax: 2, total: 400 });
  expect(reservation.roomIds).toEqual([before.rooms[0].id]);
});
