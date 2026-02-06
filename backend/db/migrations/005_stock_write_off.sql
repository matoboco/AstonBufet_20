-- Add is_write_off column to stock_adjustments
-- Write-offs are intentional removals (expired/damaged goods) that should not trigger shortage warnings

ALTER TABLE stock_adjustments
ADD COLUMN is_write_off BOOLEAN NOT NULL DEFAULT FALSE;

-- Add index for filtering
CREATE INDEX idx_stock_adjustments_write_off ON stock_adjustments(is_write_off) WHERE is_write_off = FALSE;
