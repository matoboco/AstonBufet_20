-- Seed data for development/testing

-- Office assistant user
INSERT OR IGNORE INTO users (id, email, role) VALUES
    ('00000000-0000-4000-8000-000000000001', 'assistant@company.sk', 'office_assistant');

-- Test products
INSERT OR IGNORE INTO products (id, name, ean, price_cents) VALUES
    ('00000000-0000-4000-8000-000000000101', 'Kava', '1234567890123', 120),
    ('00000000-0000-4000-8000-000000000102', 'Sendvic', '9876543210987', 250),
    ('00000000-0000-4000-8000-000000000103', 'Cokolada', '5555555555555', 80),
    ('00000000-0000-4000-8000-000000000104', 'Mineralka', '6666666666666', 60);

-- Initial stock batches
INSERT INTO stock_batches (product_id, quantity, price_cents) VALUES
    ('00000000-0000-4000-8000-000000000101', 100, 120),
    ('00000000-0000-4000-8000-000000000102', 50, 250),
    ('00000000-0000-4000-8000-000000000103', 30, 80),
    ('00000000-0000-4000-8000-000000000104', 40, 60);
