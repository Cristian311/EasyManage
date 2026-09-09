# Velora Stay – plan pe termen scurt și idei de produs

Principiul care decide ce intră și ce nu: **recepționerul face totul din calendar, în cel mult două click-uri.**
Dacă o funcție cere o a treia pagină, e proiectată greșit.

## 1. Ce fac acum în demo

Fiecare pas se termină cu demo-ul funcțional și publicat, ca să-l poată încerca recepționerul.
Efortul e estimat pentru demo-ul actual (un singur fișier, fără backend).

### Pasul 1 – „Ce se întâmplă azi”, direct în calendar

| Idee | Ce vede recepționerul | Efort |
|---|---|---|
| Bara „Azi” peste calendar | Sosiri · Plecări · De curățat · Libere, ca numere. Click pe număr sare la blocul respectiv. | mic |
| „Cazează” / „Pleacă” de pe bloc | În ziua sosirii blocul arată un buton „Cazează”. În ziua plecării, „Pleacă”. Fără sertar, fără modal. | mic |
| Alerte pe bloc | Roșu: pleacă azi și nu a plătit. Portocaliu: a trecut ora de check-in și nu e cazat. | mic |
| „Anulează” după mutare | După drag & drop apare un toast „Mutat în 103 · Anulează”, șase secunde. Mutările din greșeală nu mai sperie pe nimeni. | mic |
| Istoric oaspete în sertar | „A mai stat de 3 ori · ultima dată în 201 · preferă etajul 1”. | mic |

### Pasul 2 – Disponibilitate și blocări

| Idee | Ce vede recepționerul | Efort |
|---|---|---|
| Blocare cameră | Bloc gri hașurat fără oaspete, cu motiv („renovare baie”). Împiedică rezervările în perioada aia. | mic spre mediu |
| Caută loc liber | „2 persoane · 3 nopți · de la 15 sep”. Camerele libere se aprind, restul se estompează. Click pe una = rezervare precompletată. | mediu |
| Vedere lună | 30 de zile la zoom compact, blocurile doar ca fâșii colorate. Ocuparea dintr-o privire. | mic |
| Raport de zi | Pagina Plăți devine utilă: încasări azi pe numerar, card, transfer, cu total. Bate cu casa de marcat seara. | mic |

### Pasul 3 – Comunicare și hârtii

| Idee | Ce vede recepționerul | Efort |
|---|---|---|
| Mesaje predefinite | Buton „Confirmare” în sertar. Textul gata scris se copiază pentru WhatsApp sau email. Fără automatizare. | mic |
| Confirmare printabilă | Pagină de print a rezervării: pensiune, oaspete, perioadă, sumă, rest de plată. | mic |
| Carnetul recepției | Note pe zi vizibile în bara „Azi”: „201 vrea trezire la 6”. | mic |
| Stare cameră | Curată, murdară, în curățenie, în antetul coloanei. Devine „murdară” automat la plecare. | mic spre mediu |
| Split rezervare | Oaspetele schimbă camera la mijlocul șederii. Două blocuri legate, o singură rezervare. | mediu |

### Ce nu intră în demo

Channel manager, e-Factura, prețuri dinamice, plăți online, mai mulți utilizatori. Toate au nevoie de backend
și intră în fazele din [ARCHITECTURE.md](ARCHITECTURE.md).

### După pasul 3

Trecem la faza 1 din arhitectură: Next.js, Postgres, autentificare, onboarding. Demo-ul de acum devine
„încearcă live, fără cont” pe pagina de prezentare.

## 2. Idei ca aplicația să aibă succes

### Primele zece minute decid totul

- Cont doar cu email și parolă. Adresa, CUI-ul și restul se cer abia când sunt necesare, adică la prima factură.
- **„Lipește din Excel.”** Lipești lista de camere sau rezervările din Excel și aplicația le recunoaște singură.
  Aproape toate pensiunile mici au un Excel. Asta este migrarea, nu un formular de import.
