# Architektúra Aston Bufet 2.0

## Prehľad systému

```
┌─────────────────────────────────────────────────────────┐
│                  Cloudflare Platform                     │
├──────────────────┬──────────────────┬───────────────────┤
│    frontend      │     worker       │       D1          │
│ (static/Pages)   │  (Hono on Edge)  │    (SQLite)       │
│                  │   + Cron Triggers│                   │
└──────────────────┴──────────────────┴───────────────────┘
```

Aplikácia pozostáva z 2 hlavných častí:

| Časť | Technológia | Účel |
|------|-------------|------|
| **frontend** | React SPA (Vite build) | Používateľské rozhranie (PWA) |
| **worker** | Cloudflare Worker (Hono) + Cron Triggers | REST API + automatické pripomienky + cleanup OTP |
| **D1** | Cloudflare D1 (SQLite) | Databáza |

---

## Frontend

### Technológie

- **React 18** + TypeScript
- **Vite** - build tool
- **Tailwind CSS** - styling
- **React Router** - routing
- **PWA** - service worker, offline podpora (vite-plugin-pwa)
- **@zxing/library** + **react-webcam** - skenovanie čiarových kódov

### Štruktúra

```
frontend/src/
├── main.tsx              # Entry point
├── App.tsx               # Hlavný komponent, routing
├── types.ts              # TypeScript typy
├── components/
│   ├── BalanceCard.tsx           # Karta so zostatkom
│   ├── BarcodeScanner.tsx        # Skener čiarových kódov (kamera)
│   ├── HelpTips.tsx              # Pomocné tipy
│   ├── Logo.tsx                  # Logo komponent
│   ├── Navigation.tsx            # Spodná navigácia
│   ├── ProductCard.tsx           # Karta produktu
│   ├── PullToRefreshIndicator.tsx # Pull-to-refresh indikátor
│   ├── PurchaseModal.tsx         # Modal pre nákup
│   ├── ShortageWarningModal.tsx  # Upozornenie na manko
│   └── TransactionList.tsx       # Zoznam transakcií
├── pages/
│   ├── Login.tsx            # Prihlásenie (OTP)
│   ├── Dashboard.tsx        # Hlavná stránka (zostatok, rýchle akcie)
│   ├── Products.tsx         # Zoznam produktov, nákup
│   ├── Profile.tsx          # Profil používateľa
│   ├── History.tsx          # História transakcií
│   └── OfficeDashboard.tsx  # Dashboard pre office assistant
├── hooks/
│   ├── useAuth.tsx          # Autentifikácia (JWT, localStorage)
│   └── usePullToRefresh.ts  # Pull-to-refresh hook
└── utils/
    └── api.ts               # HTTP klient pre API volania
```

### Stránky a role

| Stránka | Cesta | Role | Popis |
|---------|-------|------|-------|
| Dashboard | `/` | všetci | Zostatok, rýchle akcie |
| Products | `/products` | všetci | Zoznam produktov, nákup |
| Profile | `/profile` | všetci | Osobné údaje, história, odhlásenie |
| OfficeDashboard | `/office` | office_assistant | Sklad, dlžníci |

### PWA

- `manifest.json` - metadata pre inštaláciu
- `sw.js` - service worker pre caching
- `version.json` - detekcia novej verzie (buildTime)

---

## Worker (Backend)

### Technológie

- **Cloudflare Workers** - serverless edge runtime
- **Hono** - ľahký HTTP framework pre edge
- **Cloudflare D1** - SQLite databáza na edge
- **jose** - JWT autentifikácia (Web Crypto API kompatibilná)
- **Zod** - validácia vstupov
- **SMTP2GO** - odosielanie emailov cez HTTP API
- **Cron Triggers** - plánované úlohy (pripomienky, cleanup)

### Prečo Cloudflare Workers?

