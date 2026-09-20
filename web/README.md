# Velora Stay: aplicația (Next.js + React + MySQL)

Versiunea nouă a demo-ului [velora-stay-demo.html](../velora-stay-demo.html): aceeași interfață, dar cu server
și bază de date. Rezervările se salvează pe server, deci toată lumea (recepția, telefonul) vede aceleași date.

## Pornire, prima dată

Ai nevoie de Node.js 20 sau mai nou (pe calculatorul tău e deja Node 24 prin nvm) și de MySQL din XAMPP.

1. Deschide **XAMPP Control Panel** și apasă **Start** în dreptul lui **MySQL**. (Apasă Start și la **Apache**
   dacă vrei phpMyAdmin.)
2. În terminal:

```powershell
nvm use 24.14.0        # o singură dată; dacă cere drepturi, deschide terminalul „ca administrator”
cd web
npm install            # descarcă pachetele (un minut)
npm run dev            # pornește serverul
```

Deschide http://localhost:3000. La prima pornire aplicația își creează singură baza de date `velora` și încarcă
datele demo (Vila Duduleanu, Vila Mateo, august plin). Durează câteva secunde, apoi e instant.

Prima dată îți cere să-ți faci **contul de proprietar**: nume, email și o parolă de cel puțin 8 caractere.
Ține minte parola — nu e păstrată nicăieri, nici măcar în baza de date, deci nimeni nu ți-o poate spune.

Oprești serverul cu `Ctrl + C` în terminal.

Dacă vezi „Nu mă pot conecta la MySQL”, înseamnă că ai uitat de pasul 1.

## Conturi

| Rol | Ce vede |
|---|---|
| **Proprietar** | tot: calendar, rezervări, oaspeți, camere, tarife, **Financiar** și **Setări** |
| **Recepție** | calendar, rezervări, oaspeți, camere, tarife — fără Financiar și fără Setări |

Conturile se fac din **Setări → Cont nou**, de către proprietar. Tot de acolo îi schimbi cuiva rolul, îi pui o
parolă nouă (dacă a uitat-o), îi oprești contul sau îl ștergi. Trebuie să rămână mereu cel puțin un proprietar.

Din cont se iese apăsând pe numele tău, în colțul din stânga jos.

Recepția nu primește cheltuielile nici măcar în datele trimise către browser, iar rutele `/api/expenses`,
`/api/users` și resetarea datelor demo îi răspund cu 403. Dacă ai uitat parola de proprietar și ești singurul
proprietar, ștergi contul din baza de date (`npm run db:sql -- "DELETE FROM users"`) și îl faci din nou la
următoarea deschidere; rezervările rămân neatinse.

## Zilnic

| Ce vrei | Comanda (în folderul `web`) |
|---|---|
| Pornești serverul pentru lucru | `npm run dev` |
| Varianta rapidă, ca în producție | `npm run build` apoi `npm start` |
| Rulezi testele | `npm test` |
| Ștergi baza de date și reîncepi cu datele demo | `npm run db:reset` |
| Te uiți în baza de date din terminal | `npm run db:sql -- "SELECT name, price FROM rooms"` |
| Pui înapoi o copie de siguranță | `npm run db:restore -- backups\velora-....sql.gz --da` |
| Proprietarul și-a uitat parola | `npm run user:password -- email@exemplu.ro parola-noua` |
| Treci de la datele de probă la cele adevărate | Setări → „Șterge datele de probă, păstrează camerele” |

Din telefon, în aceeași rețea Wi-Fi: pornește cu `npm run dev -- -H 0.0.0.0` și deschide pe telefon
`http://IP-ul-calculatorului:3000` (IP-ul îl vezi cu `ipconfig`).

## Pornire cu un dublu-click

În folderul proiectului e **Porneste Velora.bat**. Pornește MySQL dacă nu merge, pregătește programul la prima
rulare, îl pornește și deschide browserul. Fereastra neagră rămâne deschisă cât lucrezi. Poți face o scurtătură
spre el pe desktop (click dreapta → Trimite la → Desktop).

## Copii de siguranță

