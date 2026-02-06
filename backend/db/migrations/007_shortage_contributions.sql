-- Migration: 007_shortage_contributions
-- Description: Track voluntary contributions to cover shortage (manko)
-- Created: 2026-02-06

-- Table for tracking shortage contributions
CREATE TABLE shortage_contributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    description TEXT,
    recorded_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_shortage_contributions_user_id ON shortage_contributions(user_id);
CREATE INDEX idx_shortage_contributions_created_at ON shortage_contributions(created_at);

-- View for shortage summary
CREATE VIEW shortage_summary AS
SELECT
    COALESCE(SUM(ABS(sa.difference) * p.price_cents), 0)::integer as total_shortage_cents,
    COALESCE((SELECT SUM(amount_cents) FROM shortage_contributions), 0)::integer as total_contributions_cents
FROM stock_adjustments sa
JOIN products p ON sa.product_id = p.id
WHERE sa.difference < 0 AND (sa.is_write_off = FALSE OR sa.is_write_off IS NULL);
