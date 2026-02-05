-- ============================================================
-- DEPRECATED: This file is kept for reference only.
--
-- The application now uses automatic migrations.
-- See: db/migrations/
--
-- Migrations are applied automatically when the backend starts.
-- For manual migration control, use:
--   npm run migrate:status
--   npm run migrate
--   npm run migrate:rollback
-- ============================================================

-- For manual database setup without migrations, you can still use this file:
-- psql -U bufet -d bufet -f init.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'office_assistant')),
    token_version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    ean TEXT UNIQUE NOT NULL,
    price_cents INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Stock batches table (FIFO inventory)
CREATE TABLE IF NOT EXISTS stock_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    price_cents INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Account entries table (ledger)
CREATE TABLE IF NOT EXISTS account_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Login codes table (OTP)
CREATE TABLE IF NOT EXISTS login_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_ean ON products(ean);
CREATE INDEX IF NOT EXISTS idx_stock_batches_product_id ON stock_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_batches_created_at ON stock_batches(created_at);
CREATE INDEX IF NOT EXISTS idx_account_entries_user_id ON account_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_account_entries_created_at ON account_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_login_codes_email ON login_codes(email);
CREATE INDEX IF NOT EXISTS idx_login_codes_expires_at ON login_codes(expires_at);

-- Views
CREATE OR REPLACE VIEW account_balances AS
SELECT
    u.id,
    u.email,
    u.role,
    COALESCE(SUM(e.amount_cents)/100.0, 0) as balance_eur
FROM users u
LEFT JOIN account_entries e ON u.id = e.user_id
GROUP BY u.id, u.email, u.role;

CREATE OR REPLACE VIEW account_history AS
SELECT
    e.*,
    u.email,
    SUM(e.amount_cents) OVER (PARTITION BY e.user_id ORDER BY e.created_at)/100.0 as running_balance_eur
FROM account_entries e
JOIN users u ON e.user_id = u.id;

-- Seed data
INSERT INTO users (email, role) VALUES ('assistant@company.sk', 'office_assistant')
ON CONFLICT (email) DO NOTHING;

INSERT INTO products (name, ean, price_cents) VALUES
    ('Káva', '1234567890123', 120),
    ('Sendvič', '9876543210987', 250)
ON CONFLICT (ean) DO NOTHING;
