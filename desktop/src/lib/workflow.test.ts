import { describe, expect, it } from "vitest";
import { canTransition, phaseOrder } from "./workflow";

describe("manual deployment workflow", () => {
  it("keeps manual execution between approval and verification", () => {
    expect(canTransition("APPROVE", "MANUAL_EXECUTE")).toBe(true);
    expect(canTransition("APPROVE", "VERIFY")).toBe(false);
    expect(canTransition("PLAN", "MANUAL_EXECUTE")).toBe(false);
  });

  it("does not allow knowledge publication directly from planning", () => {
    expect(canTransition("PLAN", "KNOWLEDGE")).toBe(false);
    expect(phaseOrder.indexOf("VERIFY")).toBeLessThan(phaseOrder.indexOf("KNOWLEDGE"));
  });
});
