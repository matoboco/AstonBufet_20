-- Migration: 0001_initial_schema
-- Description: Initial database schema for Aston Bufet (D1/SQLite)

-- Users table
CREATE TABLE users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'office_assistant')),
    token_version INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Products table
CREATE TABLE products (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    name TEXT NOT NULL,
    ean TEXT UNIQUE NOT NULL,
    price_cents INTEGER NOT NULL,
    sale_price_cents INTEGER DEFAULT NULL,
    sale_expires_at TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Stock batches table (FIFO inventory)
CREATE TABLE stock_batches (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    price_cents INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Account entries table (ledger)
CREATE TABLE account_entries (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Login codes table (OTP)
CREATE TABLE login_codes (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0
);

-- Stock adjustments table (inventory counts / manko)
CREATE TABLE stock_adjustments (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    expected_quantity INTEGER NOT NULL,
    actual_quantity INTEGER NOT NULL,
    difference INTEGER NOT NULL,
    reason TEXT,
    created_by TEXT REFERENCES users(id),
    is_write_off INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Shortage acknowledgements table
CREATE TABLE shortage_acknowledgements (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    acknowledged_at TEXT NOT NULL DEFAULT (datetime('now')),
    shortage_total INTEGER NOT NULL,
    UNIQUE(user_id)
);

-- Shortage contributions table
CREATE TABLE shortage_contributions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    description TEXT,
    recorded_by TEXT REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX idx_products_ean ON products(ean);
CREATE INDEX idx_stock_batches_product_id ON stock_batches(product_id);
CREATE INDEX idx_stock_batches_created_at ON stock_batches(created_at);
CREATE INDEX idx_account_entries_user_id ON account_entries(user_id);
CREATE INDEX idx_account_entries_created_at ON account_entries(created_at);
CREATE INDEX idx_login_codes_email ON login_codes(email);
CREATE INDEX idx_login_codes_expires_at ON login_codes(expires_at);
CREATE INDEX idx_stock_adjustments_product_id ON stock_adjustments(product_id);
CREATE INDEX idx_stock_adjustments_created_at ON stock_adjustments(created_at);
CREATE INDEX idx_shortage_ack_user ON shortage_acknowledgements(user_id);
CREATE INDEX idx_shortage_contributions_user_id ON shortage_contributions(user_id);
CREATE INDEX idx_shortage_contributions_created_at ON shortage_contributions(created_at);

-- Views
CREATE VIEW account_balances AS
SELECT
    u.id,
    u.email,
    u.name,
    u.role,
    COALESCE(SUM(e.amount_cents) / 100.0, 0) as balance_eur
FROM users u
LEFT JOIN account_entries e ON u.id = e.user_id
GROUP BY u.id, u.email, u.name, u.role;

CREATE VIEW account_history AS
SELECT
    e.*,
    u.email,
    u.name,
    SUM(e.amount_cents) OVER (PARTITION BY e.user_id ORDER BY e.created_at) / 100.0 as running_balance_eur
FROM account_entries e
JOIN users u ON e.user_id = u.id;

CREATE VIEW shortage_summary AS
SELECT
    COALESCE(SUM(ABS(sa.difference) * p.price_cents), 0) as total_shortage_cents,
    COALESCE((SELECT SUM(amount_cents) FROM shortage_contributions), 0) as total_contributions_cents
FROM stock_adjustments sa
JOIN products p ON sa.product_id = p.id
WHERE sa.difference < 0 AND (sa.is_write_off = 0 OR sa.is_write_off IS NULL);
