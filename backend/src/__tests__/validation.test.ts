import {
  requestCodeSchema,
  verifyCodeSchema,
  purchaseSchema,
  addBatchSchema,
  depositSchema,
} from '../validation';

describe('Validation Schemas', () => {
  describe('requestCodeSchema', () => {
    it('should accept valid email', () => {
      const result = requestCodeSchema.safeParse({ email: 'test@example.com' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = requestCodeSchema.safeParse({ email: 'invalid-email' });
      expect(result.success).toBe(false);
    });
  });

  describe('verifyCodeSchema', () => {
    it('should accept valid email and 6-digit code', () => {
      const result = verifyCodeSchema.safeParse({
        email: 'test@example.com',
        code: '123456',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid code length', () => {
      const result = verifyCodeSchema.safeParse({
        email: 'test@example.com',
        code: '12345',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('purchaseSchema', () => {
    it('should accept valid purchase', () => {
      const result = purchaseSchema.safeParse({
        product_id: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 2,
      });
      expect(result.success).toBe(true);
    });

    it('should reject negative quantity', () => {
      const result = purchaseSchema.safeParse({
        product_id: '123e4567-e89b-12d3-a456-426614174000',
        quantity: -1,
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid UUID', () => {
      const result = purchaseSchema.safeParse({
        product_id: 'invalid-uuid',
        quantity: 1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('addBatchSchema', () => {
    it('should accept valid batch with name', () => {
      const result = addBatchSchema.safeParse({
        ean: '1234567890123',
        name: 'Test Product',
        quantity: 10,
        price_cents: 150,
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid batch without name', () => {
      const result = addBatchSchema.safeParse({
        ean: '1234567890123',
        quantity: 10,
        price_cents: 150,
      });
      expect(result.success).toBe(true);
    });

    it('should reject zero quantity', () => {
      const result = addBatchSchema.safeParse({
        ean: '1234567890123',
        quantity: 0,
        price_cents: 150,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('depositSchema', () => {
    it('should accept valid deposit', () => {
      const result = depositSchema.safeParse({
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        amount_cents: 1000,
        note: 'Test deposit',
      });
      expect(result.success).toBe(true);
    });

    it('should accept deposit without note', () => {
      const result = depositSchema.safeParse({
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        amount_cents: 1000,
      });
      expect(result.success).toBe(true);
    });

    it('should reject negative amount', () => {
      const result = depositSchema.safeParse({
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        amount_cents: -100,
      });
      expect(result.success).toBe(false);
    });
  });
});