| Výhoda | Popis |
|--------|-------|
| Edge runtime | Kód beží blízko používateľov, nízka latencia |
| Serverless | Žiadna správa serverov, automatické škálovanie |
| D1 databáza | SQLite na edge, žiadna správa PostgreSQL |
| Cron Triggers | Natívne plánované úlohy bez externých služieb |
| Nulové cold starts | Workers sa štartujú v milisekundách |
| Integrácia | Jeden ekosystém (Workers + D1 + Pages) |

### Štruktúra

```
worker/
├── wrangler.toml          # Konfigurácia Workers (bindings, crons, D1)
├── src/
│   ├── index.ts           # Entry point, Hono app, cron handler
│   ├── types.ts           # TypeScript typy a Env interface
│   ├── db.ts              # D1 database helpers (query, batch, UUID)
│   ├── middleware.ts       # JWT autentifikácia, role check (jose)
│   ├── validation.ts      # Zod schémy pre validáciu
│   ├── email.ts           # Odosielanie emailov (SMTP2GO HTTP API)
│   └── routes/
│       ├── auth.ts        # Prihlásenie, OTP, overenie, profil
│       ├── products.ts    # CRUD produktov, akciové ceny
│       ├── purchases.ts   # Nákupy (FIFO účtovanie, D1 batch)
│       ├── stock.ts       # Naskladnenie, inventúra
│       ├── account.ts     # Zostatky, vklady, história, manko
│       └── admin.ts       # Pripomienky, dlžníci, zoznam používateľov
└── db/
    └── migrations/
        ├── 001_schema.sql # Kompletná schéma (SQLite syntax)
        └── 002_seed.sql   # Testovacie dáta
```

### API Endpointy

#### Autentifikácia (`/auth`)

| Metóda | Endpoint | Popis |
|--------|----------|-------|
| POST | `/auth/request-code` | Odoslanie OTP na email |
| POST | `/auth/verify-code` | Overenie OTP, vrátenie JWT |
| PUT | `/auth/profile` | Aktualizácia profilu (meno) |

#### Produkty (`/products`)

| Metóda | Endpoint | Popis |
|--------|----------|-------|
| GET | `/products` | Zoznam produktov so stavom skladu |
| GET | `/products/on-sale` | Produkty v akcii |
| GET | `/products/:id` | Detail produktu |
| GET | `/products/by-ean/:ean` | Vyhľadanie podľa EAN |
| GET | `/products/:id/price-preview` | Kalkulácia FIFO / akčnej ceny |
| PUT | `/products/:id` | Úprava produktu (office_assistant) |
| DELETE | `/products/:id` | Zmazanie produktu (office_assistant) |

#### Nákupy (`/purchases`)

| Metóda | Endpoint | Popis |
|--------|----------|-------|
| POST | `/purchases` | Vykonanie nákupu (FIFO, D1 batch) |

#### Sklad (`/stock`)

| Metóda | Endpoint | Popis |
|--------|----------|-------|
| GET | `/stock` | Zoznam šarží na sklade (office_assistant) |
| POST | `/stock/add-batch` | Naskladnenie tovaru |
| POST | `/stock/adjustment` | Inventúra (korekcia stavu) |
| GET | `/stock/adjustments` | História korekcií |

#### Účet (`/account`)

| Metóda | Endpoint | Popis |
|--------|----------|-------|
| GET | `/account/my-balance` | Môj zostatok |
| GET | `/account/my-history` | Moja história (posledných 50) |
| GET | `/account/balances` | Všetky zostatky (office_assistant) |
| GET | `/account/history/:user_id` | História konkrétneho používateľa |
| POST | `/account/deposit` | Vklad + voliteľný príspevok na manko |
| GET | `/account/shortage-warning` | Kontrola upozornenia na manko |
| POST | `/account/acknowledge-shortage` | Potvrdenie upozornenia |
| GET | `/account/shortage-summary` | Súhrn manka a príspevkov |

#### Admin (`/admin`)

