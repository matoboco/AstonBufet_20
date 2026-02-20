# Kompletný popis BE + Plán migrácie na Cloudflare Workers + D1

---

## ČASŤ 1: Ako funguje aktuálny Backend

### 1.1 Technologický stack

| Vrstva | Technológia |
|--------|-------------|
| Runtime | **Bun** (TypeScript natívne, bez kompilácie) |
| HTTP Framework | **Express 4** |
| Databáza | **PostgreSQL 16** (cez `pg` driver, connection pool) |
| Auth | **JWT** (jsonwebtoken) + OTP cez email |
| Validácia | **Zod** schémy |
| Email | **Nodemailer** (SMTP alebo console mode) |
| Cron | **node-cron** (pripomienky dlžníkom) |
| Deploy | **Docker** (docker-compose: db + backend + frontend/nginx) |

### 1.2 Vstupný bod a inicializácia (`src/index.ts`)

1. Načíta `.env` premenné
2. Vytvorí Express app s CORS + JSON middleware
3. Pridá request logging (dekóduje JWT pre email)
4. Registruje route handlery: `/auth`, `/products`, `/purchases`, `/stock`, `/account`, `/admin`
5. Pridá `/health` a `/version` endpointy
6. Pri štarte:
   - Čaká na DB pripojenie (retry loop 30x)
   - Spustí SQL migrácie (ak `RUN_MIGRATIONS !== false`)
   - Nastartuje HTTP server na `PORT`
   - Naplánuje cron job: 1. deň mesiaca o 9:00 → odoslanie pripomienok dlžníkom

### 1.3 Databázová vrstva (`src/db.ts`)

- **Connection pool** cez `pg.Pool` s `DATABASE_URL`
- Helper funkcie:
  - `query<T>(sql, params)` → vráti `T[]` (rows)
  - `queryOne<T>(sql, params)` → vráti `T | null`
  - `getClient()` → pre transakcie (BEGIN/COMMIT/ROLLBACK)
- `waitForDatabase()` → retry loop pre Docker startup
- `initializeDatabase()` → spustí migrácie

### 1.4 Autentifikácia a autorizácia (`src/middleware.ts`)

- **OTP Flow**: Email → 6-digit kód (platný 10 min) → JWT token
- **JWT payload**: `{ userId, email, name, role, tokenVersion }`
- **Token verifikácia**: Overí `token_version` v DB (umožňuje invalidáciu)
- **Token platnosť**: 365 dní
- **Middleware**:
  - `authenticateToken` → overí JWT + token_version v DB
  - `requireRole(...roles)` → kontrola role (user / office_assistant)
  - `requireSelfOrRole(role)` → prístup k vlastným dátam alebo s vyššou rolou
- **Roly**: `user` (bežný zamestnanec), `office_assistant` (správca bufetu)
- **Role assignment**: Podľa `OFFICE_ASSISTANT_EMAILS` env premennej (suffix matching)

### 1.5 Databázová schéma (8 migrácií)

#### Tabuľky:

| Tabuľka | Stĺpce | Účel |
|---------|--------|------|
| `users` | id (UUID PK), email (UNIQUE), name, role, token_version, created_at | Používatelia |
| `products` | id (UUID PK), name, ean (UNIQUE), price_cents, sale_price_cents, sale_expires_at, created_at | Produkty |
| `stock_batches` | id (UUID PK), product_id (FK→products), quantity (≥0), price_cents, created_at | FIFO šarže skladu |
| `account_entries` | id (UUID PK), user_id (FK→users), amount_cents, description, created_at | Účtovný ledger (záporné=nákup, kladné=vklad) |
| `login_codes` | id (UUID PK), email, code, expires_at, used | OTP prihlasovacie kódy |
| `stock_adjustments` | id (UUID PK), product_id (FK), expected_quantity, actual_quantity, difference, reason, created_by (FK), is_write_off, created_at | Inventúrne korekcie |
| `shortage_acknowledgements` | id (UUID PK), user_id (FK, UNIQUE), acknowledged_at, shortage_total | Potvrdenie upozornení na manko |
| `shortage_contributions` | id (UUID PK), user_id (FK), amount_cents (>0), description, recorded_by (FK), created_at | Príspevky na pokrytie manka |
| `_migrations` | id (SERIAL PK), name (UNIQUE), applied_at | Tracking migrácií |

