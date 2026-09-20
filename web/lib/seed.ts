// Demo data: the same villas, rooms, guests and bookings as velora-stay-demo.html (same random sequence).
// August is full; after that bookings thin out the further ahead they are.
import type { Db, Q } from './db';
import type { AppState, Expense, Floor, Guest, Method, Property, Rates, Reservation, Room, Source, Status } from '@/domain/types';
import { addDays, diffDays, fromIso, todayIso } from '@/domain/dates';
import { newId } from './ids';

type Pay = [number, Method, string?, string?];
interface ROpts { rooms?: string[]; total?: number; pay?: Pay[]; pax?: number; src?: Source; status?: Status; notes?: string; inv?: string }

export function buildDemo(TODAY = todayIso()): AppState {
  // deterministic pseudo-random numbers (mulberry32), so the demo looks the same every time
  let rs = 20260910;
  const rnd = () => { rs |= 0; rs = (rs + 0x6D2B79F5) | 0; let t = Math.imul(rs ^ (rs >>> 15), 1 | rs); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const plain = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  /* ---------- Guests: the regulars plus a realistic guest book ---------- */
  const g = (f: string, l: string, phone: string, email: string, country: string, notes = ''): Guest => ({ id: newId('g_'), firstName: f, lastName: l, phone, email, country, notes });
  const guests: Guest[] = [
    g('Mihai', 'Popescu', '0722 111 222', 'mihai.popescu@gmail.com', 'România', 'Vine des, preferă etajul 1.'),
    g('Andrei', 'Ionescu', '0745 333 444', 'andrei.i@yahoo.com', 'România', 'Are câine mic.'),
    g('Laura', 'Dumitrescu', '0733 555 666', 'laura.d@outlook.com', 'România'),
    g('Hans', 'Müller', '+49 170 123456', 'hans.mueller@web.de', 'Germania'),
    g('Elena', 'Georgescu', '0755 777 888', 'elena.g@gmail.com', 'România', 'Factură pe firmă: SC Alfa SRL.'),
    g('Sara', 'Rossi', '+39 333 9876543', 'sara.rossi@gmail.com', 'Italia'),
    g('Radu', 'Marin', '0766 999 000', 'radu.marin@gmail.com', 'România'),
    g('Ioana', 'Stan', '0740 222 333', 'ioana.stan@gmail.com', 'România'),
  ];
  const FN = ['Alexandru', 'Maria', 'Ion', 'Ana', 'Cristian', 'Gabriela', 'Florin', 'Daniela', 'Bogdan', 'Irina', 'Vlad', 'Diana', 'Sorin', 'Andreea', 'Adrian', 'Simona', 'Cătălin', 'Roxana', 'George', 'Alina', 'Paul', 'Oana', 'Marius', 'Bianca', 'Ștefan', 'Carmen', 'Dan', 'Iulia', 'Victor', 'Raluca'];
  const LN = ['Popa', 'Dumitru', 'Stoica', 'Gheorghe', 'Rusu', 'Munteanu', 'Matei', 'Constantin', 'Tudor', 'Dobre', 'Barbu', 'Nistor', 'Florea', 'Ene', 'Toma', 'Dinu', 'Lazăr', 'Moldovan', 'Sandu', 'Cristea', 'Neagu', 'Ungureanu', 'Voicu', 'Preda', 'Olteanu', 'Radu', 'Mocanu', 'Ilie', 'Pavel', 'Enache'];
  const seen = new Set(guests.map(x => x.firstName + x.lastName));
  while (guests.length < 148) {
    const f = pick(FN), l = pick(LN); if (seen.has(f + l)) continue; seen.add(f + l);
    guests.push(g(f, l, `07${20 + Math.floor(rnd() * 70)} ${100 + Math.floor(rnd() * 900)} ${100 + Math.floor(rnd() * 900)}`, `${plain(f)}.${plain(l)}@gmail.com`, 'România'));
  }
  ([['Julia', 'Novak', 'Cehia', '+420 601 234 567'], ['Tomasz', 'Kowalski', 'Polonia', '+48 512 345 678'], ['Emma', 'Schmidt', 'Germania', '+49 151 2345678'], ['Luca', 'Bianchi', 'Italia', '+39 347 1234567'],
    ['Anna', 'Horváth', 'Ungaria', '+36 30 123 4567'], ['Pierre', 'Martin', 'Franța', '+33 6 12 34 56 78'], ['Sophie', 'Wagner', 'Austria', '+43 664 1234567'], ['David', 'Cohen', 'Israel', '+972 52 123 4567']] as const)
    .forEach(([f, l, c, ph]) => guests.push(g(f, l, ph, `${plain(f)}.${plain(l)}@mail.com`, c)));

  /* ---------- Properties, floors, rooms ---------- */
  const properties: Property[] = [{ id: newId('p_'), name: 'Vila Duduleanu', city: 'Brașov' }, { id: newId('p_'), name: 'Vila Mateo', city: 'Râșnov' }];
  const P1 = properties[0].id, P2 = properties[1].id;
  const floors: Floor[] = [], rooms: Room[] = [];
  type RoomSpec = [string, number, string, number];
  const addFloor = (pid: string, name: string, color: string, list: RoomSpec[]) => {
    const f = { id: newId('f_'), propertyId: pid, name }; floors.push(f);
    list.forEach(([nm, cap, type, price]) => rooms.push({ id: newId('r_'), name: nm, type, capacity: cap, price, desc: '', active: true, parentId: null, propertyId: pid, floorId: f.id, color }));
  };
  // Vila Duduleanu: every floor is split between M and I; on the main floors rooms 1 and 5 take 4 people, the others 2
  const five = (lvl: number, side: string): RoomSpec[] => [1, 2, 3, 4, 5].map(k => { const big = k === 1 || k === 5; return [`${lvl}${k}${side}`, big ? 4 : 2, big ? 'Familială' : 'Dublă', big ? 400 : 250]; });
  const two = (lvl: string | number, side: string, type: string, price: number): RoomSpec[] => [1, 2].map(k => [`${lvl}${k}${side}`, 2, type, price]);
  addFloor(P1, 'Subsol M', '#5E7C8A', two('S', 'M', 'Dublă', 220));
  addFloor(P1, 'Subsol I', '#8E5A3C', two('S', 'I', 'Dublă', 220));
  addFloor(P1, 'Etaj 1 M', '#3A7BD5', five(1, 'M'));
  addFloor(P1, 'Etaj 1 I', '#0E7C86', five(1, 'I'));
  addFloor(P1, 'Etaj 2 M', '#2F8F5B', five(2, 'M'));
  addFloor(P1, 'Etaj 2 I', '#B8862B', five(2, 'I'));
  addFloor(P1, 'Etaj 3 M', '#D9761B', two(3, 'M', 'Mansardă', 280));
  addFloor(P1, 'Etaj 3 I', '#C9453A', two(3, 'I', 'Mansardă', 280));
  // Vila Mateo: room 1 and room 5 take 4 people
  addFloor(P2, 'Parter', '#6B5BD6', [1, 2, 3, 4].map((k): RoomSpec => [`P${k}`, k === 1 ? 4 : 2, k === 1 ? 'Familială' : 'Dublă', k === 1 ? 380 : 230]));
  addFloor(P2, 'Etaj 1', '#B3437C', [1, 2, 3, 4, 5].map((k): RoomSpec => { const big = k === 1 || k === 5; return [`1${k}`, big ? 4 : 2, big ? 'Familială' : 'Dublă', big ? 380 : 230]; }));
  const RM: Record<string, Room> = Object.fromEntries(rooms.map(x => [x.name, x]));

  /* ---------- Reservations ---------- */
  const R = (gi: number, room: string | Room, inOff: number, n: number, opts: ROpts = {}): Reservation => {
    const rm = typeof room === 'string' ? RM[room] : room;
    const roomIds = opts.rooms ? opts.rooms.map(x => RM[x].id) : [rm.id];
    const checkIn = addDays(TODAY, inOff), checkOut = addDays(checkIn, n);
    const total = opts.total ?? roomIds.reduce((t, id) => t + rooms.find(q => q.id === id)!.price, 0) * n;
    const payments = (opts.pay || []).map(p => ({ id: newId('pay_'), amount: p[0], method: p[1], date: p[2] ?? checkIn, note: p[3] ?? '' }));
    return { id: newId('res_'), guestId: guests[gi].id, roomIds, checkIn, checkOut, pax: opts.pax ?? Math.min(2, rm.capacity), total, source: opts.src ?? 'direct',
      status: opts.status ?? 'confirmed', kind: 'stay', notes: opts.notes ?? '', payments, extras: [], invoiceNo: opts.inv ?? '', invoiceDate: null, createdAt: '' };
  };
  const reservations: Reservation[] = [];
  const busy = (id: string, a: string, b: string) => reservations.some(x => x.status !== 'cancelled' && x.roomIds.includes(id) && a < x.checkOut && x.checkIn < b);
  const put = (r: Reservation) => { if (!r.roomIds.some(id => busy(id, r.checkIn, r.checkOut))) reservations.push(r); };
  const y = fromIso(TODAY).getFullYear(), aug1 = `${y}-08-01`, sep1 = `${y}-09-01`, horizon = addDays(TODAY, 80);
  const dated = (x: string) => x <= TODAY;

  // today at the desk: arrivals, departures, a late guest, a balance to collect
  [
    R(0, '11M', -2, 4, { status: 'checked_in', src: 'phone', pax: 3, pay: [[800, 'cash']], notes: 'Preferă micul dejun la 8:00.' }),
    R(1, '13M', -1, 3, { status: 'checked_in', src: 'booking', pay: [[750, 'card']], notes: 'Vine cu câinele. Pat suplimentar pentru copil.' }),
    R(2, '12M', 0, 2, { status: 'confirmed', src: 'direct', pay: [[200, 'transfer']] }),
    R(3, '11I', 0, 5, { status: 'confirmed', src: 'booking', pax: 3, pay: [[2000, 'card']] }),
    R(7, '12I', -1, 1, { status: 'checked_in', src: 'direct', pay: [[100, 'cash']], notes: 'Pleacă azi, rest de plată la plecare.' }),
    R(6, '13I', -1, 2, { status: 'confirmed', src: 'phone', notes: 'A sunat că ajunge târziu.' }),
    R(5, '14M', -4, 3, { status: 'checked_out', src: 'booking', pay: [[750, 'card']], inv: `VS-${y}-0141` }),
    // coming up
    R(4, '21M', 1, 3, { status: 'confirmed', src: 'phone', pax: 4, notes: 'De emis e-Factura pe SC Alfa SRL.' }),
    R(5, '15I', 2, 4, { status: 'pending', src: 'airbnb', pax: 4 }),
    R(6, '14M', 3, 2, { status: 'confirmed', src: 'direct', pay: [[500, 'cash']] }),
    R(7, '12M', 4, 3, { status: 'confirmed', src: 'direct' }),
    R(0, '23M', 5, 2, { status: 'pending', src: 'phone' }),
    R(3, '11M', 6, 3, { status: 'confirmed', src: 'booking', pay: [[1200, 'card']] }),
    R(2, '21I', 2, 2, { status: 'confirmed', src: 'direct', pay: [[500, 'card']] }),
    R(6, '14I', 7, 2, { status: 'cancelled', src: 'airbnb' }),
    R(1, '13M', 9, 4, { status: 'confirmed', src: 'direct' }),
    // one booking over several rooms side by side
    R(3, '12I', 12, 2, { status: 'confirmed', src: 'phone', rooms: ['12I', '13I'], pax: 4, total: 1000, pay: [[400, 'transfer']], notes: 'Familie cu copii, două camere alăturate, o singură plată.' }),
    R(8, '22M', 14, 2, { status: 'confirmed', src: 'direct', rooms: ['22M', '23M'], pax: 4, pay: [[250, 'transfer']], notes: 'Două familii prietene.' }),
    R(4, '12', 23, 2, { status: 'confirmed', src: 'phone', rooms: ['12', '13', '14'], pax: 6, pay: [[600, 'transfer']], notes: 'Teambuilding SC Alfa SRL, factură pe firmă.' }),
    // Vila Mateo
    R(1, 'P1', 0, 3, { status: 'checked_in', src: 'airbnb', pax: 3, pay: [[1140, 'card']] }),
    R(7, '11', 2, 4, { status: 'confirmed', src: 'booking', pax: 4, pay: [[600, 'card']] }),
    R(5, '14', -1, 2, { status: 'checked_in', src: 'direct', pay: [[460, 'cash']] }),
    R(4, 'P2', 5, 2, { status: 'pending', src: 'phone' }),
  ].forEach(put);
  // a wedding group in August, three rooms on one booking
  { const a = `${y}-08-14`, b = addDays(a, 3), st: Status = dated(b) ? 'checked_out' : dated(a) ? 'checked_in' : 'confirmed';
    put(R(9, '22I', diffDays(TODAY, a), 3, { status: st, src: 'phone', rooms: ['22I', '23I', '24I'], pax: 6, pay: [[2250, 'transfer', a]], inv: st === 'checked_out' ? `VS-${y}-0098` : '', notes: 'Nuntă, grup de 6 persoane, o singură factură.' })); }

  // August completely full; after that, random bookings that thin out the further ahead they are
  const SRCS: Source[] = ['direct', 'direct', 'booking', 'booking', 'booking', 'booking', 'travelminit', 'travelminit', 'airbnb', 'airbnb', 'phone', 'other'];
  const NOTES = ['Pat suplimentar pentru copil.', 'Sosire târzie, după ora 22.', 'Aniversare, ar vrea flori în cameră.', 'Vine cu un câine mic.', 'Factură pe firmă.', 'Pleacă devreme, la 7:00.', 'Parcare pentru două mașini.', 'Alergic la puf, perne sintetice.'];
  let inv = 142;
  rooms.forEach(rm => {
    let day = addDays(aug1, -Math.floor(rnd() * 4));
    while (day < horizon) {
      const blocking = reservations.filter(x => x.status !== 'cancelled' && x.roomIds.includes(rm.id));
      const inside = blocking.find(x => x.checkIn <= day && day < x.checkOut);
      if (inside) { day = inside.checkOut; continue; }
      if (day >= sep1) {
        const far = diffDays(TODAY, day), occ = far < 0 ? .85 : far < 20 ? .7 : far < 45 ? .5 : .32;
        if (rnd() > occ) { day = addDays(day, 1 + Math.floor(rnd() * 3)); continue; }
      }
      let out = addDays(day, day < sep1 ? 2 + Math.floor(rnd() * 4) : 1 + Math.floor(rnd() * 5));
      const next = blocking.filter(x => x.checkIn > day).sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0];
      if (next && next.checkIn < out) out = next.checkIn;
      const n = diffDays(day, out); if (n < 1) { day = addDays(day, 1); continue; }
      let st: Status = dated(out) ? 'checked_out' : dated(day) ? 'checked_in' : (rnd() < .82 ? 'confirmed' : 'pending');
      if (st !== 'checked_out' && st !== 'checked_in' && rnd() < .04) st = 'cancelled';
      const src = pick(SRCS), total = rm.price * n, method = pick<Method>(['cash', 'card', 'card', 'transfer']), pays: Pay[] = [];
      if (st === 'checked_out') pays.push([rnd() < .95 ? total : Math.round(total * .5 / 10) * 10, method, day]);
      else if (st === 'checked_in') { const q = rnd(); if (q < .5) pays.push([total, method, day]); else if (q < .85) pays.push([Math.round(total * .3 / 10) * 10, method, day]); }
      else if (st !== 'cancelled') {
        const q = rnd(), early = addDays(TODAY, -Math.floor(rnd() * 20));
        if ((src === 'booking' || src === 'airbnb') && q < .35) pays.push([total, 'card', early]);
        else if (q < .4) pays.push([Math.round(total * .3 / 10) * 10, pick<Method>(['transfer', 'cash']), early]);
      }
      const pax = rm.capacity === 4 ? 2 + Math.floor(rnd() * 3) : (rnd() < .85 ? 2 : 1);
      put(R(Math.floor(rnd() * guests.length), rm, diffDays(TODAY, day), n, { status: st, src, pax, pay: pays,
        inv: st === 'checked_out' && rnd() < .3 ? `VS-${y}-0${inv++}` : '', notes: rnd() < .08 ? pick(NOTES) : '' }));
      day = out;
    }
  });
  return { properties, floors, rooms, guests, reservations, rates: demoRates(rooms, TODAY), expenses: demoExpenses(properties, TODAY) };
}

