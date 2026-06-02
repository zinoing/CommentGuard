// CHECKLIST §3: Action workflow — no auto-delete, approved_by required

const SYSTEM_IDS = ["system", "bot", "auto", "scheduler"];

function isSystemAccount(id: string): boolean {
  return SYSTEM_IDS.includes(id.toLowerCase());
}

function validateApproval(approvedById: string | null | undefined): {
  valid: boolean;
  reason?: string;
} {
  if (!approvedById) {
    return { valid: false, reason: "approvedById is required" };
  }
  if (isSystemAccount(approvedById)) {
    return { valid: false, reason: "Platform actions cannot be approved by system accounts" };
  }
  return { valid: true };
}

describe("action approval rules (CHECKLIST §3)", () => {
  it("rejects execution when approvedById is null", () => {
    const result = validateApproval(null);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/required/i);
  });

  it("rejects execution when approvedById is undefined", () => {
    const result = validateApproval(undefined);
    expect(result.valid).toBe(false);
  });

  it("rejects execution when approvedById is empty string", () => {
    const result = validateApproval("");
    expect(result.valid).toBe(false);
  });

  it("rejects system account 'system'", () => {
    const result = validateApproval("system");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/system account/i);
  });

  it("rejects system account 'bot'", () => {
    const result = validateApproval("bot");
    expect(result.valid).toBe(false);
  });

  it("rejects system account 'scheduler'", () => {
    const result = validateApproval("scheduler");
    expect(result.valid).toBe(false);
  });

  it("accepts a real user ID (cuid format)", () => {
    const result = validateApproval("clxyz1234abc000def");
    expect(result.valid).toBe(true);
  });

  it("accepts a UUID-format user ID", () => {
    const result = validateApproval("550e8400-e29b-41d4-a716-446655440000");
    expect(result.valid).toBe(true);
  });
});
