# Ralph Loop Agent Prompt: Firemný Bufet Implementation

## MISSION
Implementuj kompletnú **Firemný Bufet PWA aplikáciu** podľa nasledujúceho PRD JSON. Vytvor **fungujúci kód** v separátnom repozitári s Docker Compose ready na spustenie.

## PRD SOURCE
{
  "product": {
    "name": "Firemný Bufet",
    "version": "1.0",
    "description": "Interná PWA aplikácia pre firemný bufet s nákupom na účet, FIFO skladom, vyúčtovaním a automatickými pripomienkami",
    "type": "PWA",
    "target_users": 50
  },
  
  "tech_stack": {
    "frontend": {
      "framework": "React 18 + TypeScript",
      "build_tool": "Vite",
      "styling": "Tailwind CSS",
      "pwa_plugin": "vite-plugin-pwa",
      "barcode_scanner": "@zxing/library + react-webcam"
    },
    "backend": {
      "runtime": "Node.js",
      "framework": "Express",
      "database": "PostgreSQL 16",
      "auth": "JWT (1 rok)",
      "email": "Nodemailer",
      "validation": "Zod",
      "cron": "node-cron"
    },
    "deployment": {
      "docker": "Docker Compose (FE+BE+DB+reminder)",
      "hosting": "Synology NAS"
    }
  },
  
  "database_schema": {
    "tables": [
      {
        "name": "users",
        "columns": [
          {"name": "id", "type": "UUID", "primary_key": true},
          {"name": "email", "type": "TEXT", "unique": true},
          {"name": "role", "type": "TEXT", "default": "'user'", "check": "IN ('user', 'office_assistant')"},
          {"name": "token_version", "type": "INTEGER", "default": 1},
          {"name": "created_at", "type": "TIMESTAMP", "default": "NOW()"}
        ]
      },
      {
        "name": "products",
        "columns": [
          {"name": "id", "type": "UUID", "primary_key": true},
          {"name": "name", "type": "TEXT"},
          {"name": "ean", "type": "TEXT", "unique": true},
          {"name": "price_cents", "type": "INTEGER"},
          {"name": "created_at", "type": "TIMESTAMP", "default": "NOW()"}
        ]
      },
      {
        "name": "stock_batches",
        "columns": [
          {"name": "id", "type": "UUID", "primary_key": true},
          {"name": "product_id", "type": "UUID", "foreign_key": "products.id"},
          {"name": "quantity", "type": "INTEGER"},
          {"name": "price_cents", "type": "INTEGER"},
          {"name": "created_at", "type": "TIMESTAMP", "default": "NOW()"}
        ],
        "description": "FIFO inventory batches"
      },
      {
        "name": "account_entries",
        "columns": [
          {"name": "id", "type": "UUID", "primary_key": true},
          {"name": "user_id", "type": "UUID", "foreign_key": "users.id"},
          {"name": "amount_cents", "type": "INTEGER", "description": "záporné=nákup, kladné=platba"},
          {"name": "description", "type": "TEXT"},
          {"name": "created_at", "type": "TIMESTAMP", "default": "NOW()"}
        ],
        "description": "Running account ledger"
      },
      {
        "name": "login_codes",
        "columns": [
          {"name": "id", "type": "UUID", "primary_key": true},
          {"name": "email", "type": "TEXT"},
          {"name": "code", "type": "TEXT"},
          {"name": "expires_at", "type": "TIMESTAMP"},
          {"name": "used", "type": "BOOLEAN", "default": false}
        ]
      }
    ],
    "views": [
      {
        "name": "account_balances",
        "query": "SELECT u.id, u.email, u.role, COALESCE(SUM(e.amount_cents)/100.0, 0) as balance_eur FROM users u LEFT JOIN account_entries e ON u.id = e.user_id GROUP BY u.id",
        "description": "Aktuálne zostatky účtov"
      },
      {
        "name": "account_history",
        "query": "SELECT e.*, u.email, SUM(e.amount_cents) OVER (PARTITION BY e.user_id ORDER BY e.created_at)/100.0 as running_balance_eur FROM account_entries e JOIN users u ON e.user_id = u.id",
        "description": "História s priebežným stavom"
      }
    ]
  },
  
  "user_roles": {
    "user": [
      "Nákup tovaru (skener EAN / zoznam)",
      "Zobrazenie svojho zostatku a histórie"
    ],
    "office_assistant": [
      "Správa skladu (FIFO batch pridávanie)",
      "Vyúčtovanie dlžníkov (deposity)",
      "Pripomienky dlhu (manual + auto)",
      "Prehľad všetkých účtov"
    ]
  },
  
  "user_flows": {
    "login": [
      "Zadaj firemný email",
      "OTP kód (10 min platnosť)",
      "JWT token (1 rok)"
    ],
    "purchase": [
      "GET /products alebo sken EAN",
      "FIFO alokácia zo stock_batches",
      "INSERT account_entries (amount_cents = -total)",
      "Refresh balance"
    ],
    "add_stock": [
      "Sken EAN → GET /products/by-ean",
      "Ak nový: zadaj name, qty, price",
      "POST /stock/add-batch → nový FIFO batch"
    ],
    "settlement": [
      "GET /account/balances → dlžníci (-balance)",
      "GET /account/history/:user → detail",
      "POST /account/deposit → +amount do ledger"
    ],
    "reminders": [
      "CRON: 1. deň mesiaca 9:00",
      "Email všetkým s balance < -5€",
      "Manual: POST /admin/reminder"
    ]
  },
  
  "api_endpoints": [
    {
      "method": "POST",
      "path": "/auth/request-code",
      "body": "{email}",
      "auth": "none",
      "description": "Poslať OTP kód"
    },
    {
      "method": "POST",
      "path": "/auth/verify-code",
      "body": "{email, code}",
      "auth": "none",
      "description": "Vydaj JWT token s rolou"
    },
    {
      "method": "POST",
      "path": "/purchases",
      "body": "{product_id, quantity}",
      "auth": "user",
      "description": "Nákup + FIFO + ledger entry"
    },
    {
      "method": "POST",
      "path": "/stock/add-batch",
      "body": "{ean, name?, quantity, price_cents}",
      "auth": "office_assistant",
      "description": "Pridať nový FIFO batch"
    },
    {
      "method": "POST",
      "path": "/account/deposit",
      "body": "{user_id, amount_cents, note?}",
      "auth": "office_assistant",
      "description": "Platba / vyrovnanie dlhu"
    },
    {
      "method": "GET",
      "path": "/account/balances",
      "auth": "user (svoj) / office_assistant (všetci)",
      "description": "Aktuálne zostatky"
    },
    {
      "method": "GET",
      "path": "/account/history/:user_id",
      "auth": "self or office_assistant",
      "description": "História transakcií"
    },
    {
      "method": "GET",
      "path": "/products/by-ean/:ean",
      "auth": "none",
      "description": "Produkt podľa EAN"
    },
    {
      "method": "POST",
      "path": "/admin/reminder",
      "auth": "office_assistant",
      "description": "Poslať pripomienky"
    }
  ],
  
  "frontend_screens": [
    {
      "name": "Login",
      "components": ["EmailInput", "OTPInput", "SubmitButton"]
    },
    {
      "name": "Dashboard",
      "components": [
        "BalanceCard (balance_eur - červená/zelená)",
        "RecentTransactions (5 položiek)",
        "QuickActions (Nákup, Skenovať)"
      ]
    },
    {
      "name": "Products",
      "components": ["SearchBar", "ProductGrid", "BarcodeScannerModal"]
    },
    {
      "name": "OfficeDashboard",
      "components": [
        "DebtorsTable (email, balance_eur)",
        "StockManagement",
        "SendRemindersButton"
      ],
      "role": "office_assistant"
    }
  ],
  
  "pwa_features": {
    "manifest": {
      "name": "Firemný Bufet",
      "short_name": "Bufet",
      "icons": ["512x512.png"],
      "theme_color": "#10b981",
      "installable": true
    },
    "service_worker": {
      "cache": ["/products", "/manifest.json"],
      "offline_support": "Produkty + UI"
    }
  },
  
  "deployment": {
    "docker_compose": {
      "services": ["db", "backend", "frontend", "reminder"],
      "ports": {
        "frontend": "3000:3000",
        "backend": "3001:3001",
        "postgres": "5432:5432"
      }
    },
    "environment": {
      "DATABASE_URL": "postgresql://bufet:secret@db:5432/bufet",
      "JWT_SECRET": "32-char-secret-key",
      "SMTP_HOST": "smtp.company.sk"
    }
  },
  
  "non_functional": {
    "security": {
      "auth": "JWT Bearer + role RBAC",
      "transactions": "Atomické operácie",
      "https": "Povinné pre kameru"
    },
    "performance": {
      "ean_lookup": "<50ms index",
      "balance_calc": "Window function optimized"
    },
    "availability": "99% (PWA offline)"
  },
  
  "seed_data": {
    "office_assistant": "assistant@company.sk",
    "test_products": [
      {"name": "Káva", "ean": "1234567890123", "price_cents": 120},
      {"name": "Sendvič", "ean": "9876543210987", "price_cents": 250}
    ]
  },
  
  "rollout_plan": [
    "1. Local Docker dev environment",
    "2. Synology test deploy", 
    "3. User migration + FIFO test",
    "4. Production + cron setup"
  ],
  
  "created": "2026-02-05",
  "status": "Ready for implementation"
}


