-- ============================================
-- Aston Bufet 2.0 - Database Cleanup Script
-- ============================================
-- POZOR: Tento skript vymazava data z databazy!
-- Pred spustenim si urobte zalohu.
-- ============================================

-- ============================================
-- SOFT CLEANUP - Vymazanie transakcnych dat
-- (zachova produkty a uzivatelov)
-- ============================================

BEGIN;

-- 1. Prispevky na manko
TRUNCATE TABLE shortage_contributions CASCADE;

-- 2. Potvrdenia o manku
TRUNCATE TABLE shortage_acknowledgements CASCADE;

-- 3. Inventurne rozdiely (manko)
TRUNCATE TABLE stock_adjustments CASCADE;

-- 4. Uctovne zaznamy (nakupy, vklady)
TRUNCATE TABLE account_entries CASCADE;

-- 5. Skladove davky
TRUNCATE TABLE stock_batches CASCADE;

-- 6. Prihlasovacie kody
TRUNCATE TABLE login_codes CASCADE;

COMMIT;

-- Statistika po cleanup
SELECT 'shortage_contributions' as tabulka, COUNT(*) as pocet FROM shortage_contributions
UNION ALL SELECT 'shortage_acknowledgements', COUNT(*) FROM shortage_acknowledgements
UNION ALL SELECT 'stock_adjustments', COUNT(*) FROM stock_adjustments
UNION ALL SELECT 'account_entries', COUNT(*) FROM account_entries
UNION ALL SELECT 'stock_batches', COUNT(*) FROM stock_batches
UNION ALL SELECT 'login_codes', COUNT(*) FROM login_codes
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'users', COUNT(*) FROM users;


-- ============================================
-- FULL CLEANUP - Vymazanie VSETKYCH dat
-- (vymaze aj produkty a uzivatelov)
-- Odkomentuj ak chces pouzit
-- ============================================

/*
BEGIN;

-- Najprv transakcne data
TRUNCATE TABLE shortage_contributions CASCADE;
TRUNCATE TABLE shortage_acknowledgements CASCADE;
TRUNCATE TABLE stock_adjustments CASCADE;
TRUNCATE TABLE account_entries CASCADE;
TRUNCATE TABLE stock_batches CASCADE;
TRUNCATE TABLE login_codes CASCADE;

-- Potom master data
TRUNCATE TABLE products CASCADE;
TRUNCATE TABLE users CASCADE;

COMMIT;

-- Statistika po full cleanup
SELECT 'Vsetky tabulky su prazdne' as stav;
*/


-- ============================================
-- SELECTIVE CLEANUP - Vymazanie starych dat
-- (ponecha poslednych X dni)
-- Odkomentuj a uprav podla potreby
-- ============================================

/*
BEGIN;

-- Vymazat stare login kody (starsie ako 1 den)
DELETE FROM login_codes
WHERE expires_at < NOW() - INTERVAL '1 day';

-- Vymazat stare uctovne zaznamy (starsie ako 1 rok)
DELETE FROM account_entries
WHERE created_at < NOW() - INTERVAL '1 year';

-- Vymazat stare stock adjustments (starsie ako 1 rok)
DELETE FROM stock_adjustments
WHERE created_at < NOW() - INTERVAL '1 year';

COMMIT;
*/
