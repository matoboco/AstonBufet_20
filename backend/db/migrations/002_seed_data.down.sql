-- Rollback: 002_seed_data
-- Removes seed data

DELETE FROM stock_batches WHERE product_id IN (
    SELECT id FROM products WHERE ean IN ('1234567890123', '9876543210987', '5555555555555', '6666666666666')
);

DELETE FROM products WHERE ean IN ('1234567890123', '9876543210987', '5555555555555', '6666666666666');

DELETE FROM users WHERE email = 'assistant@company.sk';
