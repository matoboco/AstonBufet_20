-- Track when users acknowledged shortage warnings
CREATE TABLE shortage_acknowledgements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    acknowledged_at TIMESTAMP NOT NULL DEFAULT NOW(),
    shortage_total INTEGER NOT NULL, -- Total shortage amount at time of acknowledgement
    UNIQUE(user_id) -- Only one record per user, updated on each acknowledgement
);

-- Index for faster lookups
CREATE INDEX idx_shortage_ack_user ON shortage_acknowledgements(user_id);