#### Views:

| View | SQL logika |
|------|-----------|
| `account_balances` | SUM(amount_cents)/100 per user → `balance_eur` |
| `account_history` | Window function SUM() OVER → `running_balance_eur` |
| `shortage_summary` | Celkové manko (adjustments × price) vs celkové príspevky |

#### Kľúčové indexy:
- `products(ean)`, `stock_batches(product_id, created_at)`, `account_entries(user_id, created_at)`, `login_codes(email, expires_at)`, `stock_adjustments(product_id, created_at)`

### 1.6 API Endpointy (kompletný zoznam)

#### Auth (`/auth`):
| Metóda | Endpoint | Auth | Popis |
|--------|----------|------|-------|
| POST | `/auth/request-code` | Nie | Odošle OTP na email. Validuje doménu, normalizuje email. |
| POST | `/auth/verify-code` | Nie | Overí OTP, vytvorí/nájde usera, vráti JWT + user info. |
| PUT | `/auth/profile` | Áno | Aktualizácia mena, vráti nový JWT. |

#### Products (`/products`):
| Metóda | Endpoint | Auth | Popis |
|--------|----------|------|-------|
| GET | `/products` | Nie | Zoznam produktov + stock_quantity (JOIN stock_batches, SUM). Sale price len ak nie je expirovaná. |
| GET | `/products/on-sale` | Nie | Produkty s aktívnou akciou a stock > 0. |
| GET | `/products/by-ean/:ean` | Nie | Lookup podľa EAN kódu. |
| GET | `/products/:id` | Nie | Detail produktu + stock. |
| GET | `/products/:id/price-preview` | Nie | FIFO kalkulácia ceny pre N kusov (alebo sale price). |
| PUT | `/products/:id` | office_assistant | Update name/ean/sale price. |
| DELETE | `/products/:id` | office_assistant | Delete (len ak stock = 0). |

#### Purchases (`/purchases`):
| Metóda | Endpoint | Auth | Popis |
|--------|----------|------|-------|
| POST | `/purchases` | Áno | **Atomická transakcia**: BEGIN → overenie stock → FIFO allocation (SELECT FOR UPDATE) → update batches → INSERT account_entry → COMMIT. Vracia alokácie + nový zostatok. Sale price override ak je aktívna akcia. |

#### Stock (`/stock`):
| Metóda | Endpoint | Auth | Popis |
|--------|----------|------|-------|
| GET | `/stock` | office_assistant | Všetky šarže s quantity > 0 + product info. |
| POST | `/stock/add-batch` | office_assistant | Naskladnenie. Ak produkt neexistuje a je `name`, vytvorí ho. Transakcia. |
| POST | `/stock/adjustment` | office_assistant | Inventúra: zaznamená rozdiel, vymaže staré šarže, vytvorí novú s actual_quantity. Transakcia. |
| GET | `/stock/adjustments` | office_assistant | História korekcií (LIMIT 100). |

#### Account (`/account`):
| Metóda | Endpoint | Auth | Popis |
|--------|----------|------|-------|
| GET | `/account/balances` | Áno | office_assistant: všetky; user: len vlastný. View `account_balances`. |
| GET | `/account/my-balance` | Áno | Vlastný zostatok. |
| GET | `/account/history/:user_id` | self/office | História transakcií. View `account_history`. |
| GET | `/account/my-history` | Áno | Vlastná história (LIMIT 50). |
| POST | `/account/deposit` | office_assistant | Vklad + voliteľný príspevok na manko. Odošle email notifikáciu. |
| GET | `/account/shortage-warning` | Áno | Nepotvrdené manko od posledného ack (exkl. write-offs). |
| POST | `/account/acknowledge-shortage` | Áno | UPSERT potvrdenia. |
| GET | `/account/shortage-summary` | office_assistant | Celkové manko vs príspevky. View `shortage_summary`. |

#### Admin (`/admin`):
| Metóda | Endpoint | Auth | Popis |
|--------|----------|------|-------|
| POST | `/admin/reminder` | office_assistant | Manuálne odoslanie pripomienok (balance < -5€). |
| GET | `/admin/debtors` | office_assistant | Zoznam dlžníkov (balance < 0). |
| GET | `/admin/users` | office_assistant | Všetci používatelia + zostatky. |

