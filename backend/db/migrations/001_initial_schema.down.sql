-- Rollback: 001_initial_schema
-- WARNING: This will delete all data!

DROP VIEW IF EXISTS account_history;
DROP VIEW IF EXISTS account_balances;

DROP TABLE IF EXISTS login_codes;
DROP TABLE IF EXISTS account_entries;
DROP TABLE IF EXISTS stock_batches;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS users;
