# Integrări: ce merită luat de la concurență

Pornind de la secțiunea „Construit pentru România” a unui alt PMS: canale, e-Factura, case de marcat, contabilitate,
restaurant, plăți, lacăte smart. Pentru fiecare scriu ce avem deja, ce ar trebui făcut, cât de greu e și cât de urgent
e pentru o pensiune mică.

> **Condiția pentru aproape toate:** un server public și conturi (autentificare). ANAF, Netopia și iCal-ul spre Booking
> au nevoie de o adresă de internet la care să răspundă aplicația (webhook-uri, OAuth, link de calendar). Fără asta
> merg doar exporturile de fișiere. Vezi ROADMAP.md și ARCHITECTURE.md, faza 1.

## Ordinea propusă

| # | Ce | De ce acum | Greutate |
|---|---|---|---|
| 1 | Sincronizare iCal cu Booking și Airbnb | Oprește rezervările duble între site-uri, problema nr. 1 a pensiunilor | Mică |
| 2 | e-Factura (SPV ANAF) | Obligatorie; facturile le avem deja, lipsește doar trimiterea | Mare |
| 3 | Export pentru contabilitate (SAGA întâi) | Contabilul nu mai tastează facturile; efort mic, câștig mare | Mică |
| 4 | Plată online a avansului (Netopia) | Link de plată în confirmare, încasarea se trece singură | Medie |
| 5 | Case de marcat | Bonul fiscal la încasările cash/card de la persoane fizice | Mare |
| 6 | Lacăte smart (TTLock) | Cazare fără recepție: cod de ușă trimis cu confirmarea | Medie |
| 7 | Soft de restaurant | Doar pentru pensiunile cu restaurant | Medie |
| 8 | Agențiile românești și channel manager complet | Doar după ce 1–4 merg | Mare |

---

## 1. Canale de vânzare

**Pe lista lor:** Booking.com, Airbnb, Expedia, Agoda, Travelminit, Litoralul Românesc, Eximtur, Paralela 45,
Paradis Tours, Bibi Touring, Valiza.

**Ce avem:** doar eticheta sursei pe rezervare (`direct`, `booking`, `travelminit`, `airbnb`, `phone`, `other` în
`domain/labels.ts`), trecută de mână.

**De făcut, în trepte:**
- [ ] **iCal, import:** pentru fiecare cameră, linkul iCal de la Booking/Airbnb. Serverul îl citește la câteva minute
      și blochează nopțile ocupate în calendar ca rezervări cu sursa respectivă. Duplicatele le prinde deja constrângerea
      `room_is_free` din baza de date.
- [ ] **iCal, export:** un link per cameră pe care îl pui în Booking/Airbnb, ca nopțile vândute direct sau prin telefon să se închidă și acolo.
- [ ] Surse noi în listă: Expedia, Agoda, plus agențiile românești (Eximtur, Paralela 45 etc.), ca să apară corect în Financiar pe canale.
- [ ] **Agenții românești:** de obicei trimit rezervări pe email sau lucrează cu alocări de camere. Primul pas e un câmp
      „agenție” și un raport de decont pe agenție, nu o integrare.
- [ ] **Channel manager adevărat** (prețuri și disponibilitate trimise automat): Booking cere statut de partener de
      conectivitate certificat, deci mult timp. Alternativa e integrarea cu un channel manager existent. De decis mai târziu.

iCal nu trimite prețuri și are câteva minute de întârziere. Pentru o pensiune de 10–30 de camere e suficient ca început.

## 2. e-Factura ANAF

**Pe lista lor:** trimitere automată în SPV, status în timp real.

**Ce avem:** facturi complete (`invoices`, serie și număr, TVA, furnizor și client copiați la emitere), coloana `efactura_id`
pregătită, date firmă în Setări.

**De făcut:**
- [ ] Generare XML UBL 2.1 / CIUS-RO din factura existentă (funcție pură în `domain/`, cu teste pe exemplele ANAF).
- [ ] Autentificare OAuth la ANAF cu certificatul digital al firmei (o dată, din Setări; tokenul se reînnoiește singur).
- [ ] Trimitere automată la emitere și coadă de reîncercare dacă SPV nu răspunde.
- [ ] Status pe factură: trimisă / validată / respinsă (cu mesajul ANAF), vizibil în registrul de facturi.
- [ ] Descărcarea recipisei (ZIP semnat de ANAF) și păstrarea ei lângă factură.
- [ ] Alertă pentru facturile netrimise care se apropie de termenul legal.

