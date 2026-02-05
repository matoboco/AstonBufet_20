import { generateOTP } from '../middleware';

describe('Middleware', () => {
  describe('generateOTP', () => {
    it('should generate 6-digit code', () => {
      const otp = generateOTP();
      expect(otp).toHaveLength(6);
      expect(/^\d{6}$/.test(otp)).toBe(true);
    });

    it('should generate different codes', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(generateOTP());
      }
      // At least 90% should be unique (allowing for some random collisions)
      expect(codes.size).toBeGreaterThan(90);
    });

    it('should generate codes in valid range', () => {
      for (let i = 0; i < 100; i++) {
        const otp = generateOTP();
        const num = parseInt(otp, 10);
        expect(num).toBeGreaterThanOrEqual(100000);
        expect(num).toBeLessThanOrEqual(999999);
      }
    });
  });
});
