import { assertKAnonymity, K_ANONYMITY_MIN_CHANNELS } from "../transitions";

// CHECKLIST §5,§7: NetworkPattern k-anonymity enforcement
describe("k-anonymity guard (CHECKLIST §5,§7)", () => {
  it("allows exactly 50 channels (minimum threshold)", () => {
    expect(() => assertKAnonymity(50)).not.toThrow();
  });

  it("allows more than 50 channels", () => {
    expect(() => assertKAnonymity(500)).not.toThrow();
  });

  it("throws for 49 channels (below threshold)", () => {
    expect(() => assertKAnonymity(49)).toThrow(/k-anonymity violation/);
  });

  it("throws for 1 channel (far below threshold)", () => {
    expect(() => assertKAnonymity(1)).toThrow(/k-anonymity violation/);
  });

  it("throws for 0 channels", () => {
    expect(() => assertKAnonymity(0)).toThrow(/k-anonymity violation/);
  });

  it("minimum is 50", () => {
    expect(K_ANONYMITY_MIN_CHANNELS).toBe(50);
  });
});
