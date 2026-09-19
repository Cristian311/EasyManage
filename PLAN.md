# Velora Stay: ce mai are nevoie până la un program serios

Aplicația are acum partea grea: calendarul, rezervările, tarifele, financiarul și o bază de date care refuză
suprapunerile. Ce lipsește e aproape tot ce ține de „poate fi folosită zilnic de altcineva decât de cel care a
scris-o”.

Documentul e o listă de faze, în ordinea în care merită făcute. Fiecare fază spune **ce vede utilizatorul**,
**ce se schimbă în baza de date**, **ce decizie trebuie luată la început** și **cum verificăm că merge**.
Nimic din ce scrie aici nu e construit încă.

Ce e deja gata e descris în [web/README.md](web/README.md). Ideile de căutare cu voce („am loc liber?”, la volan)
stau separat, în [IDEI-NOI.md](IDEI-NOI.md).

**Scurt, dacă ai timp doar de trei lucruri:** fazele 1, 2 și 4. Primele două fac din program ceva ce familia
folosește pe bune. Fazele 5 și 8 sunt cele pentru care o pensiune plătește lunar.

---

## Faza 1 — Conturi și separarea pe clienți

Se fac împreună, cât baza de date e încă goală. Mai târziu costă de zece ori mai mult.

Acum nu există autentificare: cine nimerește adresa vede toate rezervările și datele oaspeților.

**Ce vede utilizatorul.** O pagină de intrare cu email și parolă. Tata intră ca **proprietar** și vede tot.
Recepția intră cu contul ei și nu vede Financiar și Setări. În Setări apare o listă de utilizatori, unde
proprietarul poate invita pe cineva și îi poate lua accesul.

**Baza de date.** Tabele noi: `organizations`, `users`, `memberships` (rol: `owner` / `reception`), `sessions`.
Coloana `org_id` se adaugă pe `properties`, `guests`, `reservations` și `expenses`; restul tabelelor se leagă prin
ele. Toate funcțiile din `lib/repo.ts` și `lib/repo-admin.ts` primesc un `ctx { orgId, userId, role }` și
filtrează după el; un `middleware.ts` păzește paginile și `/api`.

**Decizie.** Bibliotecă gata făcută (`better-auth` merge cu MySQL și știe și organizații) sau sesiuni scrise de
mână. Recomand biblioteca: parolele, cookie-urile și invitațiile sunt locuri unde nu merită să greșim.

**Verificare.** Teste care cer ca o cerere fără cont să primească 401 și ca un cont de la altă organizație să nu
vadă rezervările primei. Un test care confirmă că recepția primește 403 pe `/api/expenses`.

---

## Faza 2 — Publicare pe internet și copii de siguranță

Acum aplicația trăiește cât ține calculatorul pornit, iar toate rezervările stau într-un singur folder.

**Ce vede utilizatorul.** O adresă proprie, de exemplu `app.velorastay.ro`, care merge de pe orice telefon, de
oriunde, fără ca vreun calculator de acasă să fie pornit.

**Cum.** Un server mic (Hetzner, aproximativ 4–5 € pe lună) cu Node, MariaDB, Caddy pentru HTTPS automat și pm2
ca aplicația să repornească singură. `mysqldump` în fiecare noapte, copiat în afara serverului, păstrat 30 de zile.
Serviciile MySQL „serverless” ieftine nu acceptă triggere, iar triggerele sunt cele care țin `room_nights`
corect — de asta un server obișnuit.

**Decizie.** Server propriu (mai ieftin, trebuie întreținut) sau un serviciu gestionat (mai scump, mai puțină
bătaie de cap). La un singur client, serverul propriu e în regulă.

**Verificare.** O restaurare de probă: iau copia de noapte, o pun pe un server gol și verific că numărul de
rezervări și de plăți e același. Fără această probă, copiile nu se pun la socoteală.

---

## Faza 3 — Import și export

**Ce vede utilizatorul.** Un buton „Descarcă Excel” pe paginile Rezervări, Oaspeți și Financiar. Și un
„Importă rezervări” care cere un fișier CSV, arată o previzualizare („143 de rezervări, 2 se suprapun”) și abia
apoi scrie.

**De ce contează.** Fără import, trecerea de pe caiet sau de pe alt program înseamnă tastat cu mâna. Fără export,
contabila nu poate lucra.

**Verificare.** Export, apoi import înapoi într-o bază goală: aceleași rezervări, aceleași sume.

---

## Faza 4 — Facturi

Pagina „Facturi” e goală acum.

**Ce vede utilizatorul.** În Setări, datele firmei (nume, CUI, adresă, cont). Pe o rezervare, butonul
„Emite factură”, care deschide factura completată, cu serie și număr. Butoanele „Descarcă PDF” și „Stornează”.
Pagina Facturi arată lista, cu căutare și cu totalul pe lună.

**Baza de date.** `invoice_series` (serie, ultimul număr), `invoices`, `invoice_lines`. Numerotarea nu are voie
să aibă goluri, deci numărul se ia într-o tranzacție, cu `SELECT ... FOR UPDATE`.

