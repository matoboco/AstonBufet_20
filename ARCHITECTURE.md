# Architektúra Aston Bufet 2.0

## Prehľad systému

```
┌─────────────────────────────────────────────────────────────┐
│                        Kubernetes                            │
├─────────────┬─────────────┬─────────────┬──────────────────┤
│  frontend   │   backend   │  reminder   │        db        │
│  (nginx)    │  (express)  │  (cronjob)  │   (postgres)     │
│   :80       │    :3001    │             │     :5432        │
└─────────────┴─────────────┴─────────────┴──────────────────┘
```

Aplikácia pozostáva zo 4 služieb:

| Služba | Technológia | Účel |
|--------|-------------|------|
| **frontend** | Nginx + React SPA | Používateľské rozhranie (PWA) |
| **backend** | Node.js + Express | REST API server |
| **reminder** | Node.js (CronJob) | Automatické emailové pripomienky (1. v mesiaci) |
| **db** | PostgreSQL 16 | Databáza |

---

## Frontend

### Technológie

- **React 18** + TypeScript
- **Vite** - build tool
- **Tailwind CSS** - styling
- **React Router** - routing
- **PWA** - service worker, offline podpora

### Štruktúra

```
frontend/src/
├── main.tsx              # Entry point
├── App.tsx               # Hlavný komponent, routing
├── types.ts              # TypeScript typy
├── components/
│   ├── BalanceCard.tsx       # Karta so zostatkom
│   ├── BarcodeScanner.tsx    # Skener čiarových kódov (kamera)
│   ├── Navigation.tsx        # Spodná navigácia
│   ├── ProductCard.tsx       # Karta produktu
│   ├── PurchaseModal.tsx     # Modal pre nákup
│   ├── ShortageWarningModal.tsx  # Upozornenie na manko
│   └── TransactionList.tsx   # Zoznam transakcií
├── pages/
│   ├── Login.tsx            # Prihlásenie (OTP)
│   ├── Dashboard.tsx        # Hlavná stránka (zostatok, rýchle akcie)
│   ├── Products.tsx         # Zoznam produktov, nákup
│   ├── Profile.tsx          # Profil používateľa
│   ├── History.tsx          # História transakcií
│   └── OfficeDashboard.tsx  # Dashboard pre office assistant
├── hooks/
│   └── useAuth.ts           # Autentifikácia (JWT, localStorage)
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

## Backend

### Technológie

- **Node.js** + TypeScript
- **Express** - HTTP framework
- **PostgreSQL** - databáza (pg driver)
- **JWT** - autentifikácia
- **Nodemailer** - odosielanie emailov
- **Zod** - validácia vstupov

### Štruktúra

```
backend/src/
├── index.ts              # Entry point, Express app
├── types.ts              # TypeScript typy
├── db.ts                 # Databázové pripojenie, query helper
├── middleware.ts         # JWT autentifikácia, role check
├── validation.ts         # Zod schémy pre validáciu
├── email.ts              # Odosielanie emailov (OTP, pripomienky)
├── reminder.ts           # Cron job pre automatické pripomienky
├── routes/
│   ├── auth.ts           # Prihlásenie, verifikácia OTP
│   ├── products.ts       # CRUD produktov
│   ├── purchases.ts      # Nákupy (FIFO účtovanie)
│   ├── stock.ts          # Naskladnenie, inventúra
│   ├── account.ts        # Zostatky, vklady, história
│   └── admin.ts          # Admin operácie
└── migrations/
    └── runner.ts         # Automatické migrácie pri štarte
```

### API Endpointy

#### Autentifikácia (`/auth`)

| Metóda | Endpoint | Popis |
|--------|----------|-------|
| POST | `/auth/login` | Odoslanie OTP na email |
| POST | `/auth/verify` | Overenie OTP, vrátenie JWT |
| GET | `/auth/me` | Aktuálny používateľ |
| PUT | `/auth/profile` | Aktualizácia profilu (meno) |

#### Produkty (`/products`)

| Metóda | Endpoint | Popis |
|--------|----------|-------|
| GET | `/products` | Zoznam produktov so stavom skladu |
| GET | `/products/:id` | Detail produktu |
| GET | `/products/by-ean/:ean` | Vyhľadanie podľa EAN |
| GET | `/products/:id/price-preview` | Kalkulácia FIFO ceny |
| PUT | `/products/:id` | Úprava produktu (office_assistant) |
| DELETE | `/products/:id` | Zmazanie produktu (office_assistant) |

#### Nákupy (`/purchases`)

| Metóda | Endpoint | Popis |
|--------|----------|-------|
| POST | `/purchases` | Vykonanie nákupu (FIFO) |

#### Sklad (`/stock`)

| Metóda | Endpoint | Popis |
|--------|----------|-------|
| POST | `/stock/add` | Naskladnenie tovaru |
| GET | `/stock/batches` | Zoznam šarží |
| POST | `/stock/adjust` | Inventúra (korekcia stavu) |
| GET | `/stock/adjustments` | História korekcií |

#### Účet (`/account`)

| Metóda | Endpoint | Popis |
|--------|----------|-------|
| GET | `/account/my-balance` | Môj zostatok |
| GET | `/account/my-history` | Moja história |
| GET | `/account/balances` | Všetky zostatky (office_assistant) |
| POST | `/account/deposit` | Vklad hotovosti (office_assistant) |
| POST | `/account/send-reminders` | Odoslanie pripomienok (office_assistant) |
| GET | `/account/shortage-warning` | Kontrola upozornenia na manko |
| POST | `/account/acknowledge-shortage` | Potvrdenie upozornenia |
| GET | `/account/shortage-summary` | Súhrn manka a príspevkov |

---

## Databáza

### ER Diagram

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│    users     │     │  account_entries │     │    products     │
├──────────────┤     ├──────────────────┤     ├─────────────────┤
│ id (PK)      │◄────│ user_id (FK)     │     │ id (PK)         │
│ email        │     │ id (PK)          │     │ name            │
│ name         │     │ amount_cents     │     │ ean             │
│ role         │     │ description      │     │ price_cents     │
│ token_version│     │ created_at       │     │ created_at      │
│ created_at   │     └──────────────────┘     └────────┬────────┘
└──────┬───────┘                                       │
       │                                               │
       │         ┌──────────────────────┐              │
       │         │   stock_batches      │◄─────────────┘
       │         ├──────────────────────┤
       │         │ id (PK)              │
       │         │ product_id (FK)      │
       │         │ quantity             │
       │         │ price_cents          │
       │         │ created_at           │
       │         └──────────────────────┘
       │
       │         ┌──────────────────────┐
       ├────────►│  stock_adjustments   │
       │         ├──────────────────────┤
       │         │ id (PK)              │
       │         │ product_id (FK)      │
       │         │ expected_quantity    │
       │         │ actual_quantity      │
       │         │ difference           │
       │         │ is_write_off         │
       │         │ created_by (FK)      │
       │         └──────────────────────┘
       │
       │         ┌────────────────────────────┐
       ├────────►│  shortage_acknowledgements │
       │         ├────────────────────────────┤
       │         │ id (PK)                    │
       │         │ user_id (FK)               │
       │         │ acknowledged_at            │
       │         │ shortage_total             │
       │         └────────────────────────────┘
       │
       │         ┌────────────────────────────┐
       └────────►│  shortage_contributions    │
                 ├────────────────────────────┤
                 │ id (PK)                    │
                 │ user_id (FK)               │
                 │ amount_cents               │
                 │ recorded_by (FK)           │
                 │ created_at                 │
                 └────────────────────────────┘

┌──────────────┐
│ login_codes  │
├──────────────┤
│ id (PK)      │
│ email        │
│ code         │
│ expires_at   │
│ used         │
└──────────────┘
```

