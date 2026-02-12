-- Add sale price columns to products
ALTER TABLE products ADD COLUMN sale_price_cents INTEGER DEFAULT NULL;
ALTER TABLE products ADD COLUMN sale_expires_at TIMESTAMP DEFAULT NULL;