- Șablon de pensiune la start: opt camere gata create, doar le redenumești. E mai ușor să editezi decât să creezi.
- Date demo pe care poți exersa, cu un buton „Șterg demo-ul, încep pe bune”.
- Trei pași cu bifă pe prima pagină: camerele, prima rezervare, prima încasare.

### Încredere: nu pierde niciodată nimic

- „Anulează” pentru orice acțiune. Nimic nu se șterge definitiv, ajunge într-un coș timp de 30 de zile.
- Jurnal pe înțelesul oricui: „Ana a mutat rezervarea lui Popescu în 102, ieri la 14:32”.
- Export complet în Excel cu un click. Oamenii se tem că rămân blocați într-un sistem. Dacă pot pleca oricând, rămân.
- Merge și cu internet slab: ultimul calendar rămâne vizibil, modificările se trimit când revine conexiunea.
  Multe pensiuni sunt la munte sau în Deltă.

### Viteză, motivul real pentru care vor renunța la Excel

- Rezervare la telefon în sub zece secunde: N, nume, zile, Enter. Restul are valori implicite bune.
- Căutare globală cu Ctrl+K: nume, telefon, cameră, număr de factură.
- Calendarul se încarcă sub o secundă și pe laptopul vechi de la recepție.
- Funcționează la fel de bine pe tabletă, cu atingere: multe recepții nu au mouse.

### Proiectat pe ziua recepției, nu pe tabele din baza de date

- Dimineața: foaia de zi printabilă cu sosiri, plecări și camere de curățat.
- Seara: închiderea casei, încasări pe metodă, care bate cu casa de marcat.
- La sfârșit de lună: ocupare, venit, restanțe, facturi de emis.
- Pagina de start e „Azi”, nu un dashboard cu grafice.

### Specificul românesc este avantajul față de Cloudbeds și restul

- Fișa de cazare pre-completată din datele oaspetelui, de tipărit sau semnat pe tabletă.
- Taxa locală sau de stațiune calculată automat, pe persoană și pe noapte.
- e-Factura când e obligatorie, direct din rezervare.
- Prețuri și facturi în RON, TVA corect, suport pe WhatsApp în română. Programele mari nu fac nimic din astea bine.

### Lansare și vânzare

- Zece pensiuni-partener, gratuit șase luni, în schimbul feedback-ului. O zi petrecută la recepția fiecăreia.
  Recepționerul cu care ai vorbit deja e primul partener.
- Preț fix pe pensiune, nu pe cameră, de exemplu 99 lei pe lună. O singură pagină de preț, fără „contactați vânzările”.
- Migrarea o facem noi: „trimite-ne Excelul, îl încărcăm noi”. Pentru primii clienți e mai ieftin decât orice importator.
- Sincronizare iCal cu Booking și Airbnb ca primă formă de channel sync. Ieftină, previne dubla rezervare
  și e exact ce cer pensiunile mici. API-urile complete vin mult mai târziu.
- Canale: asociațiile de turism rural, contabilii pensiunilor, grupurile de Facebook ale proprietarilor,
  recomandări între pensiuni vecine cu o lună gratuită pentru cine recomandă.
- Pagina de prezentare are demo-ul live din prima secundă, fără cont. Calendarul se vinde singur.

### Detalii de utilizare care fac diferența

- Cuvinte de la recepție, nu din cod: „Cazează”, „Pleacă”, „Încasează”, niciodată „status: checked_in”.
- Fiecare eroare spune ce s-a întâmplat și ce poți face: „Camera 102 e ocupată de Popescu până pe 13. Alege 103 sau mută-l pe Popescu.”
- Ajutor scurt la „?”: scurtăturile de tastatură și trei sfaturi, atât.
- Sertar în loc de modal, modal în loc de pagină nouă. Cu cât mai puține ecrane, cu atât mai bine.
- Temă închisă pentru tura de noapte. Există deja.

### Cum știm că merge

- Timpul până la prima rezervare reală a unui client nou.
- Câte pensiuni deschid aplicația în fiecare zi. Obiceiul „Azi” e semnul că a devenit sistemul lor principal.
- Rezervări create din calendar față de cele create din listă.
- Cereri de suport per client pe lună. Dacă scad, produsul se explică singur.