| Metóda | Endpoint | Popis |
|--------|----------|-------|
| POST | `/admin/reminder` | Manuálne odoslanie pripomienok |
| GET | `/admin/debtors` | Zoznam dlžníkov |
| GET | `/admin/users` | Zoznam všetkých používateľov |

### Cron Triggers

| Cron výraz | Čas | Úloha |
|------------|-----|-------|
| `0 8 1 * *` | 1. deň mesiaca, 8:00 UTC | Odoslanie pripomienok dlžníkom (balance < -5 EUR) |
| `0 0 * * *` | Denne o polnoci UTC | Čistenie expirovaných/použitých OTP kódov |

---

## Databáza (Cloudflare D1 / SQLite)

### ER Diagram

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│    users     │     │  account_entries │     │    products     │
├──────────────┤     ├──────────────────┤     ├─────────────────┤
│ id (PK,TEXT) │◄────│ user_id (FK)     │     │ id (PK,TEXT)    │
│ email        │     │ id (PK,TEXT)     │     │ name            │
│ name         │     │ amount_cents     │     │ ean             │
│ role         │     │ description      │     │ price_cents     │
│ token_version│     │ created_at       │     │ sale_price_cents│
│ created_at   │     └──────────────────┘     │ sale_expires_at │
└──────┬───────┘                              │ created_at      │
       │                                      └────────┬────────┘
       │                                               │
       │         ┌──────────────────────┐              │
       │         │   stock_batches      │◄─────────────┘
       │         ├──────────────────────┤
       │         │ id (PK,TEXT)         │
       │         │ product_id (FK)      │
       │         │ quantity             │
       │         │ price_cents          │
       │         │ created_at           │
       │         └──────────────────────┘
       │
       │         ┌──────────────────────┐
       ├────────►│  stock_adjustments   │
       │         ├──────────────────────┤
       │         │ id (PK,TEXT)         │
       │         │ product_id (FK)      │
       │         │ expected_quantity    │
       │         │ actual_quantity      │
       │         │ difference           │
       │         │ reason               │
       │         │ is_write_off (0/1)   │
       │         │ created_by (FK)      │
       │         │ created_at           │
       │         └──────────────────────┘
       │
       │         ┌────────────────────────────┐
       ├────────►│  shortage_acknowledgements │
       │         ├────────────────────────────┤
       │         │ id (PK,TEXT)               │
       │         │ user_id (FK, UNIQUE)       │
       │         │ acknowledged_at            │
       │         │ shortage_total             │
       │         └────────────────────────────┘
       │
       │         ┌────────────────────────────┐
       └────────►│  shortage_contributions    │
                 ├────────────────────────────┤
                 │ id (PK,TEXT)               │
                 │ user_id (FK)               │
                 │ amount_cents               │
                 │ description                │
                 │ recorded_by (FK)           │
                 │ created_at                 │
                 └────────────────────────────┘