### 1.7 Email systém (`src/email.ts`)

- **Dual mode**: SMTP (produkcia) alebo Console (development)
- **3 typy emailov**:
  1. **OTP email** → prihlasovací kód
  2. **Deposit email** → potvrdenie vkladu (zostatok pred/po, príspevok)
  3. **Reminder email** → pripomienka dlhu
- HTML + plain text formát
- TLS s `rejectUnauthorized: false` pre interný postfix

### 1.8 FIFO logika (kľúčový business logic)

Pri nákupe:
1. Načítaj šarže produktu ORDER BY `created_at ASC`
2. `SELECT ... FOR UPDATE` (row locking)
3. Odoberaj z najstarších šarží
4. Cena = SUM(odobraté_ks × cena_šarže), alebo sale_price ak je aktívna akcia
5. Ak stock < requested → ROLLBACK
6. INSERT záporný `account_entry`

### 1.9 Cron job (`src/reminder.ts`)

- **Schedule**: 1. deň mesiaca o 9:00 CET
- **Logika**: SELECT z `account_balances` WHERE `balance_eur < -5` → sendReminderEmail pre každého

---

## ČASŤ 2: Plán migrácie na Cloudflare Workers + D1

### 2.1 Prečo Cloudflare Workers + D1?

| Aspekt | Aktuálne (Bun + PG) | CF Workers + D1 |
|--------|---------------------|-----------------|
| Hosting | Docker na vlastnom serveri / K8s | Edge, serverless, globálne |
| DB | PostgreSQL (managed/self-hosted) | D1 (SQLite-based, edge) |
| Scaling | Manuálne | Automatické |
| Cold start | ~100ms | ~0ms (lightweight isolates) |
| Cena | Server cost | Pay-per-request (generous free tier) |
| Údržba | OS, Docker, DB backups | Nulová |

### 2.2 Kľúčové rozdiely a výzvy

| Výzva | Riešenie |
|-------|---------|
| **D1 je SQLite, nie PostgreSQL** | Prepísať SQL: UUID → TEXT s manuálnym generovaním, `NOW()` → `datetime('now')`, žiadne `uuid-ossp`, iný syntax pre UPSERT, žiadne views (alebo simulácia), žiadny `FOR UPDATE` |
| **Žiadny connection pool** | D1 binding — priamy prístup, žiadny pool |
| **Žiadne PostgreSQL views** | Nahradiť SQL views pomocnými queries alebo D1-compatible CREATE VIEW |
| **Žiadny `node-cron`** | Cloudflare **Cron Triggers** (scheduled events) |
| **Žiadny `nodemailer`** | **Cloudflare Email Workers** alebo externé API (SendGrid, Resend, Mailgun, alebo volanie SMTP cez fetch) |
| **Žiadny filesystem** | Migrácie embeddované v kóde alebo cez `wrangler d1 migrations` |
| **Žiadne `FOR UPDATE` row locking** | D1 transakcie sú single-writer — SERIALIZABLE by default, nepotrebujeme FOR UPDATE |
| **Express → Hono/itty-router** | Hono je de facto štandard pre CF Workers |
| **JWT knižnica** | `jose` knižnica (Web Crypto API kompatibilná) namiesto `jsonwebtoken` |
| **UUID generovanie** | `crypto.randomUUID()` (natívne v Workers) |
| **Zod** | Funguje v Workers bez zmien |
| **Env variables** | CF Workers environment bindings (wrangler.toml + secrets) |

### 2.3 Nová architektúra

```
┌─────────────────────────────────────────────────┐
│              Cloudflare Edge Network             │
├──────────────┬──────────────┬───────────────────┤
│   Worker     │   D1 DB      │   Cron Trigger    │
│ (Hono API)   │  (SQLite)    │  (Reminders)      │
│   + JWT      │              │                   │
│   + Zod      │              │                   │
└──────────────┴──────────────┴───────────────────┘
        │                              │
        │                    ┌─────────┴─────────┐
        │                    │  Email Service     │
        │                    │  (Resend/SendGrid) │
        │                    └───────────────────┘
        │
┌───────┴────────┐
│   Frontend     │
│ (CF Pages)     │
│  React SPA     │
└────────────────┘
```

