# Idei noi: întrebări la volan și ieșirea din fișierul unic

Notițe din discuția din 10 septembrie 2026. Nimic din ce e aici nu e încă implementat.

## 1. „Am loc liber?” întrebat la volan

Scopul: tatăl întreabă aplicația cu vocea și aude răspunsul, fără să citească de pe ecran.

### Nu e nevoie de LLM pentru disponibilitate

Aplicația are deja camerele, capacitatea, tarifele și rezervările. „Ce camere de 2 persoane sunt libere între 12 și 15
septembrie” e un calcul exact: instant, gratuit, fără greșeli, merge și offline.
Un LLM nu calculează niciodată disponibilitatea singur. Cel mult înțelege întrebarea, iar răspunsul îl dă tot aplicația.

### Varianta 1: microfon în aplicație (se poate face și în demo)

- Buton mare „Întreabă” (🎤): îl apeși o dată și vorbești.
  „Am liber pentru 2 persoane de pe 12 până pe 15 septembrie?”
- Vorbirea devine text cu Web Speech API (`SpeechRecognition`, limba `ro-RO`), gratuit în Chrome pe Android.
- Aplicația înțelege frazele obișnuite prin reguli, fără LLM:
  - date: „de pe 12 pe 15”, „12–15 septembrie”, „din 12, 3 nopți”, „mâine”, „weekendul ăsta / viitor”, „de vineri până duminică”;
  - persoane: „2 persoane”, „doi adulți și un copil”, „cameră dublă”, „două camere”;
  - vila: „la Mateo”, „la Duduleanu”;
  - luna lipsă: luna curentă, sau următoarea dacă ziua a trecut.
- Răspunsul e citit cu voce (`speechSynthesis`, `ro-RO`), scurt:
  - „Da. Sunt 4 camere libere: 11M, 12M, P1 și P2, de la 660 lei în total.”
  - „Nu. Cel mai aproape e liber de pe 13 pe 16.”
- Pe ecran: ce a înțeles aplicația (sosire, plecare, persoane, vilă, toate editabile), lista camerelor libere
  cu prețul total din Tarife și butonul „Rezervă”, care deschide rezervarea completată.
- Dacă nu e nimic liber, aplicația propune:
  - aceeași durată mutată cu ±1–3 zile;
  - „liberă doar până pe 14” pentru camera cea mai apropiată;
  - două camere alăturate când grupul nu încape într-una.
- Același formular merge și tastat, pentru recepție.
- Risc de verificat: pagina de artefact de pe claude.ai poate să nu dea voie la microfon.
  Pe un domeniu propriu merge sigur.

### Varianta 2: complet fără mâini, după ce avem server

- Bot pe Telegram (gratuit, simplu) sau WhatsApp (API Business, cu aprobare și cost).
- Android Auto și CarPlay citesc mesajele cu voce și te lasă să dictezi răspunsul,
  deci poți întreba fără să atingi telefonul deloc.
- Mesajele vocale sau libere („ai ceva weekendul viitor pentru 2 adulți și un copil, la Mateo?”) sunt înțelese de un LLM:
  - modelul mic Claude Haiku costă sub un ban pe întrebare;
  - modelul doar scoate datele, persoanele și vila din mesaj, apoi apelează căutarea din aplicație (tool use);
  - poate scrie și răspunsul gata de trimis clientului.
- Cheia API stă pe server, niciodată în pagină.

### Ordinea propusă

1. Motorul de căutare a disponibilității, în `domain/`, cu teste. Îl folosesc toate variantele.
2. Formularul „Caută loc liber” + microfonul.
3. Botul, după ce există server.

## 2. Trebuie să rămână totul într-un singur HTML?

Nu, a venit momentul să ieșim din el.

### De ce

- **Datele stau doar în browserul care deschide pagina** (localStorage). Rezervarea făcută pe telefon nu apare la recepție
  pe calculator. Pentru uz real trebuie server, bază de date comună, login și mai mulți utilizatori.
- **e-Factura se face doar pe server:**
  - SPV ANAF, cu autentificare prin certificat digital;
  - factura în XML UBL / CIUS-RO;
  - termen de transmitere de respectat;
  - `invoices.efactura_id` e deja prevăzut în [ARCHITECTURE.md](ARCHITECTURE.md).
- La fel au nevoie de server botul, sincronizarea cu Booking și Airbnb, plățile online.
- Fișierul are ~240 KB și ~2.700 de rânduri de JS. Pentru un demo merge, dar încă o pagină mare (facturi) îl face greu de ținut.

### Vue sau React

Amândouă duc aplicația, iar diferența contează mai puțin decât trecerea la server + bază de date.

| | Next.js (React) | Nuxt (Vue) |
|---|---|---|
| Ce e | Interfață și API în același proiect | Același lucru, pe Vue |
| Plus | Ecosistem mare, cele mai multe exemple | Cod mai ușor de citit la început |
| Bază de date | PostgreSQL (EXCLUDE constraint contra suprapunerilor) | La fel |
| Status | Recomandarea actuală din ARCHITECTURE.md | Alternativă egală, dacă preferi Vue |

Decizie de luat: React (Next.js) sau Vue (Nuxt). Fără preferință, rămâne Next.js.

### Cum arată proiectul împărțit

```
app/ sau pages/     câte o pagină: calendar, azi, rezervări, oaspeți, camere, tarife, financiar, facturi
components/         TapeChart, RatesGrid, FinanceCharts, ReservationDrawer, ReservationModal, PropBar, …
domain/             reguli pure, fără interfață, cu teste; rulează și pe server:
                    conflicts, availability, pricing (rateFor, stayPrice), finance (comisioane, profit)
server/ sau api/    rezervări, plăți, tarife, cheltuieli, facturi, e-Factura, bot
db/                 schema și migrațiile PostgreSQL
```

### Cum trecem fără să pierdem ce merge

1. Proiect nou. Demo-ul de acum rămâne specificația vizuală și „încearcă fără cont” pe pagina de prezentare.
2. Mutăm întâi `domain/` (suprapuneri, prețuri, finanțe), cu teste, apoi pagină cu pagină:
   calendarul, apoi Azi, Rezervări, Tarife, Financiar.
3. Server + PostgreSQL + login. Baza de date refuză singură rezervările suprapuse.
4. Deasupra: facturi și e-Factura, căutarea vocală și botul, iCal cu Booking și Airbnb.
