-- Migration: 006_user_name
-- Description: Add optional name field to users for personalized emails
-- Created: 2026-02-06

-- Add name column to users
ALTER TABLE users ADD COLUMN name TEXT;

-- Update views to include name
DROP VIEW IF EXISTS account_history;
DROP VIEW IF EXISTS account_balances;

CREATE VIEW account_balances AS
SELECT
    u.id,
    u.email,
    u.name,
    u.role,
    COALESCE(SUM(e.amount_cents)/100.0, 0) as balance_eur
FROM users u
LEFT JOIN account_entries e ON u.id = e.user_id
GROUP BY u.id, u.email, u.name, u.role;

CREATE VIEW account_history AS
SELECT
    e.*,
    u.email,
    u.name,
    SUM(e.amount_cents) OVER (PARTITION BY e.user_id ORDER BY e.created_at)/100.0 as running_balance_eur
FROM account_entries e
JOIN users u ON e.user_id = u.id;
