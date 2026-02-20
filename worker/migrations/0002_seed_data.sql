-- Migration: 0002_seed_data
-- Description: Initial seed data for development/testing

-- Office assistant user
INSERT OR IGNORE INTO users (id, email, role) VALUES (
    lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))),
    'assistant@company.sk',
    'office_assistant'
);

-- Test products
INSERT OR IGNORE INTO products (id, name, ean, price_cents) VALUES
    ('prod-kava-0001', 'Káva', '1234567890123', 120),
    ('prod-sendvic-01', 'Sendvič', '9876543210987', 250),
    ('prod-coko-0001', 'Čokoláda', '5555555555555', 80),
    ('prod-mineral-01', 'Minerálka', '6666666666666', 60);

-- Initial stock batches
INSERT INTO stock_batches (product_id, quantity, price_cents)
SELECT id, 100, price_cents FROM products WHERE ean = '1234567890123';

INSERT INTO stock_batches (product_id, quantity, price_cents)
SELECT id, 50, price_cents FROM products WHERE ean = '9876543210987';

INSERT INTO stock_batches (product_id, quantity, price_cents)
SELECT id, 30, price_cents FROM products WHERE ean = '5555555555555';

INSERT INTO stock_batches (product_id, quantity, price_cents)
SELECT id, 40, price_cents FROM products WHERE ean = '6666666666666';