### 2.4 Štruktúra nového projektu

```
worker/
├── wrangler.toml              # CF Worker config, D1 bindings, cron triggers
├── package.json               # hono, jose, zod
├── tsconfig.json
├── src/
│   ├── index.ts               # Hono app, routes, scheduled handler
│   ├── types.ts               # TypeScript typy (rovnaké + Env binding)
│   ├── db.ts                  # D1 query helpers (query, queryOne, transaction)
│   ├── middleware.ts          # JWT auth middleware (jose), role check
│   ├── validation.ts          # Zod schémy (bez zmien)
│   ├── email.ts               # Email cez Resend/SendGrid HTTP API
│   ├── routes/
│   │   ├── auth.ts            # OTP login (rovnaká logika)
│   │   ├── products.ts        # CRUD produktov
│   │   ├── purchases.ts       # FIFO nákup (D1 transakcie)
│   │   ├── stock.ts           # Sklad operácie
│   │   ├── account.ts         # Účty, zostatky, manko
│   │   └── admin.ts           # Admin operácie
│   └── scheduled.ts           # Cron trigger handler (reminders)
└── migrations/
    ├── 0001_initial_schema.sql
    ├── 0002_seed_data.sql
    └── ...
```

### 2.5 Detailný plán implementácie (kroky)

#### Krok 1: Scaffolding projektu
- Inicializácia CF Worker projektu (`npm create cloudflare`)
- `wrangler.toml` s D1 binding, cron trigger `0 9 1 * *`
- Inštalácia závislostí: `hono`, `jose`, `zod`
- TypeScript konfigurácia

#### Krok 2: D1 databázová schéma
- Prepísať migrácie z PostgreSQL na SQLite/D1 syntax:
  - `UUID` → `TEXT` s default `(lower(hex(randomblob(4))) || ...)`  alebo generovanie v kóde cez `crypto.randomUUID()`
  - `TIMESTAMP DEFAULT NOW()` → `TEXT DEFAULT (datetime('now'))`
  - `SERIAL` → `INTEGER PRIMARY KEY AUTOINCREMENT`
  - `CREATE EXTENSION` → odstrániť
  - `ON CONFLICT` syntax upraviť pre SQLite
  - `BOOLEAN` → `INTEGER` (0/1)
  - Window functions (`SUM() OVER()`) → SQLite ich podporuje
  - Views → SQLite ich podporuje (bez zmien)
  - `$1, $2` parametre → `?1, ?2` alebo `?` (D1 podporuje obe)
- Vytvoriť migrácie pre `wrangler d1 migrations`

#### Krok 3: Databázová vrstva (`db.ts`)
- Nahradiť `pg.Pool` za D1 binding:
  ```ts
  export type Env = { DB: D1Database; JWT_SECRET: string; ... }

  const query = async <T>(db: D1Database, sql: string, params?: any[]): Promise<T[]> => {
    const result = await db.prepare(sql).bind(...(params || [])).all<T>();
    return result.results;
  };
  ```
- D1 transakcie cez `db.batch([stmt1, stmt2, ...])` (atomické)

#### Krok 4: Auth middleware (`middleware.ts`)
- Nahradiť `jsonwebtoken` za `jose`:
  ```ts
  import { SignJWT, jwtVerify } from 'jose';
  ```
- `generateToken()` → `new SignJWT(payload).setProtectionHeader(...).sign(secret)`
- `authenticateToken` → Hono middleware

#### Krok 5: Hono routing (`index.ts`)
- Nahradiť Express za Hono:
  ```ts
  import { Hono } from 'hono';
  import { cors } from 'hono/cors';

  const app = new Hono<{ Bindings: Env }>();
  app.use('*', cors());
  app.route('/auth', authRoutes);
  // ...

  export default {
    fetch: app.fetch,
    scheduled: handleScheduled,
  };
  ```

#### Krok 6: Prepísanie route handlers
- Pre každý route file: Express Request/Response → Hono Context (`c`)
- `req.body` → `await c.req.json()`
- `res.json()` → `return c.json()`
- `res.status(400).json()` → `return c.json({...}, 400)`
- `req.user` → `c.get('user')` (cez Hono middleware)
- Raw SQL → D1 prepared statements s `?` parametrami

