export interface User {
  id: string;
  email: string;
  name: string | null;
  role: 'user' | 'office_assistant';
}

export interface Product {
  id: string;
  name: string;
  ean: string;
  price_cents: number;
  sale_price_cents: number | null;
  sale_expires_at: string | null;
  stock_quantity: number;
  created_at: string;
}

export interface AccountBalance {
  id: string;
  email: string;
  name: string | null;
  role: string;
  balance_eur: number;
}

export interface AccountEntry {
  id: string;
  user_id: string;
  amount_cents: number;
  description: string;
  created_at: string;
  email: string;
  name: string | null;
  running_balance_eur: number;
}

export interface StockBatch {
  id: string;
  product_id: string;
  quantity: number;
  price_cents: number;
  created_at: string;
  product_name: string;
  product_ean: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface PurchaseResponse {
  success: boolean;
  purchase: {
    product_id: string;
    product_name: string;
    quantity: number;
    total_cents: number;
    total_eur: number;
  };
  new_balance_eur: number;
}

export interface StockAdjustment {
  id: string;
  product_id: string;
  expected_quantity: number;
  actual_quantity: number;
  difference: number;
  reason: string | null;
  created_by: string | null;
  created_at: string;
  product_name: string;
  product_ean: string;
}

export interface ShortageWarning {
  has_warning: boolean;
  total_shortage?: number;
  total_value_eur?: number;
  shortage_since?: string | null;
  adjustments?: {
    product_name: string;
    difference: number;
    value_eur: number;
    created_at: string;
  }[];
}

export interface ShortageSummary {
  total_shortage_cents: number;
  total_contributions_cents: number;
}
