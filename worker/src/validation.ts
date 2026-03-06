import { z } from 'zod';

export const requestCodeSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const verifyCodeSchema = z.object({
  email: z.string().email('Invalid email format'),
  code: z.string().length(6, 'Code must be 6 digits'),
  name: z.string().optional(),
});

export const purchaseSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
  quantity: z.number().int().positive('Quantity must be positive'),
});

export const addBatchSchema = z.object({
  ean: z.string().min(1, 'EAN is required'),
  name: z.string().optional(),
  quantity: z.number().int().positive('Quantity must be positive'),
  price_cents: z.number().int().positive('Price must be positive'),
});

export const depositSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
  amount_cents: z.number().int().positive('Amount must be positive'),
  note: z.string().optional(),
  contribution_cents: z.number().int().min(0).optional(),
});

export type RequestCodeInput = z.infer<typeof requestCodeSchema>;
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;
export type PurchaseInput = z.infer<typeof purchaseSchema>;
export type AddBatchInput = z.infer<typeof addBatchSchema>;
export type DepositInput = z.infer<typeof depositSchema>;
