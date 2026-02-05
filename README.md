# Firemný Bufet

Interná PWA aplikácia pre firemný bufet s nákupom na účet, FIFO skladom, vyúčtovaním a automatickými pripomienkami.

## Funkcie

- **Nákup tovaru** - výber zo zoznamu alebo skenovanie EAN kódu
- **FIFO sklad** - automatické odpisovanie zo starších dávok
- **Účet na dlh** - záporný zostatok = dlh, kladný = kredit
- **Vyúčtovanie** - office assistant môže evidovať vklady
- **Pripomienky** - automatické (cron) alebo manuálne emaily dlžníkom

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite
- Tailwind CSS
- vite-plugin-pwa
- @zxing/library (barcode scanner)
- react-webcam

### Backend
- Node.js 20 + Express
- PostgreSQL 16
- JWT autentifikácia (1 rok platnosť)
- Zod validácia
- Nodemailer (SMTP/console mode)
- node-cron

## Spustenie

### Požiadavky
- Docker + Docker Compose

### Quick Start

```bash
# Klonovanie
git clone <repo-url>
cd firemny-bufet

# Spustenie
docker-compose up --build
```

Aplikácia bude dostupná na:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **PostgreSQL**: localhost:5432

### Test účty

- **Office Assistant**: `assistant@company.sk`
- **Bežný používateľ**: akýkoľvek email (vytvorí sa automaticky)

### Test produkty

| Produkt | EAN | Cena |
|---------|-----|------|
| Káva | 1234567890123 | 1.20€ |
| Sendvič | 9876543210987 | 2.50€ |

## API Endpoints

### Auth
- `POST /auth/request-code` - Odoslať OTP kód
- `POST /auth/verify-code` - Overiť kód a získať JWT

### Produkty
- `GET /products` - Zoznam produktov so stavom skladu
- `GET /products/by-ean/:ean` - Produkt podľa EAN

### Nákup
- `POST /purchases` - Nákup s FIFO alokáciou

### Účet
- `GET /account/balances` - Zostatky (vlastný/všetky)
- `GET /account/my-balance` - Vlastný zostatok
- `GET /account/history/:user_id` - História transakcií
- `GET /account/my-history` - Vlastná história
- `POST /account/deposit` - Vklad (office_assistant)

### Sklad (office_assistant)
- `GET /stock` - Zoznam skladových dávok
- `POST /stock/add-batch` - Pridať novú dávku

### Admin (office_assistant)
- `POST /admin/reminder` - Odoslať pripomienky dlžníkom
- `GET /admin/debtors` - Zoznam dlžníkov
- `GET /admin/users` - Zoznam všetkých používateľov

## Vývoj

### Backend
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Reminder service
```bash
cd backend
npm run reminder -- --once  # Jednorazovo
npm run reminder           # Cron (1. deň mesiaca 9:00)
```

## Databáza a Migrácie

Aplikácia používa automatický migračný systém. Pri štarte backendu sa automaticky:
1. Počká na dostupnosť PostgreSQL
2. Vytvorí tabuľku `_migrations` pre sledovanie aplikovaných migrácií
3. Aplikuje všetky pending migrácie v správnom poradí

### Migračné príkazy

```bash
cd backend

# Zobraziť stav migrácií
npm run migrate:status

# Spustiť pending migrácie
npm run migrate

# Rollback poslednej migrácie
npm run migrate:rollback

# Rollback posledných N migrácií
npm run migrate:rollback 3

# Vytvoriť novú migráciu
npm run migrate:create add_categories_table
```

### Štruktúra migrácií

Migračné súbory sa nachádzajú v `backend/db/migrations/`:

```
backend/db/migrations/
├── 001_initial_schema.sql       # Hlavná schéma
├── 001_initial_schema.down.sql  # Rollback pre schému
├── 002_seed_data.sql            # Testovacie dáta
└── ...
```

### Vytváranie nových migrácií

1. Spustite `npm run migrate:create nazov_migracie`
2. Upravte vygenerovaný `.sql` súbor
3. Voliteľne upravte `.down.sql` pre rollback
4. Migrácia sa aplikuje automaticky pri ďalšom štarte

### Pravidlá pre migrácie

- Migrácie sú nemenné - nikdy neupravujte už aplikovanú migráciu
- Pre zmeny vytvorte novú migráciu
- Vždy testujte rollback pred deploymentom
- Používajte transakcie v rámci migrácie

## Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://bufet:secret@localhost:5432/bufet
JWT_SECRET=your-32-character-secret-key-here
SMTP_MODE=console
SMTP_HOST=smtp.company.sk
SMTP_PORT=587
SMTP_USER=noreply@company.sk
SMTP_PASS=password
SMTP_FROM=noreply@company.sk
PORT=3001
CORS_ORIGIN=http://localhost:3000
RUN_MIGRATIONS=true
OFFICE_ASSISTANT_EMAILS=assistant@company.sk,admin@company.sk
```

### Office Assistant Role

Rola `office_assistant` sa prideľuje automaticky používateľom, ktorých email je v zozname `OFFICE_ASSISTANT_EMAILS`:

```bash
# Jeden email
OFFICE_ASSISTANT_EMAILS=assistant@company.sk

# Viacero emailov (čiarkou oddelené)
OFFICE_ASSISTANT_EMAILS=assistant@company.sk,admin@company.sk,manager@company.sk
```

- Pri prvom prihlásení sa používateľ vytvorí s príslušnou rolou
- Pri ďalších prihláseniach sa rola aktualizuje ak je email pridaný do zoznamu
- Rola sa **neodoberá** automaticky ak je email odstránený zo zoznamu (bezpečnosť)

### Frontend
```
VITE_API_URL=http://localhost:3001
```

## PWA

Aplikácia je inštalovateľná ako PWA:
1. Otvorte http://localhost:3000 v Chrome/Safari
2. Kliknite na "Pridať na plochu" / "Install"

### Offline podpora
- Produkty sú cachovane pre offline prehliadanie
- UI funguje offline (nákup vyžaduje pripojenie)

## Licencia

MIT
