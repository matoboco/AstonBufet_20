import { Request } from 'express';

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: 'user' | 'office_assistant';
  token_version: number;
  created_at: Date;
}

export interface Product {
  id: string;
  name: string;
  ean: string;
  price_cents: number;
  created_at: Date;
}

export interface StockBatch {
  id: string;
  product_id: string;
  quantity: number;
  price_cents: number;
  created_at: Date;
}

export interface AccountEntry {
  id: string;
  user_id: string;
  amount_cents: number;
  description: string | null;
  created_at: Date;
}

export interface LoginCode {
  id: string;
  email: string;
  code: string;
  expires_at: Date;
  used: boolean;
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

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
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
  created_at: Date;
}

export interface StockAdjustmentWithProduct extends StockAdjustment {
  product_name: string;
  product_ean: string;
}

export interface ShortageAcknowledgement {
  id: string;
  user_id: string;
  acknowledged_at: Date;
  shortage_total: number;
}

export interface UnacknowledgedShortage {
  total_shortage: number;
  shortage_since: Date | null;
  adjustments: {
    product_name: string;
    difference: number;
    created_at: Date;
  }[];
}

export interface ShortageContribution {
  id: string;
  user_id: string;
  amount_cents: number;
  description: string | null;
  recorded_by: string | null;
  created_at: Date;
}

export interface ShortageSummary {
  total_shortage_cents: number;
  total_contributions_cents: number;
}
