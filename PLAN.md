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

**Unde suntem:** sunt gata fazele 1a (conturi), 3 (import și export), 4 (facturi), 6 (confirmare) și 7 (fișa de
cazare), plus jumătatea fără server a fazei 2: copia de siguranță zilnică, cu restaurare verificată, și pornirea
cu un dublu-click. Așteaptă un server: publicarea (2) și sincronizarea cu Booking (5). Tot fără server s-au făcut jurnalul și datele personale (9). A rămas e-Factura (8), care cere
adrese pe câmpuri (județ, localitate) și un certificat digital de la ANAF, deci se face împreună cu contabila.

---

## Faza 1a — Conturi și roluri ✅ gata

Înainte, cine nimerea adresa vedea toate rezervările și datele oaspeților.

**Ce vede utilizatorul.** La prima pornire, o pagină de bun venit unde se face contul proprietarului. Apoi o
pagină de intrare cu email și parolă. Proprietarul vede tot; recepția intră cu contul ei și nu vede Financiar
și Setări. În Setări, proprietarul face conturi noi, schimbă rolul, oprește un cont, pune o parolă nouă sau
șterge contul. În colțul din stânga jos scrie cine ești, și de acolo se iese din cont.

**Cum e făcut.** Tabelele `users` și `sessions` (migrarea `002_conturi.sql`). Parolele sunt trecute prin scrypt,
cu sare nouă la fiecare parolă; în `sessions` stă amprenta cookie-ului, nu cookie-ul. Verificarea stă într-un
singur loc, `handle()` din `lib/http.ts`, prin care trec toate rutele: o rută nouă e închisă până când cineva
scrie anume `handleOpen`. Financiarul, conturile și resetarea datelor demo cer `handleOwner`; cheltuielile nici
măcar nu pleacă spre browserul recepției.

**S-a ales altfel decât era scris aici.** Sesiuni scrise de mână, nu `better-auth`: biblioteca ar fi adus cu ea
un ORM și propriul fel de a ține schema, iar aici toată schema e SQL simplu, pe care îl poți deschide în
phpMyAdmin. Parolele merg prin `scrypt` din Node, deci partea delicată tot nu e scrisă de noi.

**Verificat cu** 21 de teste pe parole, conturi și sesiuni, 10 pe verificarea din `handle`, plus un test care
trece prin server: fără cont 401, recepția 403 pe cheltuieli și pe conturi, contul oprit nu mai intră, parola
nouă taie sesiunile deschise, ultimul proprietar nu poate fi șters.

## Faza 1b — Separarea pe clienți (mai multe pensiuni în același program)

Nu e făcută, și nu e nevoie de ea până când programul nu are al doilea client (faza 10). Partea scumpă —
ca fiecare cerere să știe cine o face — e deja gata: `handle()` dă contul fiecărei rute.

**Ce e de făcut.** Tabelul `organizations` și coloana `org_id` pe `properties`, `guests`, `reservations`,
`expenses` și `users`; restul tabelelor se leagă prin ele. Funcțiile din `lib/repo.ts` și `lib/repo-admin.ts`
primesc organizația din contul care a cerut și filtrează după ea.

**Verificare.** Un test cu două organizații, care cere ca prima să nu vadă nici măcar un id din a doua.

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

## Faza 3 — Import și export ✅ gata

*Făcut:* „Descarcă Excel” pe Rezervări, Oaspeți, Financiar, Facturi și Registru (CSV cu „;” și diacritice, pe care Excelul îl deschide direct; textele care ar arăta a formulă sunt ținute text). „Importă” din Rezervări: model de descărcat, verificare cu previzualizare pe fiecare rând, apoi scrierea rândurilor bune prin același drum ca o rezervare făcută de mână. Vede suprapunerile și între rândurile aceluiași fișier.

**Ce vede utilizatorul.** Un buton „Descarcă Excel” pe paginile Rezervări, Oaspeți și Financiar. Și un
„Importă rezervări” care cere un fișier CSV, arată o previzualizare („143 de rezervări, 2 se suprapun”) și abia
apoi scrie.

**De ce contează.** Fără import, trecerea de pe caiet sau de pe alt program înseamnă tastat cu mâna. Fără export,
contabila nu poate lucra.

**Verificare.** Export, apoi import înapoi într-o bază goală: aceleași rezervări, aceleași sume.

---

## Faza 4 — Facturi ✅ gata

**Ce vede utilizatorul.** În Setări, datele pensiunii așa cum apar pe factură: nume, CUI, Reg. Com., adresă,
IBAN, bancă, seria facturilor, termenul de plată, mențiuni, și dacă e plătitor de TVA (cu cota scrisă de el).
În sertarul unei rezervări, butonul **Emite factură** deschide factura deja completată — clientul, o linie
„Cazare 101, 3 nopți (…)” cu totalul rezervării — pe care o poți corecta: alt client (o firmă, cu CUI), linii
în plus (mic dejun, parcare), altă dată. Pagina **Facturi** e registrul: căutare după număr, client sau CUI,
totalul pe fiecare lună, și butonul **Stornează**. Factura deschisă are **Tipărește sau salvează PDF**.