// sample seasons: August +20%, September weekends +30 lei, November -15%
function demoRates(rooms: Room[], TODAY: string): Rates {
  const y = fromIso(TODAY).getFullYear(), out: Rates = {}, r10 = (v: number) => Math.round(v / 10) * 10;
  rooms.forEach(rm => {
    const m: Record<string, number> = {};
    for (let d = `${y}-08-01`; d <= `${y}-08-31`; d = addDays(d, 1)) m[d] = r10(rm.price * 1.2);
    for (let d = `${y}-09-01`; d <= `${y}-09-30`; d = addDays(d, 1)) { const w = fromIso(d).getDay(); if (w === 5 || w === 6) m[d] = rm.price + 30; }
    for (let d = `${y}-11-01`; d <= `${y}-11-30`; d = addDays(d, 1)) m[d] = r10(rm.price * .85);
    out[rm.id] = m;
  });
  return out;
}

// sample running costs so the finance page is not empty
function demoExpenses(props: Property[], TODAY: string): Expense[] {
  const y = fromIso(TODAY).getFullYear(), P = props.map(x => x.id), P2 = P[1] || null, m0 = `${y}-08-01`;
  const e = (date: string, category: string, desc: string, amount: number, propertyId: string | null, recurring = false): Expense => ({ id: newId('e_'), date, category, desc, amount, propertyId, recurring, until: '' });
  return [
    e(m0, 'Salarii', 'Recepție, 2 persoane', 7000, null, true),
    e(m0, 'Salarii', 'Cameriste', 5200, P[0], true),
    e(m0, 'Salarii', 'Cameristă', 2600, P2, true),
    e(m0, 'Utilități', 'Curent, gaz, apă', 3400, P[0], true),
    e(m0, 'Utilități', 'Curent, gaz, apă', 1500, P2, true),
    e(m0, 'Utilități', 'Internet și TV', 220, null, true),
    e(m0, 'Taxe și impozite', 'Contabilitate', 600, null, true),
    e(`${y}-08-06`, 'Întreținere și reparații', 'Reparație boiler etaj 2', 1250, P[0]),
    e(`${y}-08-18`, 'Consumabile', 'Lenjerie și prosoape noi', 2400, P[0]),
    e(`${y}-09-03`, 'Consumabile', 'Detergenți și cosmetice', 640, null),
    e(`${y}-09-08`, 'Marketing', 'Fotografii noi pentru Booking', 900, P2),
  ];
}

