import { Request } from 'express';

export interface User {
  id: string;
  email: string;
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
  role: string;
  balance_eur: number;
}

export interface AccountHistoryEntry extends AccountEntry {
  email: string;
  running_balance_eur: number;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: 'user' | 'office_assistant';
  tokenVersion: number;
}

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

export interface ProductWithStock extends Product {
  stock_quantity: number;
}
