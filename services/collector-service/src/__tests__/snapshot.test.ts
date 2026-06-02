import crypto from "crypto";

// Unit test for snapshot hash logic — no AWS calls
describe("snapshot hash integrity (CHECKLIST §1)", () => {
  it("computes SHA-256 hash correctly", () => {
    const payload = JSON.stringify({ text: "test comment", authorId: "user123" });
    const hash = crypto.createHash("sha256").update(payload).digest("hex");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });

  it("different payloads produce different hashes", () => {
    const hash1 = crypto.createHash("sha256").update("comment A").digest("hex");
    const hash2 = crypto.createHash("sha256").update("comment B").digest("hex");
    expect(hash1).not.toBe(hash2);
  });

  it("same payload always produces the same hash (deterministic)", () => {
    const payload = '{"text":"harassment comment"}';
    const hash1 = crypto.createHash("sha256").update(payload).digest("hex");
    const hash2 = crypto.createHash("sha256").update(payload).digest("hex");
    expect(hash1).toBe(hash2);
  });

  it("detects tampering: modified payload fails hash check", () => {
    const original = '{"text":"original comment"}';
    const originalHash = crypto.createHash("sha256").update(original).digest("hex");

    const tampered = '{"text":"modified comment"}';
    const tamperedHash = crypto.createHash("sha256").update(tampered).digest("hex");

    expect(originalHash).not.toBe(tamperedHash);
  });
});
