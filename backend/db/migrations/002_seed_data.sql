-- Migration: 002_seed_data
-- Description: Initial seed data for development/testing
-- Created: 2026-02-05

-- Office assistant user
INSERT INTO users (email, role) VALUES ('assistant@company.sk', 'office_assistant')
ON CONFLICT (email) DO NOTHING;

-- Test products
INSERT INTO products (name, ean, price_cents) VALUES
    ('Káva', '1234567890123', 120),
    ('Sendvič', '9876543210987', 250),
    ('Čokoláda', '5555555555555', 80),
    ('Minerálka', '6666666666666', 60)
ON CONFLICT (ean) DO NOTHING;

-- Initial stock batches
INSERT INTO stock_batches (product_id, quantity, price_cents)
SELECT id, 100, price_cents FROM products WHERE ean = '1234567890123';

INSERT INTO stock_batches (product_id, quantity, price_cents)
SELECT id, 50, price_cents FROM products WHERE ean = '9876543210987';

INSERT INTO stock_batches (product_id, quantity, price_cents)
SELECT id, 30, price_cents FROM products WHERE ean = '5555555555555';

INSERT INTO stock_batches (product_id, quantity, price_cents)
SELECT id, 40, price_cents FROM products WHERE ean = '6666666666666';