text

## IMPLEMENTATION SPECS
Frontend: React 18 + TypeScript + Vite + Tailwind + PWA
Backend: Node.js 20 + Express + PostgreSQL 16
Libs: @zxing/library, react-webcam, node-cron, nodemailer, pg, jsonwebtoken, zod
Auth: JWT Bearer + role-based middleware
DB: Exact schema z PRD (vrátane views + indexes)

text

## TASKS (sequential)

### Phase 1: Backend Foundation (40%)
Vytvor backend/ priečinok

package.json + npm i (exact deps z PRD)

.env.example s DATABASE_URL, JWT_SECRET, SMTP_*

DB init.sql (schema + indexes + seed data)

index.js: Express server + middleware (auth, roles)

Implementuj všetky API endpoints exact podľa PRD

Test: curl/Postman všetky endpoints

Dockerfile + docker-compose.yml (db + backend)

text

### Phase 2: Frontend PWA (30%)
Vytvor frontend/ priečinok

create-vite react-ts + Tailwind + vite-plugin-pwa

Komponenty: Login, Dashboard, Products, OfficeDashboard

ZXing barcode scanner (Safari/Chrome compatible)

JWT localStorage + API calls (fetch + auth headers)

PWA manifest.json + service worker

Responsive design (mobile-first)

