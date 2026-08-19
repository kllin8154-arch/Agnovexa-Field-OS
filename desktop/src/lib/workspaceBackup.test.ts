import { describe, expect, it } from "vitest";
import {
  WORKSPACE_BACKUP_FORMAT,
  WORKSPACE_BACKUP_SCHEMA_VERSION,
  WORKSPACE_BACKUP_TABLES,
  createEmptyWorkspaceTables,
  finalizeWorkspaceBackup,
  parseWorkspaceBackup,
  verifyWorkspaceBackup,
} from "./workspaceBackup";

describe("workspace backup", () => {
  it("creates, parses and verifies a safe backup", async () => {
    const tables = createEmptyWorkspaceTables();
    tables.projects.push({
      id: "project-1",
      name: "测试项目",
      code: "TEST",
      description: "",
      status: "active",
      created_at: "2026-08-19T00:00:00Z",
      updated_at: "2026-08-19T00:00:00Z",
    });
    const tableCounts = Object.fromEntries(
      WORKSPACE_BACKUP_TABLES.map((name) => [name, tables[name].length]),
    ) as Record<(typeof WORKSPACE_BACKUP_TABLES)[number], number>;

    const backup = await finalizeWorkspaceBackup({
      manifest: {
        format: WORKSPACE_BACKUP_FORMAT,
        schemaVersion: WORKSPACE_BACKUP_SCHEMA_VERSION,
        appVersion: "0.4.0",
        exportedAt: "2026-08-19T00:00:00Z",
        exportedBy: "测试人员",
        containsApiKeys: false,
        remoteExecution: false,
        excludedSecrets: ["AI API Key"],
        tableCounts,
      },
      tables,
    });

    const parsed = parseWorkspaceBackup(JSON.stringify(backup));
    expect(parsed.manifest.containsApiKeys).toBe(false);
    expect(parsed.manifest.remoteExecution).toBe(false);
    expect(parsed.tables.projects).toHaveLength(1);
    expect(await verifyWorkspaceBackup(parsed)).toBe(true);
  });

  it("rejects unsafe declarations and detects changed payloads", async () => {
    const tables = createEmptyWorkspaceTables();
    const tableCounts = Object.fromEntries(
      WORKSPACE_BACKUP_TABLES.map((name) => [name, 0]),
    ) as Record<(typeof WORKSPACE_BACKUP_TABLES)[number], number>;
    const backup = await finalizeWorkspaceBackup({
      manifest: {
        format: WORKSPACE_BACKUP_FORMAT,
        schemaVersion: WORKSPACE_BACKUP_SCHEMA_VERSION,
        appVersion: "0.4.0",
        exportedAt: "2026-08-19T00:00:00Z",
        exportedBy: "测试人员",
        containsApiKeys: false,
        remoteExecution: false,
        excludedSecrets: [],
        tableCounts,
      },
      tables,
    });

    const unsafe = JSON.parse(JSON.stringify(backup)) as Record<string, unknown>;
    (unsafe.manifest as Record<string, unknown>).containsApiKeys = true;
    expect(() => parseWorkspaceBackup(JSON.stringify(unsafe))).toThrow(/安全声明/);

    backup.tables.projects.push({ id: "tampered" });
    expect(await verifyWorkspaceBackup(backup)).toBe(false);
  });
});
