import { isCaseTransitionAllowed, CASE_STATUS_TRANSITIONS } from "../transitions";

// CHECKLIST §2: Case status transitions — no skipping, no reversals
describe("case status lifecycle (CHECKLIST §2)", () => {
  it("allows OPEN → UNDER_REVIEW", () => {
    expect(isCaseTransitionAllowed("OPEN", "UNDER_REVIEW")).toBe(true);
  });

  it("allows UNDER_REVIEW → PACKAGED", () => {
    expect(isCaseTransitionAllowed("UNDER_REVIEW", "PACKAGED")).toBe(true);
  });

  it("allows PACKAGED → REFERRED", () => {
    expect(isCaseTransitionAllowed("PACKAGED", "REFERRED")).toBe(true);
  });

  it("allows REFERRED → CLOSED", () => {
    expect(isCaseTransitionAllowed("REFERRED", "CLOSED")).toBe(true);
  });

  it("blocks OPEN → PACKAGED (skip)", () => {
    expect(isCaseTransitionAllowed("OPEN", "PACKAGED")).toBe(false);
  });

  it("blocks OPEN → REFERRED (skip)", () => {
    expect(isCaseTransitionAllowed("OPEN", "REFERRED")).toBe(false);
  });

  it("blocks OPEN → CLOSED (skip)", () => {
    expect(isCaseTransitionAllowed("OPEN", "CLOSED")).toBe(false);
  });

  it("blocks UNDER_REVIEW → REFERRED (skip)", () => {
    expect(isCaseTransitionAllowed("UNDER_REVIEW", "REFERRED")).toBe(false);
  });

  it("blocks CLOSED → OPEN (reversal)", () => {
    expect(isCaseTransitionAllowed("CLOSED", "OPEN")).toBe(false);
  });

  it("blocks REFERRED → OPEN (reversal)", () => {
    expect(isCaseTransitionAllowed("REFERRED", "OPEN")).toBe(false);
  });

  it("blocks PACKAGED → UNDER_REVIEW (reversal)", () => {
    expect(isCaseTransitionAllowed("PACKAGED", "UNDER_REVIEW")).toBe(false);
  });

  it("CLOSED has no allowed transitions", () => {
    expect(CASE_STATUS_TRANSITIONS["CLOSED"]).toHaveLength(0);
  });
});
