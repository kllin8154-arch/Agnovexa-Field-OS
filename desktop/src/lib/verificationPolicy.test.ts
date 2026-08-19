import { describe, expect, it } from "vitest";
import {
  evaluateVerificationGate,
  verificationCompletion,
  type VerificationCategory,
  type VerificationLayer,
} from "./verificationPolicy";

function layer(
  category: VerificationCategory,
  status: VerificationLayer["status"] = "passed",
): VerificationLayer {
  return {
    category,
    status,
    evidence: "人工核对结果符合成功标准，证据已脱敏保存。",
    exemptionReason:
      status === "human_exempt" ? "由项目负责人确认本项不适用于本次交付。" : "",
    successCriteria: "目标结果与任务定义中的验收标准一致。",
    verifier: "现场工程师",
  };
}

describe("verification closure gate", () => {
  it("only closes after all four layers pass", () => {
    const layers = {
      files: layer("files"),
      service: layer("service"),
      network: layer("network"),
      business: layer("business"),
    };
    expect(evaluateVerificationGate(layers)).toEqual({
      canClose: true,
      overallStatus: "verified",
      issues: [],
    });
    expect(verificationCompletion(layers)).toBe(100);
  });

  it("allows documented human exemptions without pretending they passed", () => {
    const layers = {
      files: layer("files"),
      service: layer("service"),
      network: layer("network", "human_exempt"),
      business: layer("business"),
    };
    expect(evaluateVerificationGate(layers).overallStatus).toBe("human_exempt");
    expect(evaluateVerificationGate(layers).canClose).toBe(true);
  });

  it("blocks closure when a layer failed or lacks evidence", () => {
    const failed = layer("business", "failed");
    failed.evidence = "";
    const layers = {
      files: layer("files"),
      service: layer("service"),
      network: layer("network"),
      business: failed,
    };
    const result = evaluateVerificationGate(layers);
    expect(result.canClose).toBe(false);
    expect(result.overallStatus).toBe("failed");
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