#### Krok 7: FIFO nákup (purchases.ts) — kritický
- `getClient()` + `BEGIN/COMMIT/ROLLBACK` → D1 `batch()`:
  ```ts
  const results = await c.env.DB.batch([
    db.prepare('SELECT...').bind(...),
    db.prepare('UPDATE...').bind(...),
    db.prepare('INSERT...').bind(...),
  ]);
  ```
- Alternatíva: D1 podporuje aj `exec()` pre multi-statement, ale `batch()` je preferovaný
- `SELECT FOR UPDATE` nie je potrebný — D1 je single-writer
- Pozor: D1 batch je "all or nothing" ale jednotlivé SELECTy v batch nemôžu závisieť na výsledkoch predchádzajúcich statements. FIFO logika vyžaduje najprv SELECT batches, potom vypočítať alokácie v JS, potom batch UPDATEs → bude treba 2 DB round-tripy (SELECT, potom batch UPDATE+INSERT)

#### Krok 8: Email systém
- Odstrániť `nodemailer`
- Implementovať email cez HTTP API (napr. Resend):
  ```ts
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify({ from, to, subject, html }),
  });
  ```
- Zachovať console mode pre development (`env.SMTP_MODE === 'console'` → `console.log`)

#### Krok 9: Cron Trigger (reminders)
- `wrangler.toml`:
  ```toml
  [triggers]
  crons = ["0 9 1 * *"]
  ```
- Handler:
  ```ts
  export default {
    scheduled(event, env, ctx) {
      ctx.waitUntil(sendReminders(env));
    }
  };
  ```

#### Krok 10: Environment / Secrets
- `wrangler.toml` pre non-secret values:
  ```toml
  [vars]
  CORS_ORIGIN = "https://bufet.aston.sk"
  SMTP_MODE = "smtp"
  OFFICE_ASSISTANT_EMAILS = "assistant@aston.sk"
  ```
- `wrangler secret put JWT_SECRET` pre citlivé hodnoty
- `wrangler secret put RESEND_API_KEY`

#### Krok 11: Frontend úpravy
- `VITE_API_URL` → URL CF Workera (napr. `https://bufet-api.company.workers.dev`)
- Alebo: CF Pages s custom domain + Worker route na rovnakej doméne (`/api/*` → Worker)
- Žiadne iné zmeny vo FE kóde

#### Krok 12: Migrácia dát z PostgreSQL do D1
- Export dát z PG: `pg_dump --data-only --inserts`
- Úprava SQL pre SQLite kompatibilitu
- Import cez `wrangler d1 execute`
- Alebo: Write migration script (read PG → write D1 cez API)

#### Krok 13: Testovanie
- Lokálne testovanie cez `wrangler dev` (local D1)
- E2E testy: auth flow, purchase FIFO, stock management
- Verifikácia: FIFO kalkulácie, zostatky, shortage tracking

#### Krok 14: Deployment
- `wrangler deploy`
- DNS nastavenie (custom domain)
- Monitoring cez CF dashboard

### 2.6 Riziká a mitigácie

| Riziko | Závažnosť | Mitigácia |
|--------|-----------|-----------|
| D1 row limit (10M rows free, 10B paid) | Nízke | Pre firemný bufet stačí free tier |
| D1 max DB size (500MB free, 10GB paid) | Nízke | Textové dáta, malý objem |
| D1 read/write latencia | Nízke | D1 je optimalizované pre edge reads |
| FIFO atomicita bez FOR UPDATE | Stredné | D1 single-writer guarantee |
| Email delivery | Stredné | Resend/SendGrid majú vysokú deliverability |
| SQLite vs PG rozdiely | Stredné | Dôkladné testovanie SQL queries |
| Worker CPU limit (10ms free, 30s paid) | Nízke | FIFO výpočty sú rýchle |

### 2.7 Čo sa NEzmení

- **Frontend** — žiadne zmeny v React kóde (len API URL)
- **Business logika** — FIFO, shortage tracking, role-based auth
- **Zod validácia** — identické schémy
- **API kontrakt** — rovnaké endpointy, request/response formáty
- **TypeScript typy** — väčšina zostáva
