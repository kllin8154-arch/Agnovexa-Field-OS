export const WORKSPACE_BACKUP_FORMAT = "agnovexa-opsdesk-workspace";
export const WORKSPACE_BACKUP_SCHEMA_VERSION = 1;
export const WORKSPACE_BACKUP_MAX_BYTES = 200 * 1024 * 1024;

export const WORKSPACE_BACKUP_TABLES = [
  "projects",
  "assets",
  "environment_snapshots",
  "deployment_tasks",
  "change_plans",
  "change_steps",
  "approval_records",
  "manual_execution_evidence",
  "skill_definitions",
  "knowledge_entries",
  "generated_artifacts",
  "audit_events",
] as const;

export type WorkspaceBackupTableName = typeof WORKSPACE_BACKUP_TABLES[number];
export type WorkspaceBackupScalar = string | number | null;
export type WorkspaceBackupRow = Record<string, WorkspaceBackupScalar>;
export type WorkspaceBackupTables = {
  [K in WorkspaceBackupTableName]: WorkspaceBackupRow[];
};

export interface WorkspaceBackupManifest {
  format: typeof WORKSPACE_BACKUP_FORMAT;
  schemaVersion: typeof WORKSPACE_BACKUP_SCHEMA_VERSION;
  appVersion: string;
  exportedAt: string;
  exportedBy: string;
  containsApiKeys: false;
  remoteExecution: false;
  excludedSecrets: string[];
  tableCounts: Record<WorkspaceBackupTableName, number>;
  payloadSha256: string;
}

export interface WorkspaceBackup {
  manifest: WorkspaceBackupManifest;
  tables: WorkspaceBackupTables;
}

export function createEmptyWorkspaceTables(): WorkspaceBackupTables {
  return Object.fromEntries(
    WORKSPACE_BACKUP_TABLES.map((name) => [name, []]),
  ) as WorkspaceBackupTables;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])]),
  );
}

export function canonicalWorkspacePayload(tables: WorkspaceBackupTables): string {
  const ordered = Object.fromEntries(
    WORKSPACE_BACKUP_TABLES.map((name) => [name, tables[name]]),
  );
  return JSON.stringify(canonicalize(ordered));
}

