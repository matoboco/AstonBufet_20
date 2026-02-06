-- Revert is_write_off column
DROP INDEX IF EXISTS idx_stock_adjustments_write_off;
ALTER TABLE stock_adjustments DROP COLUMN IF EXISTS is_write_off;
