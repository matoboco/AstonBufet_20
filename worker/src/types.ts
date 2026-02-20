export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  CORS_ORIGIN: string;
  SMTP_MODE: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_FROM?: string;
  RESEND_API_KEY?: string;
  OFFICE_ASSISTANT_EMAILS: string;
  ALLOWED_EMAIL_DOMAINS: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: 'user' | 'office_assistant';
  token_version: number;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  ean: string;
  price_cents: number;
  sale_price_cents: number | null;
  sale_expires_at: string | null;
  created_at: string;
}

export interface StockBatch {
  id: string;
  product_id: string;
  quantity: number;
  price_cents: number;
  created_at: string;
}

export interface AccountEntry {
  id: string;
  user_id: string;
  amount_cents: number;
  description: string | null;
  created_at: string;
}

export interface LoginCode {
  id: string;
  email: string;
  code: string;
  expires_at: string;
  used: number; // SQLite boolean: 0 or 1
}

export interface AccountBalance {
  id: string;
  email: string;
  name: string | null;
  role: string;
  balance_eur: number;
}

export interface AccountHistoryEntry extends AccountEntry {
  email: string;
  name: string | null;
  running_balance_eur: number;
}

export interface JWTPayload {
  userId: string;
  email: string;
  name: string | null;
  role: 'user' | 'office_assistant';
  tokenVersion: number;
}

export interface ProductWithStock extends Product {
  stock_quantity: number;
}

export interface StockAdjustment {
  id: string;
  product_id: string;
  expected_quantity: number;
  actual_quantity: number;
  difference: number;
  reason: string | null;
  created_by: string | null;
  is_write_off: number; // SQLite boolean: 0 or 1
  created_at: string;
}

export interface StockAdjustmentWithProduct extends StockAdjustment {
  product_name: string;
  product_ean: string;
}

export interface ShortageAcknowledgement {
  id: string;
  user_id: string;
  acknowledged_at: string;
  shortage_total: number;
}

export interface ShortageSummary {
  total_shortage_cents: number;
  total_contributions_cents: number;
}
