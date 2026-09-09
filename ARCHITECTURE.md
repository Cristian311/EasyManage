# Velora Stay – propunere de arhitectură (MVP)

## 1. Ce există acum

Un singur fișier, `index.html`: prototip cu Tailwind CDN, tape chart vertical (zile pe Y, camere pe X),
drag & drop nativ HTML5, două modale, date fixe în memorie. Nu există backend, bază de date sau autentificare.

Ce merită păstrat din prototip: **orientarea verticală a calendarului** și ideea de „blocuri peste grilă”.
Restul a fost reconstruit în `velora-stay-demo.html` (UI nou, pointer events în loc de HTML5 DnD, date reale,
verificare de suprapunere, camere împărțite în unități, sertar de detalii, plăți, dashboard).

Demo-ul este intenționat vanilla JS într-un singur fișier, ca să se deschidă fără build. Logica de domeniu din el
(funcțiile `conflict`, `columns`, `paid`, `remaining`, `payStatus`) se mută 1:1 pe backend.

## 2. Stack recomandat

| Strat | Alegere | De ce |
|---|---|---|
| Frontend + API | **Next.js 15 (App Router, TypeScript)** | Un singur repo și un singur deploy. Route handlers sub `/app/api/**` dau exact REST-ul din specificație. |
| UI | Tailwind v4 + componente proprii (nu shadcn în bloc) | Tokenii de culoare și tape chart-ul din demo se portează direct. |
| State server | TanStack Query | Cache + optimistic update la drag & drop (blocul se mută instant, revine dacă API-ul refuză). |
| Validare | Zod | Aceleași scheme folosite în formular și în API. |
| DB | **PostgreSQL** | Avem nevoie de `EXCLUDE` constraint pentru double booking (vezi mai jos). |
| ORM | Drizzle | SQL explicit, migrații simple, tipuri generate. |
| Auth | Auth.js (credentials + sesiune în DB) sau Lucia-style custom | Parole cu argon2, cookie httpOnly/secure, reset prin token. 2FA se adaugă ca pas suplimentar în login fără schimbări de schemă. |
| Hosting | Vercel + Neon/Supabase Postgres, sau un VPS cu Docker | Ambele merg identic pentru MVP. |

Alternativa dacă preferi separare strictă: React + Vite pentru UI și Fastify pentru API. Costă un repo și un deploy în plus
fără câștig real la această dimensiune. Recomandarea rămâne Next.js.

## 3. Straturi

```
app/(ui)            pagini, componente, tape chart
app/api/**          route handlers: validare Zod, auth, apel serviciu, cod HTTP
server/services/**  reguli de business (disponibilitate, calcul sold, tranziții de status)
server/db/**        schema Drizzle, migrații, repository-uri
```

Regula de aur: **orice route handler primește `ctx = { userId, organizationId, propertyId }` derivat din sesiune**,
niciodată din body/query. Toate query-urile filtrează după `organization_id` din `ctx`.

## 4. Schema bazei de date

```
users               id, email (unique), password_hash, name, created_at
organizations       id, name, created_at
organization_members organization_id, user_id, role ('owner'|'staff'), PK(org, user)
properties          id, organization_id, name, address, city, country, phone, email, tax_id,
                    currency ('RON'), check_in_time, check_out_time
room_types          id, property_id, name, default_capacity, default_price
rooms               id, property_id, room_type_id, name, capacity, price, description,
                    is_active, parent_room_id (NULL = cameră normală; altfel = unitate a unei camere împărțite),
                    sort_order
guests              id, organization_id, first_name, last_name, phone, email, country, notes
reservations        id, property_id, room_id, guest_id, check_in (date), check_out (date), pax,
                    total_price (numeric), source, status, notes, created_by, created_at, updated_at
payments            id, reservation_id, amount, method, paid_at, note, created_by
invoices            id, reservation_id, organization_id, number, issued_at, customer_name,
                    customer_tax_id, total, status ('draft'|'issued'|'cancelled'), efactura_id (NULL)
audit_logs          id, organization_id, user_id, action, entity, entity_id, payload (jsonb), created_at
password_resets     token_hash, user_id, expires_at
sessions            id, user_id, expires_at
```

`amount_paid`, `remaining_balance` și `payment_status` **nu se stochează**: se calculează din `payments`.
Așa nu pot ajunge niciodată desincronizate.

### Prevenirea double booking la nivel de DB

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE reservations ADD CONSTRAINT no_overlap
  EXCLUDE USING gist (
    room_id WITH =,
    daterange(check_in, check_out, '[)') WITH &&
  ) WHERE (status <> 'cancelled');
```

Serviciul verifică întâi și întoarce un 409 prietenos („Camera 102 este ocupată de Popescu, 10–13 sep”),
iar constraint-ul prinde orice condiție de cursă. Intervalul `[)` permite check-out și check-in în aceeași zi.

### Camere împărțite (split)

O cameră cu `parent_room_id` este o unitate. Regulile din demo se păstrează:
- calendarul afișează unitățile în locul părintelui, grupate sub antetul lui;
- rezervările se fac pe unități;
- „unește” reușește doar dacă rezervările active de pe unități nu se suprapun între ele.

## 5. API

Exact lista din specificație, plus câteva necesare calendarului:

```
GET  /api/calendar?from=2026-09-07&to=2026-09-21   camere + rezervări din interval, un singur request
PATCH /api/reservations/:id/move                      { roomId, checkIn, checkOut }  → 200 sau 409
POST /api/reservations/:id/status                     { status }  (validează tranzițiile)
POST /api/rooms/:id/split                             { count, labels[], price }
POST /api/rooms/:id/merge
PATCH /api/rooms/reorder                              { ids[] }
```

Erori: `400` validare (Zod, cu câmpuri), `401` neautentificat, `403` alt tenant, `404` inexistent în tenant,
`409` suprapunere / cameră cu rezervări la ștergere, `429` rate limit pe `/api/auth/*`.

## 6. Faze de implementare

1. **Schelet + auth + onboarding** – proiect Next.js, Drizzle, migrații, register/login/logout/reset,
   creare organizație și proprietate. Test: doi utilizatori din organizații diferite nu-și văd datele.
2. **Camere** – CRUD, activ/inactiv, split/merge, reordonare. Ștergere refuzată dacă are rezervări.
3. **Oaspeți + rezervări + calendar** – portarea tape chart-ului din demo pe date din API, drag & drop cu
   optimistic update, modalul de rezervare cu căutare de oaspete, constraint-ul de suprapunere.
4. **Plăți + sertar + Azi** – plăți multiple, sold calculat, check-in/check-out, dashboard.
5. **Facturi + audit log + polish** – registru de facturi, audit pe evenimentele importante, responsive,
   rate limiting, teste pe servicii.

Fiecare fază se termină cu: migrații rulate, endpoint-uri verificate, UI legat, verificare izolare tenant.

## 7. Ce lăsăm explicit pe mai târziu

Booking/Airbnb, channel manager, e-Factura (există deja `invoices.efactura_id`), plăți online,
housekeeping, roluri granulare (există `organization_members.role`), email/SMS, mobile, AI.
