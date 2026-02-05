-- Migration: 001_initial_schema
-- Description: Initial database schema for Firemný Bufet
-- Created: 2026-02-05

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'office_assistant')),
    token_version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Products table
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    ean TEXT UNIQUE NOT NULL,
    price_cents INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Stock batches table (FIFO inventory)
CREATE TABLE stock_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    price_cents INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Account entries table (ledger)
CREATE TABLE account_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL, -- negative = purchase, positive = payment
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Login codes table (OTP)
CREATE TABLE login_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE
);

-- Indexes for performance
CREATE INDEX idx_products_ean ON products(ean);
CREATE INDEX idx_stock_batches_product_id ON stock_batches(product_id);
CREATE INDEX idx_stock_batches_created_at ON stock_batches(created_at);
CREATE INDEX idx_account_entries_user_id ON account_entries(user_id);
CREATE INDEX idx_account_entries_created_at ON account_entries(created_at);
CREATE INDEX idx_login_codes_email ON login_codes(email);
CREATE INDEX idx_login_codes_expires_at ON login_codes(expires_at);

-- Views
CREATE VIEW account_balances AS
SELECT
    u.id,
    u.email,
    u.role,
    COALESCE(SUM(e.amount_cents)/100.0, 0) as balance_eur
FROM users u
LEFT JOIN account_entries e ON u.id = e.user_id
GROUP BY u.id, u.email, u.role;

CREATE VIEW account_history AS
SELECT
    e.*,
    u.email,
    SUM(e.amount_cents) OVER (PARTITION BY e.user_id ORDER BY e.created_at)/100.0 as running_balance_eur
FROM account_entries e
JOIN users u ON e.user_id = u.id;
