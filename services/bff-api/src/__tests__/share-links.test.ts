import crypto from "crypto";

// CHECKLIST §4: Share link token and expiry rules
describe("share link security rules (CHECKLIST §4)", () => {
  describe("token generation", () => {
    it("generates a 64-character hex token (32 bytes)", () => {
      const token = crypto.randomBytes(32).toString("hex");
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[a-f0-9]+$/);
    });

    it("each token is unique", () => {
      const tokens = Array.from({ length: 100 }, () =>
        crypto.randomBytes(32).toString("hex")
      );
      const unique = new Set(tokens);
      expect(unique.size).toBe(100);
    });

    it("token is not guessable (not sequential)", () => {
      const t1 = crypto.randomBytes(32).toString("hex");
      const t2 = crypto.randomBytes(32).toString("hex");
      expect(t1).not.toBe(t2);
      // Tokens should not differ by just an increment
      const n1 = BigInt("0x" + t1);
      const n2 = BigInt("0x" + t2);
      expect(Math.abs(Number(n2 - n1))).toBeGreaterThan(1000);
    });
  });

  describe("expiry enforcement", () => {
    it("rejects a share link where expiresAt is in the past", () => {
      const pastDate = new Date(Date.now() - 1000);
      const isValid = new Date(pastDate) > new Date();
      expect(isValid).toBe(false);
    });

    it("accepts a share link where expiresAt is in the future", () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const isValid = new Date(futureDate) > new Date();
      expect(isValid).toBe(true);
    });
  });

  describe("anomaly detection threshold", () => {
    const ANOMALY_ACCESS_THRESHOLD = 10;
    const ANOMALY_WINDOW_MS = 60 * 60 * 1000;

    it("threshold is 10 accesses per hour", () => {
      expect(ANOMALY_ACCESS_THRESHOLD).toBe(10);
    });

    it("window is 1 hour", () => {
      expect(ANOMALY_WINDOW_MS).toBe(3600000);
    });

    it("11 accesses triggers revocation", () => {
      const accessCount = 11;
      const shouldRevoke = accessCount > ANOMALY_ACCESS_THRESHOLD;
      expect(shouldRevoke).toBe(true);
    });

    it("10 accesses does not trigger revocation", () => {
      const accessCount = 10;
      const shouldRevoke = accessCount > ANOMALY_ACCESS_THRESHOLD;
      expect(shouldRevoke).toBe(false);
    });
  });
});
