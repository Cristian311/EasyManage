# EasyManage

EasyManage este un sistem de management pentru pensiuni și unități de cazare, proiectat pentru gestionarea rezervărilor, camerelor, oaspeților, tarifelor, facturilor și a operațiunilor de recepție dintr-un singur loc.

Proiectul a pornit de la un demo interactiv și a evoluat într-o aplicație web full-stack bazată pe Next.js, cu date persistente și logică de business aplicată pe server.

## Ce include proiectul

- calendar de rezervări pe camere
- gestionarea camerelor și etajelor
- registre de oaspeți și rezervări
- plăți și solduri
- tarife și finanțe
- facturi / documente de cazare
- setări pentru firmă și confirmare rezervare
- databasă locală pentru dezvoltare și suport pentru PostgreSQL în producție

## Stack tehnologic

- Next.js 15
- React 19
- TypeScript
- PostgreSQL / PGlite
- Zustand
- Vitest

## Structura proiectului

```text
EasyManage/
├── ARCHITECTURE.md          # arhitectura propusă și detalii de design
├── ROADMAP.md               # planuri și priorități
├── IDEI-NOI.md              # idei și extensii
├── index.html               # demo static inițial
├── velora-stay-demo.html    # demo interactiv / prototip
├── web/                     # aplicația principală (Next.js)
│   ├── app/                 # pagini și API routes
│   ├── components/          # componente UI
│   ├── db/                  # migrații și schemă
│   ├── domain/              # reguli de business
│   ├── lib/                 # repo-uri, date demo, servicii
│   ├── public/              # resurse statice
│   ├── README.md            # documentație detaliată pentru aplicație
│   ├── package.json         # comenzi pentru dezvoltare
│   └── ...
└── README.md                # documentație generală a proiectului
```

## Pornire rapidă

1. Verifică că ai Node.js 20+ instalat.
2. Deschide terminalul în folderul `web`.
3. Instalează dependențele:

```bash
npm install
```

4. Pornește aplicația:

```bash
npm run dev
```

5. Deschide în browser:

```text
http://localhost:3000
```

## Comenzi utile

În folderul `web` poți folosi:

```bash
npm run dev
npm run build
npm run start
npm test
npm run typecheck
npm run db:reset
npm run db:sql -- "SELECT name, price FROM rooms"
```

## Documentație suplimentară

Pentru detalii mai ample despre funcționalități, fluxuri, API și modul de dezvoltare, vezi:

- [web/README.md](web/README.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [ROADMAP.md](ROADMAP.md)
- [IDEI-NOI.md](IDEI-NOI.md)

## Scopul aplicației

Aplicația este construită pentru managementul unei pensiuni sau al unei structuri de cazare care necesită:

- control eficient al rezervărilor
- sincronizare între recepție și datele din sistem
- vizualizare clară a disponibilității camerelor
- gestionarea plăților și facturilor
- un flux simplu de confirmare rezervare către oaspete

## Notă

Proiectul este încă în evoluție și include atât funcționalități implementate, cât și alte elemente planificate în roadmap. Pentru informații actuale despre starea aplicației și priorități, consultă documentele din rădăcina proiectului.
