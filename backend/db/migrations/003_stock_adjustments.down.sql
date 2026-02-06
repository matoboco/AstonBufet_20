-- Rollback: 003_stock_adjustments

DROP INDEX IF EXISTS idx_stock_adjustments_created_at;
DROP INDEX IF EXISTS idx_stock_adjustments_product_id;
DROP TABLE IF EXISTS stock_adjustments;
