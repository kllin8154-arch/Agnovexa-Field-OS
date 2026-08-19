import {
  getProductionDatabase,
  WORKSPACE_FORMAT,
  WORKSPACE_SCHEMA_VERSION,
  writeProductionAudit,
} from "./productionCore";

interface TableSpec {
  name: string;
  columns: string[];
}

const WORKSPACE_TABLES: TableSpec[] = [
  { name: "projects", columns: ["id", "name", "code", "description", "status", "created_at", "updated_at"] },
  { name: "credential_references", columns: ["id", "provider", "reference_key", "display_name", "description", "created_at", "updated_at"] },
  { name: "assets", columns: ["id", "project_id", "name", "host", "port", "username", "server_model", "operating_system", "architecture", "environment", "connection_mode", "credential_reference_id", "tags_json", "notes", "created_at", "updated_at"] },
  { name: "environment_snapshots", columns: ["id", "asset_id", "status", "collected_by", "collected_at", "raw_output_redacted", "parsed_facts_json", "missing_facts_json", "conflicting_facts_json", "checksum"] },
  { name: "deployment_tasks", columns: ["id", "project_id", "asset_id", "title", "task_type", "environment", "workflow_phase", "risk_level", "target_definition_json", "acceptance_criteria_json", "rollback_requirements", "status", "created_at", "updated_at"] },
  { name: "change_plans", columns: ["id", "deployment_task_id", "title", "objective", "risk_level", "confirmed_facts_json", "missing_facts_json", "impact_scope", "config_diff", "backup_plan", "verification_plan", "rollback_plan", "source_summary_json", "approval_required", "created_at", "updated_at"] },
  { name: "change_steps", columns: ["id", "change_plan_id", "step_order", "objective", "prerequisites_json", "risk_level", "command_preview", "expected_result", "evidence_required_json", "validation_commands", "rollback_commands", "network_required", "created_at"] },
  { name: "approval_records", columns: ["id", "change_plan_id", "reviewer", "decision", "reviewed_target", "reviewed_commands", "reviewed_diff", "reviewed_validation", "reviewed_rollback", "comment", "decided_at"] },
  { name: "manual_execution_evidence", columns: ["id", "deployment_task_id", "change_step_id", "executor", "executed_at", "actual_command_redacted", "exit_code", "stdout_redacted", "stderr_redacted", "related_logs_redacted", "human_actions", "evidence_status", "created_at"] },
  { name: "skill_definitions", columns: ["id", "name", "version", "status", "owner", "risk_level", "source_scope", "metadata_yaml", "prompt_markdown", "precheck_template", "action_template", "verification_template", "rollback_template", "requires_human_approval", "last_verified_at", "created_at", "updated_at"] },
  { name: "knowledge_entries", columns: ["id", "project_id", "deployment_task_id", "title", "summary", "body_markdown", "tags", "source_scope", "source_type", "verification_status", "environment_scope", "risk_level", "applicable_versions_json", "validation_evidence_redacted", "rollback_plan", "maintainer", "last_verified_at", "requires_human_approval", "contains_sensitive_data", "web_source_reviewed", "created_at", "updated_at"] },
  { name: "generated_artifacts", columns: ["id", "deployment_task_id", "artifact_type", "title", "body_markdown", "review_status", "generated_at", "reviewed_at"] },
  { name: "audit_events", columns: ["id", "project_id", "deployment_task_id", "actor", "event_type", "entity_type", "entity_id", "detail_redacted_json", "occurred_at"] },
];

export interface WorkspaceBundle {
  format: typeof WORKSPACE_FORMAT;
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  containsApiKeys: false;
  remoteExecution: false;
  integrity: string;
  rowCounts: Record<string, number>;
  tables: Record<string, Array<Record<string, unknown>>>;
}

export interface WorkspaceHealth {
  integrityOk: boolean;
  integrityMessage: string;
  rowCounts: Record<string, number>;
  verifiedSkills: number;
  verifiedKnowledge: number;
  publicDrafts: number;
  failedManualTasks: number;
}

export async function getWorkspaceHealth(): Promise<WorkspaceHealth> {
  const db = await getProductionDatabase();
  const integrityRows = await db.select<Array<Record<string, unknown>>>("PRAGMA integrity_check");
  const integrityMessage = String(integrityRows[0]?.integrity_check ?? Object.values(integrityRows[0] ?? {})[0] ?? "unknown");
  const rowCounts: Record<string, number> = {};
  for (const spec of WORKSPACE_TABLES) {
    const rows = await db.select<Array<{ count: number }>>(`SELECT COUNT(*) AS count FROM ${spec.name}`);
    rowCounts[spec.name] = Number(rows[0]?.count ?? 0);
  }
  const verifiedSkills = rowCounts.skill_definitions
    ? Number((await db.select<Array<{ count: number }>>("SELECT COUNT(*) AS count FROM skill_definitions WHERE status = 'verified'"))[0]?.count ?? 0)
    : 0;
  const verifiedKnowledge = Number((await db.select<Array<{ count: number }>>("SELECT COUNT(*) AS count FROM knowledge_entries WHERE source_scope = 'inner' AND verification_status = 'verified'"))[0]?.count ?? 0);
  const publicDrafts = Number((await db.select<Array<{ count: number }>>("SELECT COUNT(*) AS count FROM knowledge_entries WHERE source_scope = 'public' AND verification_status IN ('draft', 'reviewed')"))[0]?.count ?? 0);
  const failedManualTasks = Number((await db.select<Array<{ count: number }>>("SELECT COUNT(*) AS count FROM deployment_tasks WHERE workflow_phase = 'MANUAL_EXECUTE' AND status = 'failed'"))[0]?.count ?? 0);
  return {
    integrityOk: integrityMessage.toLowerCase() === "ok",
    integrityMessage,
    rowCounts,
    verifiedSkills,
    verifiedKnowledge,
    publicDrafts,
    failedManualTasks,
  };
}