**Cum e făcut.** Migrarea `003_facturi.sql`: `settings`, `invoice_series`, `invoices`, `invoice_lines`.
- *Fără goluri în numerotare:* contorul seriei se ia cu `FOR UPDATE` în aceeași tranzacție care scrie factura,
  deci o emitere eșuată nu consumă niciun număr, iar două emiteri în același moment primesc numere diferite.
- *O factură emisă nu se mai schimbă:* datele pensiunii și ale clientului sunt copiate în factură la emitere.
  Dacă îți muți sediul, facturile vechi rămân cu sediul vechi. Facturile nu se șterg; se stornează, adică se
  emite una nouă cu aceleași sume în minus, iar rezervarea rămâne liberă pentru o factură corectă.
- *PDF-ul e tipărirea browserului* („Salvare ca PDF”), cu o foaie de stil pentru tipar. Fără nicio bibliotecă
  în plus, iar diacriticele și fontul ies exact ca pe ecran.
- Prețurile scrise pe factură sunt cu TVA inclus, cum e obiceiul la cazare; TVA-ul se scoate din ele.
- Numai proprietarul vede facturile și datele firmei; recepția primește 403.

**Ce nu face încă.** Nu trimite factura la ANAF (faza 8) și nu o trimite pe email (faza 6). Nu are chitanțe.
Cota de TVA nu e pusă de program: s-a schimbat de mai multe ori în ultimii ani, deci o scrie proprietarul,
după ce întreabă contabila.

**Verificat cu** 20 de teste (numere la rând, emitere eșuată care nu consumă număr, contor separat pe serie,
copia datelor pensiunii, socoteala cu și fără TVA, stornare o singură dată) și un test prin server de 20 de pași.

---

## Faza 5 — Sincronizare cu Booking.com și Airbnb (iCal) ✅ (făcut; exportul merge abia după publicare)

> Făcut în Setări → „Calendare Booking, Airbnb, Travelminit”: linkurile se citesc din 15 în 15 minute
> (`lib/ical.ts`), ce vine devine rezervare obișnuită, ce dispare de pe site se anulează, conflictele se văd
> în raportul citirii. Linkul nostru pentru site-uri există (`/api/ical/export/<cod>.ics`), dar site-urile îl pot
> citi doar când programul are adresă publică (faza 2). Nefăcut: alerta în pagina Azi. Neîncercat pe un
> calendar adevărat de la Booking — doar pe texte de test.

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

## Faza 6 — Confirmare către oaspete ✅ gata

*Făcut:* în sertarul rezervării, „Confirmă pe WhatsApp” și „Confirmă pe email” deschid aplicația omului cu textul gata scris; nimic nu pleacă de pe server și nu costă nimic. Șablonul se schimbă din Setări, cu previzualizare pe o rezervare adevărată. *Rămas:* trimiterea de pe server (SMTP), când va exista unul.

**Ce vede utilizatorul.** În sertarul rezervării, două butoane: **WhatsApp** (deschide conversația cu textul deja
scris — nu costă nimic) și **Email**. În Setări, textul șablon, cu câmpuri de completat automat: nume, perioadă,
cameră, total, avans.

**Decizie.** Pentru email: SMTP-ul propriu sau un serviciu (Resend). Serviciul e mai sigur că ajunge în inbox.

**Verificare.** Trimit o confirmare pe adresa mea și verific că diacriticele și sumele arată corect și pe telefon.

---

## Faza 7 — Fișa de cazare și registrul turiștilor ✅ gata

*Făcut:* actul, nașterea, cetățenia și domiciliul la oaspete (le completează și recepția), „Fișă de cazare” din sertar, gata de tipărit și semnat, și „Registrul turiștilor” pe o perioadă, de tipărit sau de dus în Excel. Pe fișă intră oaspetele principal al rezervării; însoțitorii se scriu de mână.

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

## Faza 9 — Jurnal, date personale, supraveghere (jurnalul și datele personale ✅ gata)

*Făcut:* **Jurnalul** (Setări → „Jurnal: cine a făcut ce”): fiecare schimbare — rezervări, încasări, facturi, prețuri, camere, conturi, setări, copii de siguranță, intrări în cont — cu omul, ora și un rezumat care se înțelege și după ce rezervarea dispare. În jurnal intră numele câmpurilor schimbate, niciodată parola sau seria buletinului. Se caută și se duce în Excel. **Datele personale:** din fereastra oaspetelui, proprietarul descarcă tot ce ține programul despre el sau îi șterge datele personale; șederile și banii rămân fără nume, numele dispare și din jurnal, iar facturile emise rămân întregi, cum cere legea. Nu se poate cât timp omul e cazat sau urmează să vină.

*Rămas:* ștergerea automată după un termen (trebuie hotărât termenul), textul politicii de confidențialitate (îl scrie un om, nu programul) și supravegherea cu alerte, care are rost abia pe un server.


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