### Tabuľky

| Tabuľka | Popis |
|---------|-------|
| `users` | Používatelia (email, meno, rola) |
| `products` | Produkty (názov, EAN, cena) |
| `stock_batches` | Šarže skladu (FIFO inventár) |
| `account_entries` | Účtovné záznamy (nákupy, vklady) |
| `login_codes` | Jednorazové prihlasovacie kódy (OTP) |
| `stock_adjustments` | Inventúrne korekcie (manko/prebytok) |
| `shortage_acknowledgements` | Potvrdenia upozornení na manko |
| `shortage_contributions` | Príspevky na pokrytie manka |

### Views

| View | Popis |
|------|-------|
| `account_balances` | Agregované zostatky používateľov |
| `account_history` | História s priebežným zostatkom |
| `shortage_summary` | Celkové manko a príspevky |

---

## FIFO Účtovanie

Pri nákupe sa použije metóda **First In, First Out**:

1. Načítajú sa šarže produktu zoradené podľa `created_at ASC`
2. Množstvo sa odoberá z najstarších šarží
3. Cena sa počíta ako súčet (množstvo × cena) z každej šarže
4. Prázdne šarže (quantity = 0) sa nemažú, zostávajú pre históriu

**Príklad:**
```
Šarža 1: 5 ks × 0.80 € (najstaršia)
Šarža 2: 10 ks × 0.90 €

Nákup: 7 ks
→ 5 ks z Šarže 1 = 4.00 €
→ 2 ks z Šarže 2 = 1.80 €
→ Celkom: 5.80 €
```

---

## Autentifikácia

1. Používateľ zadá email
2. Server vygeneruje 6-miestny OTP a odošle ho emailom
3. Používateľ zadá OTP kód
4. Server overí kód a vráti JWT token
5. Frontend uloží token do `localStorage`
6. Každý API request obsahuje `Authorization: Bearer {token}`

JWT payload obsahuje:
- `userId` - UUID používateľa
- `email` - emailová adresa
- `name` - meno (voliteľné)
- `role` - 'user' alebo 'office_assistant'
- `tokenVersion` - verzia tokenu (pre invalidáciu)

---

## Migrácie

Migrácie sa spúšťajú automaticky pri štarte backendu:

```
backend/db/migrations/
├── 001_initial_schema.sql      # Základné tabuľky
├── 002_seed_data.sql           # Testovacie dáta
├── 003_stock_adjustments.sql   # Inventúra
├── 004_shortage_acknowledgements.sql  # Upozornenia na manko
├── 005_stock_write_off.sql     # Odpisy
├── 006_user_name.sql           # Meno používateľa
└── 007_shortage_contributions.sql     # Príspevky na manko
```

Tabuľka `_migrations` sleduje aplikované migrácie.

---

## Environment Variables

### Backend

| Premenná | Popis | Default |
|----------|-------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `JWT_SECRET` | Secret pre JWT podpisy | - |
| `PORT` | Port servera | 3001 |
| `CORS_ORIGIN` | Povolený origin | http://localhost:3000 |
| `SMTP_MODE` | `smtp` alebo `console` | console |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | SMTP konfigurácia | - |
| `RUN_MIGRATIONS` | Spustiť migrácie pri štarte | true |
| `OFFICE_ASSISTANT_EMAILS` | Emaily s office_assistant rolou | - |

### Frontend (build-time)

| Premenná | Popis |
|----------|-------|
| `__APP_VERSION__` | Verzia z package.json |
| `__BUILD_TIME__` | Timestamp buildu |
| `__GIT_COMMIT__` | Skrátený git commit hash |