**Decizie.** Facem singuri factura sau folosim un serviciu românesc (Oblio, SmartBill) prin API-ul lor. Serviciul
costă câțiva euro pe lună, dar rezolvă și faza 8. Recomand să cerem prețurile lor înainte de a scrie cod.

**Verificare.** Emitere, stornare și o a doua emitere: numerele ies 1, 2, 3, fără goluri, chiar dacă două facturi
se emit în același moment.

---

## Faza 5 — Sincronizare cu Booking.com și Airbnb (iCal)

Problema numărul unu a oricărei pensiuni: aceeași cameră vândută de două ori, pe două site-uri.

**Ce vede utilizatorul.** În Camere, la fiecare cameră, un link de copiat în Booking („dă-le acest link”) și o
căsuță unde lipește linkul primit de la ei. Pe calendar, rezervările venite de la Booking apar cu culoarea lor.
Dacă ceva nu se potrivește, apare o alertă în pagina Azi.

**Cum.** Export: un `.ics` pe cameră, cu o adresă secretă. Import: linkurile se citesc la fiecare 15 minute și se
creează blocări cu `source` și `external_uid`, ca să nu se dubleze la următoarea citire.

**Limita, spusă pe față.** iCal trimite doar perioadele ocupate, nu și prețurile, și are întârziere de minute.
Nu înlocuiește un channel manager adevărat, dar acoperă cea mai mare parte a durerii, cu o muncă de câteva zile
în loc de luni.

**Verificare.** Blochez o perioadă în Airbnb, aștept o citire, verific că apare în calendar. Șterg blocarea acolo,
verific că dispare și la noi.

---

## Faza 6 — Confirmare către oaspete

**Ce vede utilizatorul.** În sertarul rezervării, două butoane: **WhatsApp** (deschide conversația cu textul deja
scris — nu costă nimic) și **Email**. În Setări, textul șablon, cu câmpuri de completat automat: nume, perioadă,
cameră, total, avans.

**Decizie.** Pentru email: SMTP-ul propriu sau un serviciu (Resend). Serviciul e mai sigur că ajunge în inbox.

**Verificare.** Trimit o confirmare pe adresa mea și verific că diacriticele și sumele arată corect și pe telefon.

---

## Faza 7 — Fișa de cazare și registrul turiștilor

Pensiunile sunt obligate să țină evidența cu actul de identitate, iar mulți o completează încă de mână.

**Ce vede utilizatorul.** La oaspete apar câmpurile pentru act (tip, serie, număr, CNP dacă e nevoie, data
nașterii). La cazare, butonul „Fișă de cazare” scoate fișa deja completată, de tipărit. În Rezervări, un buton
„Registru” pe o perioadă aleasă.

**De ce merită.** E genul de lucru care convinge un patron mai repede decât un calendar frumos.

**Verificare.** Compar fișa tipărită cu una completată de mână, câmp cu câmp.

---

## Faza 8 — e-Factura la ANAF

Factura electronică prin ANAF e obligatorie pentru facturile către firme. Se sare peste faza asta dacă la faza 4
s-a ales Oblio sau SmartBill, pentru că ei o trimit deja.

**Ce vede utilizatorul.** Pe o factură către firmă, butonul „Trimite la ANAF” și o stare: trimisă, acceptată,
respinsă, cu motivul scris pe românește.

**Cum.** XML în format UBL (CIUS-RO), autentificare la SPV cu certificat digital, trimitere și apoi verificarea
stării. Se lucrează întâi în mediul de test al ANAF.

**Verificare.** O factură completă dusă până la „acceptată” în mediul de test, înainte de orice factură adevărată.

---

## Faza 9 — Jurnal, date personale, supraveghere

**Jurnal.** Un tabel `audit_log` scris din `lib/repo.ts`: cine a mutat rezervarea, cine a șters-o, când. Într-o
echipă cu mai mulți oameni devine repede necesar.

**Date personale (GDPR).** Ținem nume, telefon, email și, după faza 7, acte. Avem nevoie de: politică de
confidențialitate, un buton care scoate sau șterge tot ce știm despre un oaspete, și un termen după care datele
vechi se șterg singure.

**Supraveghere.** Sentry pentru erori și o verificare din afară care trimite un email dacă site-ul cade. Altfel
afli de la client.

---

## Faza 10 — Din program propriu în produs vândut

- Înscriere singur: cont nou, pensiune nouă, fără datele demo.
- Un asistent de configurare la prima intrare: numele pensiunii, etajele, camerele, prețurile.
- Abonament prin Stripe, cu perioadă de probă.
- O pagină de prezentare cu capturi din aplicație și prețul.

Înainte de faza asta merită arătat programul la două-trei pensiuni cunoscute și ascultat ce cer ele întâi.

---

## Rămase pe dinafară, deocamdată

- Împărțirea unei camere în unități (există în demo-ul vechi, folosită rar).
- Căutarea de disponibilitate cu voce, la volan — scrisă în [IDEI-NOI.md](IDEI-NOI.md).
- Un channel manager adevărat, cu prețuri și disponibilitate trimise către Booking. Se pune în discuție abia
  după ce faza 5 se dovedește insuficientă.
