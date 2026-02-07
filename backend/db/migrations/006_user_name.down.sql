-- Rollback: 006_user_name
-- Description: Remove name field from users

DROP VIEW IF EXISTS account_history;
DROP VIEW IF EXISTS account_balances;

ALTER TABLE users DROP COLUMN name;

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
