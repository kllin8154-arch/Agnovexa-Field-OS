import { describe, expect, it } from "vitest";
import { validateWorkspaceBundle } from "./productionRepository";

const validBundle = {
  format: "agnovexa-opsdesk-workspace",
  schemaVersion: 1,
  appVersion: "0.4.0",
  exportedAt: "2026-08-19T00:00:00.000Z",
  containsApiKeys: false,
  remoteExecution: false,
  integrity: "ok",
  rowCounts: {},
  tables: {},
};

describe("workspace backup safety", () => {
  it("accepts a safe OpsDesk workspace bundle", () => {
    expect(validateWorkspaceBundle(validBundle).containsApiKeys).toBe(false);
  });

  it("rejects bundles that may contain API keys", () => {
    expect(() => validateWorkspaceBundle({ ...validBundle, containsApiKeys: true })).toThrow(/containsApiKeys/);
  });

  it("rejects bundles that claim remote execution", () => {
    expect(() => validateWorkspaceBundle({ ...validBundle, remoteExecution: true })).toThrow(/remoteExecution/);
  });
});