┌──────────────┐
│ login_codes  │
├──────────────┤
│ id (PK,TEXT) │
│ email        │
│ code         │
│ expires_at   │
│ used (0/1)   │
└──────────────┘
```

### Tabuľky

| Tabuľka | Popis |
|---------|-------|
| `users` | Používatelia (email, meno, rola) |
| `products` | Produkty (názov, EAN, cena, akciová cena) |
| `stock_batches` | Šarže skladu (FIFO inventár) |
| `account_entries` | Účtovné záznamy (nákupy, vklady) |
| `login_codes` | Jednorazové prihlasovacie kódy (OTP) |
| `stock_adjustments` | Inventúrne korekcie (manko/prebytok/odpisy) |
| `shortage_acknowledgements` | Potvrdenia upozornení na manko |
| `shortage_contributions` | Príspevky na pokrytie manka |

### Rozdiely oproti pôvodnému PostgreSQL

| PostgreSQL (pôvodne) | D1 / SQLite (teraz) |
|----------------------|---------------------|
| UUID typ | TEXT s generovaným UUID (`randomblob`) |
| TIMESTAMP | TEXT (ISO 8601 datetime) |
| BOOLEAN | INTEGER (0/1) |
| `NOW()` | `datetime('now')` |
| BEGIN/COMMIT transakcie | D1 `batch()` (atomické) |
| Database views | Inline SQL queries |
| pg driver + Pool | D1 binding (`env.DB`) |
| Nodemailer (SMTP) | SMTP2GO HTTP API (`fetch`) |

---

## FIFO Účtovanie

Pri nákupe sa použije metóda **First In, First Out**:

1. Načítajú sa šarže produktu zoradené podľa `created_at ASC`
2. Množstvo sa odoberá z najstarších šarží
3. Cena sa počíta ako súčet (množstvo × cena) z každej šarže
4. Prázdne šarže (quantity = 0) sa nemažú, zostávajú pre históriu
5. Všetky zápisy (update šarží + account entry) sa vykonajú cez `D1 batch()` atomicky

**Akciové ceny:** Ak má produkt aktívnu akciu (`sale_price_cents` + `sale_expires_at > now`), použije sa akciová cena namiesto FIFO ceny šarží.

**Príklad:**
```
Šarža 1: 5 ks × 0.80 EUR (najstaršia)
Šarža 2: 10 ks × 0.90 EUR

Nákup: 7 ks
→ 5 ks z Šarže 1 = 4.00 EUR
→ 2 ks z Šarže 2 = 1.80 EUR
→ Celkom: 5.80 EUR
```

---

## Autentifikácia

1. Používateľ zadá email (len povolené domény, napr. `aston.sk`)
2. Server vygeneruje 6-miestny OTP (`crypto.getRandomValues`) a odošle ho cez SMTP2GO
3. Používateľ zadá OTP kód
4. Server overí kód a vráti JWT token (platnosť 365 dní)
5. Frontend uloží token do `localStorage`
6. Každý API request obsahuje `Authorization: Bearer {token}`

JWT payload obsahuje:
- `userId` - UUID používateľa
- `email` - emailová adresa
- `name` - meno (voliteľné)
- `role` - 'user' alebo 'office_assistant'
- `tokenVersion` - verzia tokenu (pre invalidáciu)

JWT knižnica: **jose** (kompatibilná s Web Crypto API v Workers)

---

## Migrácie

Migrácie sa spravujú cez Wrangler CLI:

```
worker/db/migrations/
├── 001_schema.sql    # Kompletná schéma (všetky tabuľky + indexy)
└── 002_seed.sql      # Testovacie dáta
```

Príkazy:
- `wrangler d1 execute aston-bufet-db --local --file=db/migrations/001_schema.sql` - lokálne
- `wrangler d1 execute aston-bufet-db --remote --file=db/migrations/001_schema.sql` - produkcia

---

## Environment Variables / Bindings

### Worker (wrangler.toml + secrets)

| Premenná | Typ | Popis |
|----------|-----|-------|
| `DB` | D1 Binding | Cloudflare D1 databáza |
| `JWT_SECRET` | Secret | Secret pre JWT podpisy |
| `SMTP_API_KEY` | Secret | API kľúč pre SMTP2GO |
| `CORS_ORIGIN` | Var | Povolený origin (napr. `https://bufet.aston.sk`) |
| `SMTP_MODE` | Var | `production` alebo `console` |
| `SMTP_FROM` | Var | Odosielateľ emailov |
| `OFFICE_ASSISTANT_EMAILS` | Var | Suffix emailov s rolou office_assistant |
| `ALLOWED_EMAIL_DOMAINS` | Var | Povolené emailové domény |

### Frontend (build-time)

| Premenná | Popis |
|----------|-------|
| `__APP_VERSION__` | Verzia z package.json |
| `__BUILD_TIME__` | Timestamp buildu |
| `__GIT_COMMIT__` | Skrátený git commit hash |