/** Multi-row INSERT in chunks, so a thousand bookings go in as a handful of statements. */
async function insertMany(q: Q, table: string, cols: string[], rows: unknown[][], chunk = 250) {
  for (let i = 0; i < rows.length; i += chunk) {
    const params: unknown[] = [];
    const values = rows.slice(i, i + chunk).map(r => '(' + r.map(v => { params.push(v); return '$' + params.length; }).join(',') + ')').join(',');
    await q(`INSERT INTO ${table} (${cols.map(c => '`' + c + '`').join(',')}) VALUES ${values}`, params);
  }
}

export async function insertState(q: Q, s: AppState) {
  await insertMany(q, 'properties', ['id', 'name', 'city', 'sort'], s.properties.map((p, i) => [p.id, p.name, p.city, i]));
  await insertMany(q, 'floors', ['id', 'property_id', 'name', 'sort'], s.floors.map((f, i) => [f.id, f.propertyId, f.name, i]));
  // parents before units, so the self-reference is satisfied
  const rooms = [...s.rooms.filter(r => !r.parentId), ...s.rooms.filter(r => r.parentId)];
  await insertMany(q, 'rooms', ['id', 'property_id', 'floor_id', 'parent_id', 'name', 'type', 'capacity', 'price', 'color', 'description', 'active', 'sort'],
    rooms.map(r => [r.id, r.propertyId, r.floorId, r.parentId, r.name, r.type, r.capacity, r.price, r.color, r.desc, r.active, s.rooms.indexOf(r)]));
  await insertMany(q, 'guests', ['id', 'first_name', 'last_name', 'phone', 'email', 'country', 'notes'],
    s.guests.map(g => [g.id, g.firstName, g.lastName, g.phone, g.email, g.country, g.notes]));
  await insertMany(q, 'reservations', ['id', 'guest_id', 'check_in', 'check_out', 'pax', 'total', 'source', 'status', 'notes', 'invoice_no', 'invoice_date'],
    s.reservations.map(r => [r.id, r.guestId, r.checkIn, r.checkOut, r.pax, r.total, r.source, r.status, r.notes, r.invoiceNo, r.invoiceDate]));
  await insertMany(q, 'reservation_rooms', ['reservation_id', 'room_id', 'position'], s.reservations.flatMap(r => r.roomIds.map((id, i) => [r.id, id, i])));
  await insertMany(q, 'payments', ['id', 'reservation_id', 'amount', 'method', 'paid_on', 'note'],
    s.reservations.flatMap(r => r.payments.map(p => [p.id, r.id, p.amount, p.method, p.date, p.note])));
  await insertMany(q, 'rates', ['room_id', 'night', 'price'], Object.entries(s.rates).flatMap(([id, m]) => Object.entries(m).map(([d, v]) => [id, d, v])), 500);
  await insertMany(q, 'expenses', ['id', 'property_id', 'category', 'description', 'amount', 'spent_on', 'recurring', 'until'],
    s.expenses.map(e => [e.id, e.propertyId, e.category, e.desc, e.amount, e.date, e.recurring, e.until || null]));
}

export async function seedDemo(db: Db) {
  const s = buildDemo();
  await db.tx(q => insertState(q, s));
  return s;
}

/** Trecerea pe date reale: vilele, etajele și camerele rămân, tot ce e inventat (rezervări, oaspeți, prețuri speciale, cheltuieli) pleacă. */
export async function startClean(db: Db) {
  await db.tx(async q => {
    for (const sql of ['DELETE FROM reservations', 'DELETE FROM rates', 'DELETE FROM expenses', 'DELETE FROM guests']) await q(sql);
  });
}

/** Empties every table and loads the demo again. */
export async function resetDemo(db: Db) {
  await db.tx(async q => {
    // rezervările duc cu ele camerele, nopțile și plățile; unitățile pleacă înaintea camerelor-părinte
    for (const sql of ['DELETE FROM reservations', 'DELETE FROM rates', 'DELETE FROM expenses', 'DELETE FROM guests',
      'DELETE FROM rooms WHERE parent_id IS NOT NULL', 'DELETE FROM rooms', 'DELETE FROM floors', 'DELETE FROM properties']) await q(sql);
  });
  return seedDemo(db);
}