Cât timp merge programul, se face singură **o copie pe zi** cu tot: rezervări, plăți, facturi, conturi. Se țin 30 de
zile. Din **Setări → Copii de siguranță** faci una pe loc, o descarci și alegi folderul — pune unul din OneDrive
sau Google Drive, ca să existe și în afara calculatorului.

Pui o copie înapoi așa (înlocuiește tot ce e acum în bază, de aceea cere `--da`):

```powershell
npm run db:restore -- backups\velora-2026-09-19_120000.sql.gz --da
```

## Fișa de cazare, confirmări, Excel

- **Fișa de cazare:** în sertarul rezervării, „Completează actul” (serie, număr, data nașterii, cetățenie, domiciliu),
  apoi „Fișă de cazare” → Tipărește. Ce lipsește poate fi scris de mână de oaspete.
- **Registrul turiștilor:** Rezervări → „Registrul turiștilor”, alegi perioada, tipărești sau descarci Excel.
- **Confirmare:** în sertar, „Confirmă pe WhatsApp” sau „pe email” deschide aplicația ta cu mesajul gata scris; tu
  apeși Trimite. Textul se schimbă din Setări.
- **Excel:** butonul „Descarcă Excel” e pe Rezervări, Oaspeți, Financiar, Facturi și Registru.
- **Import:** Rezervări → „Importă”. Descarci modelul, îl completezi în Excel, îl salvezi ca CSV, apeși „Verifică”
  (vezi rând cu rând ce intră și de ce nu), apoi „Importă”.

## Jurnal și date personale

- **Jurnalul** (Setări → „Jurnal: cine a făcut ce”, numai proprietarul): cine a făcut o rezervare, cine a șters-o,
  cine a încasat, cine a schimbat un preț, cine a intrat în cont. Se caută și se descarcă în Excel.
- **La cererea unui oaspete** (fereastra „Date oaspete”, numai proprietarul): „Descarcă tot ce ținem despre el” dă un
  fișier cu datele, șederile, plățile și facturile lui; „Șterge datele personale” îi scoate numele, contactul și
  actul. Șederile și banii rămân, fără nume; facturile emise rămân întregi, cum cere legea.

## Facturi

1. **O singură dată:** în **Setări → Datele pensiunii** scrii numele firmei, CUI-ul, adresa, IBAN-ul și seria
   facturilor (de ex. `VD`). Dacă ești plătitor de TVA, bifezi și scrii cota pentru cazare — întreab-o pe
   contabilă, s-a tot schimbat. Fără nume, CUI și adresă, programul nu emite nimic și îți spune ce lipsește.
2. **Emiți:** deschizi rezervarea din calendar → **Emite factură**. Factura vine completată cu clientul și cu o
   linie de cazare pe totalul rezervării. Poți schimba clientul (o firmă, cu CUI), adăuga linii (mic dejun,
   parcare) și data. Numărul se dă singur, la rând: `VD 0001`, `VD 0002`…
3. **Tipărești sau salvezi PDF:** în factura deschisă, butonul din dreapta sus. În fereastra de tipărire alegi
   imprimanta sau „Salvare ca PDF”.
4. **Ai greșit?** O factură emisă nu se șterge și nu se modifică. O **stornezi** din registru: se emite una nouă,
   cu aceleași sume în minus, iar rezervarea rămâne liberă ca să emiți factura corectă.

Pagina **Facturi** e registrul: toate facturile, cu căutare după număr, client sau CUI și cu totalul pe lună.
Facturile și datele firmei le vede numai proprietarul.

Programul nu trimite încă facturile la ANAF (e-Factura) și nu face chitanțe.

## Baza de date

- **MySQL / MariaDB**, baza se numește `velora`. Aplicația o creează singură dacă nu există.
- **În phpMyAdmin:** pornește Apache din XAMPP și deschide http://localhost/phpmyadmin, apoi alege `velora`
  în stânga. Vezi tabelele, poți căuta și modifica direct.
- **Pe alt server:** copiază `.env.example` ca `.env.local` și pune
  `DATABASE_URL=mysql://utilizator:parola@host:3306/velora`. Același cod, aceleași tabele.
