# Velora Stay: aplicația (Next.js + React + PostgreSQL)

Versiunea nouă a demo-ului [velora-stay-demo.html](../velora-stay-demo.html): aceeași interfață, dar cu server
și bază de date. Rezervările se salvează pe server, deci toată lumea (recepția, telefonul) vede aceleași date.

## Pornire, prima dată

Ai nevoie de Node.js 20 sau mai nou. Pe calculatorul tău e deja instalat Node 24 prin nvm.

```powershell
nvm use 24.14.0        # o singură dată; dacă cere drepturi, deschide terminalul „ca administrator”
cd web
npm install            # descarcă pachetele (un minut)
npm run dev            # pornește serverul
```

Deschide http://localhost:3000. La prima pornire aplicația își creează singură baza de date și încarcă datele demo
(Vila Duduleanu, Vila Mateo, august plin). Durează câteva secunde, apoi e instant.

Oprești serverul cu `Ctrl + C` în terminal.

## Zilnic

| Ce vrei | Comanda (în folderul `web`) |
|---|---|
| Pornești serverul pentru lucru | `npm run dev` |
| Varianta rapidă, ca în producție | `npm run build` apoi `npm start` |
| Rulezi testele | `npm test` |
| Ștergi baza de date locală și reîncepi cu datele demo | oprești serverul, apoi `npm run db:reset` |
| Te uiți în baza de date | oprești serverul, apoi `npm run db:sql -- "SELECT name, price FROM rooms"` |

Din telefon, în aceeași rețea Wi-Fi: pornește cu `npm run dev -- -H 0.0.0.0` și deschide pe telefon
`http://IP-ul-calculatorului:3000` (IP-ul îl vezi cu `ipconfig`).

## Baza de date

- **Pe calculatorul tău:** PostgreSQL adevărat prin PGlite, rulează în interiorul aplicației, fără nimic de instalat.
  Datele stau în `web/.data/pglite` (folderul nu intră în git). Nu există un server la care să te conectezi cu
  phpMyAdmin (acela e pentru MySQL); te uiți în date cu `npm run db:sql` sau, când vei avea un PostgreSQL adevărat,
  cu pgAdmin sau DBeaver.
- **Pe un server:** copiezi `.env.example` ca `.env.local` și pui `DATABASE_URL=postgres://...` (Neon, Supabase sau un
  PostgreSQL propriu). Același cod, aceleași tabele.
- **Schema** e în [db/migrations](db/migrations). O modificare nouă înseamnă un fișier nou (`002_...sql`); se aplică singur
  la pornire, o singură dată.
- **Rezervările duble sunt imposibile:** baza de date refuză două rezervări active pe aceeași cameră în aceeași noapte
  (constrângerea `room_is_free`). Aplicația verifică înainte și dă un mesaj clar; baza de date e plasa de siguranță.

## Ce e unde

```
app/            paginile (calendar, azi, rezervari, oaspeti, ...) și API-ul (app/api)
components/     bucățile de interfață: calendarul, sertarul, fereastra de rezervare
domain/         regulile, fără interfață și fără bază de date: suprapuneri, prețuri, alerte (cu teste)
lib/            baza de date, migrările, datele demo, citirea și salvarea rezervărilor (cu teste)
db/migrations/  schema PostgreSQL
public/demo.html  demo-ul vechi, pentru paginile care nu sunt mutate încă
```

API: `GET /api/state`, `POST /api/reservations`, `PATCH|DELETE /api/reservations/:id`,
`POST /api/reservations/:id/payments`, `POST /api/demo/reset`.

## Ce e mutat și ce urmează

Gata, la fel ca în demo: calendarul (mutare, prelungire, rezervare nouă prin tragere, extindere la click, meniu la click
dreapta, adăugare de camere desenând, unirea automată a rezervărilor aceluiași oaspete, zoom, ecran complet, telefon),
sertarul cu plăți și factură, fereastra de rezervare, paginile Azi, Rezervări, Oaspeți, Camere (proprietăți, etaje,
camere), Tarife (grilă, grupuri, editor pe un preț) și Financiar (grafice, tabele, cheltuieli, lei/€). Tabelele se
sortează din cap.

Nu e mutat: împărțirea unei camere în unități (rar folosită). Urmează: autentificare (conturi pentru recepție),
facturi și e-Factura, căutarea „am loc liber?” cu voce.

API în plus: `PUT /api/rates`, `POST|PATCH|DELETE` pe `/api/rooms`, `/api/floors`, `/api/properties`, `/api/expenses`,
`PUT /api/rooms/order`, `POST /api/reservations/:id/merge`.

## Viteză

`npm run dev` compilează fiecare pagină la prima deschidere, deci prima încărcare durează câteva secunde, iar prima
pornire mai creează și baza de date. După aceea `/api/state` răspunde în ~0,1 s. Pentru viteza reală rulează
`npm run build` și apoi `npm start`.