Pentru clienții persoane fizice fără CNP pe factură, ANAF are reguli speciale (identificator generic); de verificat înainte de implementare.

## 3. Case de marcat

**Pe lista lor:** Datecs, Daisy, Elcom, Olivetti, Orgtech, Partner, Sam4S / Posiflex, Tremol (Activa, AdPos, ExcelComp), Incotex.

**De ce contează:** încasările de la persoane fizice (cash sau card) cer bon fiscal. Azi recepția scoate bonul separat și
nimic nu leagă bonul de rezervare.

**Problema tehnică:** browserul nu poate vorbi direct cu imprimanta fiscală (USB/serial). Soluția uzuală e un program
mic instalat pe calculatorul de la recepție, care primește comanda de la aplicație și o trimite casei de marcat.

**De făcut:**
- [ ] Pasul 0, fără hardware: câmp „număr bon fiscal” pe plată, ca încasarea să fie legată de bon.
- [ ] Program local („punte fiscală”) pentru primul model, cel mai răspândit la pensiunile partenere (probabil Datecs).
- [ ] La „Încasează” cash/card: bonul pleacă automat, iar numărul lui se salvează pe plată.
- [ ] Raportul Z de la sfârșitul zilei, pornit din aplicație.
- [ ] Alte modele doar la cerere, pe rând.

## 4. Soft de contabilitate

**Pe lista lor:** SAGA, CIEL / NextUp, WizCount, OMC.

**De făcut:**
- [ ] Export facturi pe o perioadă în formatul de import SAGA (primul, cel mai folosit de contabilii mici).
      Formatul exact se confirmă cu un contabil de la o pensiune parteneră.
- [ ] Export încasări (plăți) pe perioadă, cu metoda și numărul bonului.
- [ ] Același export pentru CIEL / NextUp și WizCount, dacă îl cer clienții.
- [ ] Export CSV/Excel generic pentru tot restul (e oricum în ROADMAP: „export complet într-un click”).

Nu e nevoie de server: e un fișier descărcat din pagina Facturi. Poate fi făcut înainte de autentificare.

## 5. Plăți online

**Pe lista lor:** Netopia, PayPal, Stripe.

**Ce avem:** plăți trecute de mână (numerar, card, transfer) și confirmarea de rezervare cu text pentru WhatsApp/email.

**De făcut:**
- [ ] Link de plată pentru avans (sau pentru rest), pus automat în textul confirmării.
- [ ] Netopia întâi (românesc, carduri românești, comisioane în lei); Stripe dacă vin mulți străini.
- [ ] Notificarea de la procesator (webhook) trece plata singură pe rezervare, cu metoda „card online”.
- [ ] Rezervarea „În așteptare” devine „Confirmată” când se plătește avansul.
- [ ] Rambursare din aplicație la anulare, conform politicii din Setări.

## 6. Lacăte smart

**Pe lista lor:** Yale Smart, TTLock, Resel.

**De făcut:**
- [ ] Legătura cameră ↔ lacăt, în Camere.
- [ ] La confirmare: cod de acces valabil de la check-in până la check-out, generat automat și trimis în mesajul de confirmare.
- [ ] Codul se anulează la anulare sau check-out și se prelungește dacă se prelungește șederea.
- [ ] TTLock întâi (are API public pentru coduri); Yale și Resel de verificat.

Merge bine cu ideea din ROADMAP a pensiunilor fără recepție permanentă.

## 7. Soft de restaurant

**Pe lista lor:** SoftOK, hePOS.

**De făcut:**
- [ ] Pasul 0, fără integrare: „extra-uri” pe rezervare (mic dejun, cină, minibar) care intră în total și pe factură.
- [ ] Integrare doar dacă o pensiune parteneră folosește deja unul dintre programe: consumația „pe cameră” din POS trece singură pe rezervare.

---

## Ce avem noi și ei nu arată aici

Tot „construit pentru România”, dar pe partea de recepție:
- fișa de cazare precompletată și registrul turiștilor (în ROADMAP, încă nefăcute);
- taxa locală / de stațiune calculată automat pe persoană și noapte (în ROADMAP, încă nefăcută);
- confirmare pe WhatsApp dintr-un click (gata);
- calendar cu rezervări pe mai multe camere alăturate și unire automată (gata).

Primele două sunt ieftine și cer mai puțin decât orice integrare de mai sus. Merită puse înaintea caselor de marcat.