Dockerfile + docker-compose integrácia

text

### Phase 3: Integrácia + Features (20%)
FIFO stock logic (transakcie v purchases)

Running balance (account_entries + views)

reminder.js cron script

Manual reminder endpoint

Error handling + loading states

Offline PWA cache (/products)

text

### Phase 4: Testing + Polish (10%)
Unit tests: API endpoints (Jest)

E2E: Cypress (login → purchase → balance)

Seed test data (2 users, 3 products, FIFO batches)

README.md s docker-compose up instructions

.gitignore + LICENSE

text

## OUTPUT REQUIREMENTS
📁 firemny-bufet/
├── backend/ # Express + API + reminder.js
├── frontend/ # React PWA
├── docker-compose.yml
├── README.md
└── db/init.sql

✅ docker-compose up → full stack na localhost:3000
✅ HTTPS ready (mkcert dev certs)
✅ SMTP test mode (console.log namiesto real mail)
✅ Seed data + test accounts

text

## QUALITY CRITERIA
✅ 100% API coverage z PRD
✅ ZXing scanner funguje v Chrome + Safari
✅ FIFO: staré batche sa vypredajú prvé
✅ Balance: -10€ nákup + 20€ deposit = +10€
✅ PWA: pridaj na plochu + offline produkty
✅ Role RBAC: user nemôže /stock/add-batch
✅ Transakcie: atomické (ROLLBACK pri chybe)

text

## RALPH RULES
Použi exact PRD špecifikácie - žiadne zmeny

Kód musí byť production-ready (error handling, validation)

TypeScript everywhere (FE + BE types)

Commit po každej phase s git

Testuj lokálne cez docker-compose

SMTP: console.log namiesto real email (dev)

text

## SUCCESS = 
$ git clone && docker-compose up
✅ DB init + seed
✅ Backend: curl localhost:3001/account/balances
✅ Frontend: localhost:3000 → PWA install
✅ Scanner funguje, balance update, FIFO OK
✅ npm run reminder → console pripomienky

text

**START NOW** - vytvor repozitár a implementuj Phase 1.