export async function exportWorkspaceBundle(appVersion = "0.4.0"): Promise<WorkspaceBundle> {
  const db = await getProductionDatabase();
  const integrityRows = await db.select<Array<Record<string, unknown>>>("PRAGMA integrity_check");
  const integrity = String(integrityRows[0]?.integrity_check ?? Object.values(integrityRows[0] ?? {})[0] ?? "unknown");
  if (integrity.toLowerCase() !== "ok") {
    throw new Error(`SQLite 完整性检查未通过：${integrity}`);
  }

  const tables: WorkspaceBundle["tables"] = {};
  const rowCounts: Record<string, number> = {};
  for (const spec of WORKSPACE_TABLES) {
    const rows = await db.select<Array<Record<string, unknown>>>(
      `SELECT ${spec.columns.join(", ")} FROM ${spec.name}`,
    );
    tables[spec.name] = rows;
    rowCounts[spec.name] = rows.length;
  }

  const bundle: WorkspaceBundle = {
    format: WORKSPACE_FORMAT,
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    appVersion,
    exportedAt: new Date().toISOString(),
    containsApiKeys: false,
    remoteExecution: false,
    integrity,
    rowCounts,
    tables,
  };
  await writeProductionAudit({
    actor: "local-user",
    eventType: "workspace.exported",
    entityType: "workspace",
    entityId: bundle.exportedAt,
    detail: { appVersion, rowCounts, containsApiKeys: false, remoteExecution: false },
  });
  return bundle;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function validateWorkspaceBundle(value: unknown): WorkspaceBundle {
  if (!isRecord(value)) throw new Error("备份文件不是有效 JSON 对象。");
  const bundle = value as Partial<WorkspaceBundle>;
  if (bundle.format !== WORKSPACE_FORMAT) throw new Error("不是 Agnovexa OpsDesk 工作区备份。");
  if (bundle.schemaVersion !== WORKSPACE_SCHEMA_VERSION) {
    throw new Error(`暂不支持该备份结构版本：${String(bundle.schemaVersion)}`);
  }
  if (typeof bundle.appVersion !== "string" || !bundle.appVersion.trim() || bundle.appVersion.length > 64) {
    throw new Error("备份缺少有效的应用版本。");
  }
  if (typeof bundle.exportedAt !== "string" || Number.isNaN(Date.parse(bundle.exportedAt))) {
    throw new Error("备份缺少有效的导出时间。");
  }
  if (bundle.containsApiKeys !== false) throw new Error("备份安全声明异常：containsApiKeys 必须为 false。");
  if (bundle.remoteExecution !== false) throw new Error("备份安全声明异常：remoteExecution 必须为 false。");
  if (String(bundle.integrity).toLowerCase() !== "ok") throw new Error("备份生成时的 SQLite 完整性检查未通过。");
  if (!isRecord(bundle.tables)) throw new Error("备份缺少 tables 数据。");
  if (!isRecord(bundle.rowCounts)) throw new Error("备份缺少 rowCounts 数据。");

  const allowedTables = new Set(WORKSPACE_TABLES.map((spec) => spec.name));
  let totalRows = 0;
  for (const [table, rows] of Object.entries(bundle.tables)) {
    if (!allowedTables.has(table)) throw new Error(`备份包含未知数据表：${table}`);
    if (!Array.isArray(rows)) throw new Error(`数据表 ${table} 的内容不是数组。`);
    const declaredCount = bundle.rowCounts[table];
    if (declaredCount !== undefined && (!Number.isInteger(declaredCount) || declaredCount < 0 || declaredCount !== rows.length)) {
      throw new Error(`数据表 ${table} 的记录数声明不一致。`);
    }
    totalRows += rows.length;
    if (totalRows > 1_000_000) throw new Error("备份记录数量超过安全上限。");
    for (const row of rows) {
      if (!isRecord(row) || typeof row.id !== "string" || !row.id.trim()) {
        throw new Error(`数据表 ${table} 包含缺少有效 ID 的记录。`);
      }
    }
  }
  return bundle as WorkspaceBundle;
}

export async function importWorkspaceBundle(value: unknown, reviewer: string): Promise<Record<string, number>> {
  if (reviewer.trim().length < 2) throw new Error("请填写导入操作人。");
  const bundle = validateWorkspaceBundle(value);
  const db = await getProductionDatabase();
  const imported: Record<string, number> = {};
  await db.execute("BEGIN IMMEDIATE");
  try {
    for (const spec of WORKSPACE_TABLES) {
      const rows = bundle.tables[spec.name] ?? [];
      let count = 0;
      const placeholders = spec.columns.map((_, index) => `$${index + 1}`).join(", ");
      const sql = `INSERT OR IGNORE INTO ${spec.name} (${spec.columns.join(", ")}) VALUES (${placeholders})`;
      for (const row of rows) {
        if (!row || typeof row !== "object" || !row.id) continue;
        const values = spec.columns.map((column) => row[column] ?? null);
        const result = await db.execute(sql, values);
        count += Number(result.rowsAffected ?? 0);
      }
      imported[spec.name] = count;
    }
    await db.execute("COMMIT");
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }

  await writeProductionAudit({
    actor: reviewer,
    eventType: "workspace.imported",
    entityType: "workspace",
    entityId: bundle.exportedAt,
    detail: { sourceAppVersion: bundle.appVersion, imported, mergeOnly: true },
  });
  return imported;
}