- **Schema** e în [db/migrations](db/migrations). O modificare nouă înseamnă un fișier nou (`002_...sql`); se aplică
  singur la pornire, o singură dată. Fișierele se pot importa și în phpMyAdmin așa cum sunt.
- **Rezervările duble sunt imposibile:** tabelul `room_nights` ține câte un rând pentru fiecare cameră și fiecare
  noapte ocupată, cu cheia unică `room_is_free`. A doua rezervare pe aceeași noapte lovește cheia și e refuzată,
  chiar dacă cineva scrie direct în phpMyAdmin. Rândurile sunt ținute la zi de trei triggere. Aplicația verifică
  înainte și dă un mesaj clar; baza de date e plasa de siguranță.

## Ce e unde

```
app/            paginile (calendar, azi, rezervari, oaspeti, ...) și API-ul (app/api)
components/     bucățile de interfață: calendarul, sertarul, fereastra de rezervare
domain/         regulile, fără interfață și fără bază de date: suprapuneri, prețuri, alerte (cu teste)
lib/            baza de date, migrările, conturile, citirea și salvarea rezervărilor (cu teste)
db/migrations/  schema MySQL
middleware.ts   trimite la pagina de intrare pe cine nu are cookie de sesiune
public/demo.html  demo-ul vechi, pentru paginile care nu sunt mutate încă
```

API: `GET /api/state`, `POST /api/reservations`, `PATCH|DELETE /api/reservations/:id`,
`POST /api/reservations/:id/payments`, `POST /api/demo/reset`,
`POST /api/auth/login|logout|setup`, `GET /api/auth/me`, `GET|POST /api/users`, `PATCH|DELETE /api/users/:id`,
`GET|POST /api/invoices` (`?draft=<rezervare>` dă factura propusă), `GET /api/invoices/:id`,
`POST /api/invoices/:id/storno`, `GET|PUT /api/settings`.

**Cine are voie** se verifică într-un singur loc, `handle()` din [lib/http.ts](lib/http.ts), prin care trec toate
rutele. O rută nouă e închisă din start: ca să fie deschisă, trebuie scris anume `handleOpen`. `handleOwner`
lasă numai proprietarul.

Interogările din cod sunt scrise cu `$1, $2, ...`; [lib/db.ts](lib/db.ts) le traduce în `?` pentru MySQL, ca
același parametru să poată fi folosit de două ori sau în altă ordine.

## Ce e mutat și ce urmează

Gata, la fel ca în demo: calendarul (mutare, prelungire, rezervare nouă prin tragere, extindere la click, meniu la click
dreapta, adăugare de camere desenând, unirea automată a rezervărilor aceluiași oaspete, zoom, ecran complet, telefon),
sertarul cu plăți și factură, fereastra de rezervare, paginile Azi, Rezervări, Oaspeți, Camere (proprietăți, etaje,
camere), Tarife (grilă, grupuri, editor pe un preț) și Financiar (grafice, tabele, cheltuieli, lei/€). Tabelele se
sortează din cap.

Plus, față de demo: conturile (pagina de intrare, rolurile proprietar/recepție, gestiunea conturilor din Setări)
și facturile (datele pensiunii, emitere din rezervare, registru, stornare, tipărire și PDF).

Nu e mutat: împărțirea unei camere în unități (rar folosită). Ce urmează e scris în [PLAN.md](../PLAN.md):
publicarea pe server cu copii de siguranță, fișa de cazare, sincronizarea cu Booking.

API în plus: `PUT /api/rates`, `POST|PATCH|DELETE` pe `/api/rooms`, `/api/floors`, `/api/properties`, `/api/expenses`,
`PUT /api/rooms/order`, `POST /api/reservations/:id/merge`.

## Teste

`npm test` rulează și testele care au nevoie de bază de date. Fiecare își face o bază proprie
(`velora_test_...`), pe care o șterge la final, deci datele tale nu sunt atinse. MySQL trebuie să fie pornit.

## Viteză

`npm run dev` compilează fiecare pagină la prima deschidere, deci prima încărcare durează câteva secunde, iar prima
pornire mai creează și baza de date. După aceea `/api/state` răspunde în ~0,03 s. Pentru viteza reală rulează
`npm run build` și apoi `npm start`.