export async function sha256Hex(value: string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("当前运行环境不支持 SHA-256 校验。");
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function finalizeWorkspaceBackup(
  backup: Omit<WorkspaceBackup, "manifest"> & {
    manifest: Omit<WorkspaceBackupManifest, "payloadSha256">;
  },
): Promise<WorkspaceBackup> {
  const payloadSha256 = await sha256Hex(canonicalWorkspacePayload(backup.tables));
  return {
    ...backup,
    manifest: {
      ...backup.manifest,
      payloadSha256,
    },
  };
}

function validateRow(tableName: string, value: unknown, rowIndex: number): WorkspaceBackupRow {
  if (!isRecord(value)) {
    throw new Error(`${tableName} 第 ${rowIndex + 1} 行不是有效对象。`);
  }
  const row: WorkspaceBackupRow = {};
  for (const [key, item] of Object.entries(value)) {
    if (!/^[a-z][a-z0-9_]*$/i.test(key)) {
      throw new Error(`${tableName} 包含非法字段名：${key}`);
    }
    if (item !== null && typeof item !== "string" && typeof item !== "number") {
      throw new Error(`${tableName}.${key} 只允许字符串、数字或 null。`);
    }
    if (typeof item === "number" && !Number.isFinite(item)) {
      throw new Error(`${tableName}.${key} 包含非有限数字。`);
    }
    row[key] = item;
  }
  return row;
}

export function parseWorkspaceBackup(raw: string): WorkspaceBackup {
  if (!raw.trim()) throw new Error("备份文件为空。");
  if (new Blob([raw]).size > WORKSPACE_BACKUP_MAX_BYTES) {
    throw new Error("备份文件超过 200 MB，当前版本拒绝直接载入。");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("备份文件不是有效 JSON。");
  }
  if (!isRecord(parsed) || !isRecord(parsed.manifest) || !isRecord(parsed.tables)) {
    throw new Error("备份文件缺少 manifest 或 tables。");
  }

  const manifest = parsed.manifest;
  if (manifest.format !== WORKSPACE_BACKUP_FORMAT) throw new Error("不是 Agnovexa OpsDesk 工作区备份。");
  if (manifest.schemaVersion !== WORKSPACE_BACKUP_SCHEMA_VERSION) {
    throw new Error(`不支持的备份结构版本：${String(manifest.schemaVersion)}`);
  }
  if (manifest.containsApiKeys !== false || manifest.remoteExecution !== false) {
    throw new Error("备份安全声明无效：必须明确不包含 API Key，且不包含远程执行能力。");
  }
  if (typeof manifest.appVersion !== "string" || typeof manifest.exportedAt !== "string") {
    throw new Error("备份版本或导出时间无效。");
  }
  if (typeof manifest.exportedBy !== "string") throw new Error("备份缺少导出人员。");
  if (typeof manifest.payloadSha256 !== "string" || !/^[a-f0-9]{64}$/i.test(manifest.payloadSha256)) {
    throw new Error("备份缺少有效 SHA-256 摘要。");
  }
  if (!Array.isArray(manifest.excludedSecrets)) throw new Error("备份缺少敏感信息排除声明。");
  if (!isRecord(manifest.tableCounts)) throw new Error("备份缺少表计数信息。");

  const unknownTables = Object.keys(parsed.tables).filter(
    (name) => !WORKSPACE_BACKUP_TABLES.includes(name as WorkspaceBackupTableName),
  );
  if (unknownTables.length > 0) {
    throw new Error(`备份包含当前版本不认识的数据表：${unknownTables.join("、")}`);
  }

  const tables = createEmptyWorkspaceTables();
  for (const tableName of WORKSPACE_BACKUP_TABLES) {
    const rawRows = parsed.tables[tableName];
    if (!Array.isArray(rawRows)) throw new Error(`备份缺少数据表：${tableName}`);
    if (rawRows.length > 500_000) throw new Error(`${tableName} 行数异常，已拒绝载入。`);
    tables[tableName] = rawRows.map((row, index) => validateRow(tableName, row, index));
    const declared = manifest.tableCounts[tableName];
    if (declared !== rawRows.length) {
      throw new Error(`${tableName} 行数与 manifest 不一致。`);
    }
  }

  return {
    manifest: {
      format: WORKSPACE_BACKUP_FORMAT,
      schemaVersion: WORKSPACE_BACKUP_SCHEMA_VERSION,
      appVersion: manifest.appVersion,
      exportedAt: manifest.exportedAt,
      exportedBy: manifest.exportedBy,
      containsApiKeys: false,
      remoteExecution: false,
      excludedSecrets: manifest.excludedSecrets.filter((item): item is string => typeof item === "string"),
      tableCounts: Object.fromEntries(
        WORKSPACE_BACKUP_TABLES.map((name) => [name, Number(manifest.tableCounts[name])]),
      ) as Record<WorkspaceBackupTableName, number>,
      payloadSha256: manifest.payloadSha256.toLowerCase(),
    },
    tables,
  };
}

export async function verifyWorkspaceBackup(backup: WorkspaceBackup): Promise<boolean> {
  const actual = await sha256Hex(canonicalWorkspacePayload(backup.tables));
  return actual === backup.manifest.payloadSha256.toLowerCase();
}

export function workspaceBackupFileName(exportedAt = new Date().toISOString()): string {
  const safe = exportedAt.replace(/[:.]/g, "-");
  return `Agnovexa-OpsDesk-Workspace-${safe}.opsdesk.json`;
}

export function downloadTextFile(fileName: string, content: string, type = "application/json;charset=utf-8"): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_024 ** 2) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / 1_024 ** 2).toFixed(1)} MB`;
}
