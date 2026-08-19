import Database from "@tauri-apps/plugin-sql";
import {
  buildDeploymentReportMarkdown,
  deploymentReportFileName,
  type DeploymentReportApproval,
  type DeploymentReportData,
  type DeploymentReportEvidence,
  type DeploymentReportPlan,
  type DeploymentReportStep,
  type DeploymentReportTask,
} from "./deploymentReport";
import {
  WORKSPACE_BACKUP_FORMAT,
  WORKSPACE_BACKUP_SCHEMA_VERSION,
  WORKSPACE_BACKUP_TABLES,
  finalizeWorkspaceBackup,
  verifyWorkspaceBackup,
  type WorkspaceBackup,
  type WorkspaceBackupRow,
  type WorkspaceBackupTableName,
  type WorkspaceBackupTables,
} from "./workspaceBackup";

const DATABASE_URL = "sqlite:opsdesk.db";
const APP_VERSION = "0.4.0";
let databasePromise: Promise<Database> | null = null;

interface BackupTableConfig {
  columns: readonly string[];
  orderBy: string;
}

const BACKUP_TABLE_CONFIGS: Record<WorkspaceBackupTableName, BackupTableConfig> = {
  projects: {
    columns: ["id", "name", "code", "description", "status", "profile_json", "technologies_json", "created_at", "updated_at"],
    orderBy: "created_at, id",
  },
  assets: {
    columns: [
      "id", "project_id", "name", "host", "port", "username", "server_model",
      "operating_system", "architecture", "environment", "connection_mode",
      "tags_json", "notes", "created_at", "updated_at",
    ],
    orderBy: "created_at, id",
  },
  environment_snapshots: {
    columns: [
      "id", "asset_id", "status", "collected_by", "collected_at", "raw_output_redacted",
      "parsed_facts_json", "missing_facts_json", "conflicting_facts_json", "checksum",
    ],
    orderBy: "collected_at, id",
  },
  deployment_tasks: {
    columns: [
      "id", "project_id", "asset_id", "title", "task_type", "environment",
      "workflow_phase", "risk_level", "target_definition_json", "acceptance_criteria_json",
      "rollback_requirements", "status", "created_at", "updated_at",
    ],
    orderBy: "created_at, id",
  },
  change_plans: {
    columns: [
      "id", "deployment_task_id", "title", "objective", "risk_level",
      "confirmed_facts_json", "missing_facts_json", "impact_scope", "config_diff",
      "backup_plan", "verification_plan", "rollback_plan", "source_summary_json",
      "approval_required", "created_at", "updated_at",
    ],
    orderBy: "created_at, id",
  },
  change_steps: {
    columns: [
      "id", "change_plan_id", "step_order", "objective", "prerequisites_json",
      "risk_level", "command_preview", "expected_result", "evidence_required_json",
      "validation_commands", "rollback_commands", "network_required", "created_at",
    ],
    orderBy: "change_plan_id, step_order, id",
  },
  approval_records: {
    columns: [
      "id", "change_plan_id", "reviewer", "decision", "reviewed_target",
      "reviewed_commands", "reviewed_diff", "reviewed_validation", "reviewed_rollback",
      "comment", "decided_at",
    ],
    orderBy: "decided_at, id",
  },
  manual_execution_evidence: {
    columns: [
      "id", "deployment_task_id", "change_step_id", "executor", "executed_at",
      "actual_command_redacted", "exit_code", "stdout_redacted", "stderr_redacted",
      "related_logs_redacted", "human_actions", "evidence_status", "created_at",
    ],
    orderBy: "executed_at, id",
  },
  skill_definitions: {
    columns: [
      "id", "name", "version", "status", "owner", "risk_level", "source_scope",
      "metadata_yaml", "prompt_markdown", "precheck_template", "action_template",
      "verification_template", "rollback_template", "requires_human_approval",
      "last_verified_at", "created_at", "updated_at",
    ],
    orderBy: "created_at, id, version",
  },
  knowledge_entries: {
    columns: [
      "id", "project_id", "deployment_task_id", "title", "summary", "body_markdown",
      "tags", "source_scope", "source_type", "verification_status", "environment_scope",
      "risk_level", "applicable_versions_json", "validation_evidence_redacted",
      "rollback_plan", "maintainer", "last_verified_at", "requires_human_approval",
      "contains_sensitive_data", "web_source_reviewed", "created_at", "updated_at",
    ],
    orderBy: "created_at, id",
  },
  generated_artifacts: {
    columns: [
      "id", "deployment_task_id", "artifact_type", "title", "body_markdown",
      "review_status", "generated_at", "reviewed_at",
    ],
    orderBy: "generated_at, id",
  },
  audit_events: {
    columns: [
      "id", "project_id", "deployment_task_id", "actor", "event_type", "entity_type",
      "entity_id", "detail_redacted_json", "occurred_at",
    ],
    orderBy: "occurred_at, id",
  },
};

const RESTORE_DELETE_ORDER: WorkspaceBackupTableName[] = [
  "audit_events",
  "generated_artifacts",
  "manual_execution_evidence",
  "approval_records",
  "change_steps",
  "change_plans",
  "knowledge_entries",
  "skill_definitions",
  "deployment_tasks",
  "environment_snapshots",
  "assets",
  "projects",
];

function isDesktopRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function getDatabase(): Promise<Database> {
  if (!isDesktopRuntime()) {
    throw new Error("当前为浏览器预览模式，不能读取或恢复生产工作区。");
  }
  databasePromise ??= Database.load(DATABASE_URL);
  return databasePromise;
}

function makeId(prefix: string): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}

function safeScalar(value: unknown, table: string, column: string): string | number | null {
  if (value === null || typeof value === "string" || typeof value === "number") return value;
  throw new Error(`${table}.${column} 包含无法备份的数据类型。`);
}

function parseStringArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

async function appendAuditEvent(
  db: Database,
  actor: string,
  eventType: string,
  entityId: string,
  detail: Record<string, unknown>,
  deploymentTaskId?: string,
): Promise<void> {
  await db.execute(
    `INSERT INTO audit_events (
       id, project_id, deployment_task_id, actor, event_type,
       entity_type, entity_id, detail_redacted_json
     ) VALUES ($1, NULL, $2, $3, $4, 'workspace', $5, $6)`,
    [makeId("audit"), deploymentTaskId ?? null, actor, eventType, entityId, JSON.stringify(detail)],
  );
}

export async function createWorkspaceBackup(exportedBy: string): Promise<WorkspaceBackup> {
  const actor = exportedBy.trim();
  if (actor.length < 2) throw new Error("请填写备份操作人。");
  const db = await getDatabase();
  const tables = {} as WorkspaceBackupTables;

  for (const tableName of WORKSPACE_BACKUP_TABLES) {
    const config = BACKUP_TABLE_CONFIGS[tableName];
    const rows = await db.select<Array<Record<string, unknown>>>(
      `SELECT ${config.columns.join(", ")} FROM ${tableName} ORDER BY ${config.orderBy}`,
    );
    tables[tableName] = rows.map((row) => Object.fromEntries(
      config.columns.map((column) => [column, safeScalar(row[column], tableName, column)]),
    ) as WorkspaceBackupRow);
  }

  const exportedAt = new Date().toISOString();
  const tableCounts = Object.fromEntries(
    WORKSPACE_BACKUP_TABLES.map((name) => [name, tables[name].length]),
  ) as Record<WorkspaceBackupTableName, number>;

  const backup = await finalizeWorkspaceBackup({
    manifest: {
      format: WORKSPACE_BACKUP_FORMAT,
      schemaVersion: WORKSPACE_BACKUP_SCHEMA_VERSION,
      appVersion: APP_VERSION,
      exportedAt,
      exportedBy: actor,
      containsApiKeys: false,
      remoteExecution: false,
      excludedSecrets: [
        "AI API Key",
        "credential_references",
        "Windows Credential Manager secret",
        "未脱敏的密码、Token、私钥与完整连接串",
      ],
      tableCounts,
    },
    tables,
  });

  await appendAuditEvent(db, actor, "workspace_backup_exported", backup.manifest.payloadSha256, {
    exportedAt,
    tableCounts,
    containsApiKeys: false,
    remoteExecution: false,
  });
  return backup;
}

function insertStatement(tableName: WorkspaceBackupTableName): string {
  const columns = BACKUP_TABLE_CONFIGS[tableName].columns;
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
  return `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`;
}

function restoreValue(tableName: WorkspaceBackupTableName, column: string, row: WorkspaceBackupRow) {
  if (row[column] !== undefined && row[column] !== null) return row[column];
  if (tableName === "projects" && column === "profile_json") return "{}";
  if (tableName === "projects" && column === "technologies_json") return "[]";
  return null;
}

export async function restoreWorkspaceBackup(backup: WorkspaceBackup, restoredBy: string): Promise<void> {
  const actor = restoredBy.trim();
  if (actor.length < 2) throw new Error("请填写恢复操作人。");
  if (!(await verifyWorkspaceBackup(backup))) throw new Error("备份 SHA-256 校验失败，已拒绝恢复。");

  const db = await getDatabase();
  await db.execute("BEGIN IMMEDIATE");
  try {
    for (const tableName of RESTORE_DELETE_ORDER) {
      await db.execute(`DELETE FROM ${tableName}`);
    }

    for (const tableName of WORKSPACE_BACKUP_TABLES) {
      const config = BACKUP_TABLE_CONFIGS[tableName];
      const sql = insertStatement(tableName);
      for (const row of backup.tables[tableName]) {
        const values = config.columns.map((column) => restoreValue(tableName, column, row));
        await db.execute(sql, values);
      }
    }

    const violations = await db.select<Array<Record<string, unknown>>>("PRAGMA foreign_key_check");
    if (violations.length > 0) {
      throw new Error(`恢复后检测到 ${violations.length} 条外键冲突。`);
    }

    await appendAuditEvent(db, actor, "workspace_backup_restored", backup.manifest.payloadSha256, {
      sourceExportedAt: backup.manifest.exportedAt,
      sourceAppVersion: backup.manifest.appVersion,
      tableCounts: backup.manifest.tableCounts,
    });
    await db.execute("COMMIT");
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }
}

export interface WorkspaceHealth {
  integrity: string;
  foreignKeyViolations: number;
  databaseVersion: string;
  counts: Record<WorkspaceBackupTableName, number>;
  lastBackupAt?: string;
  lastRestoreAt?: string;
}

export async function getWorkspaceHealth(): Promise<WorkspaceHealth> {
  const db = await getDatabase();
  const integrityRows = await db.select<Array<Record<string, unknown>>>("PRAGMA integrity_check");
  const integrity = String(Object.values(integrityRows[0] ?? { integrity_check: "unknown" })[0] ?? "unknown");
  const foreignKeyViolations = (await db.select<Array<Record<string, unknown>>>("PRAGMA foreign_key_check")).length;
  const versionRows = await db.select<Array<{ version: string }>>("SELECT sqlite_version() AS version");
  const counts = {} as Record<WorkspaceBackupTableName, number>;
  for (const tableName of WORKSPACE_BACKUP_TABLES) {
    const rows = await db.select<Array<{ count: number }>>(`SELECT COUNT(*) AS count FROM ${tableName}`);
    counts[tableName] = Number(rows[0]?.count ?? 0);
  }
  const auditRows = await db.select<Array<{ event_type: string; occurred_at: string }>>(
    `SELECT event_type, occurred_at
     FROM audit_events
     WHERE event_type IN ('workspace_backup_exported', 'workspace_backup_restored')
     ORDER BY occurred_at DESC`,
  );
  return {
    integrity,
    foreignKeyViolations,
    databaseVersion: versionRows[0]?.version ?? "unknown",
    counts,
    lastBackupAt: auditRows.find((row) => row.event_type === "workspace_backup_exported")?.occurred_at,
    lastRestoreAt: auditRows.find((row) => row.event_type === "workspace_backup_restored")?.occurred_at,
  };
}

export interface ReportableTask {
  id: string;
  title: string;
  projectName: string;
  assetName: string;
  workflowPhase: string;
  status: string;
  updatedAt: string;
}

export async function listReportableTasks(): Promise<ReportableTask[]> {
  const db = await getDatabase();
  return db.select<ReportableTask[]>(
    `SELECT t.id, t.title, p.name AS projectName, a.name AS assetName,
            t.workflow_phase AS workflowPhase, t.status, t.updated_at AS updatedAt
     FROM deployment_tasks t
     JOIN projects p ON p.id = t.project_id
     JOIN assets a ON a.id = t.asset_id
     ORDER BY t.updated_at DESC
     LIMIT 200`,
  );
}

interface ReportTaskRow {
  id: string;
  title: string;
  task_type: string;
  environment: string;
  workflow_phase: string;
  risk_level: string;
  status: string;
  project_name: string;
  asset_name: string;
  asset_host: string;
  operating_system: string;
  architecture: string;
  target_definition_json: string;
  acceptance_criteria_json: string;
  rollback_requirements: string;
  created_at: string;
  updated_at: string;
}

async function loadDeploymentReportData(taskId: string, actor: string): Promise<DeploymentReportData> {
  const db = await getDatabase();
  const taskRows = await db.select<ReportTaskRow[]>(
    `SELECT t.id, t.title, t.task_type, t.environment, t.workflow_phase,
            t.risk_level, t.status, p.name AS project_name, a.name AS asset_name,
            a.host AS asset_host, a.operating_system, a.architecture,
            t.target_definition_json, t.acceptance_criteria_json,
            t.rollback_requirements, t.created_at, t.updated_at
     FROM deployment_tasks t
     JOIN projects p ON p.id = t.project_id
     JOIN assets a ON a.id = t.asset_id
     WHERE t.id = $1`,
    [taskId],
  );
  const row = taskRows[0];
  if (!row) throw new Error("没有找到要生成报告的部署任务。");

  const task: DeploymentReportTask = {
    id: row.id,
    title: row.title,
    taskType: row.task_type,
    environment: row.environment,
    workflowPhase: row.workflow_phase,
    riskLevel: row.risk_level,
    status: row.status,
    projectName: row.project_name,
    assetName: row.asset_name,
    assetHost: row.asset_host,
    operatingSystem: row.operating_system,
    architecture: row.architecture,
    targetDefinition: row.target_definition_json || "{}",
    acceptanceCriteria: parseStringArray(row.acceptance_criteria_json),
    rollbackRequirements: row.rollback_requirements,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  const planRows = await db.select<Array<Record<string, unknown>>>(
    `SELECT id, title, objective, risk_level, confirmed_facts_json,
            missing_facts_json, impact_scope, config_diff, backup_plan,
            verification_plan, rollback_plan
     FROM change_plans WHERE deployment_task_id = $1 ORDER BY created_at, id`,
    [taskId],
  );
  const plans: DeploymentReportPlan[] = planRows.map((plan) => ({
    id: String(plan.id ?? ""),
    title: String(plan.title ?? ""),
    objective: String(plan.objective ?? ""),
    riskLevel: String(plan.risk_level ?? ""),
    confirmedFacts: parseStringArray(String(plan.confirmed_facts_json ?? "[]")),
    missingFacts: parseStringArray(String(plan.missing_facts_json ?? "[]")),
    impactScope: String(plan.impact_scope ?? ""),
    configDiff: String(plan.config_diff ?? ""),
    backupPlan: String(plan.backup_plan ?? ""),
    verificationPlan: String(plan.verification_plan ?? ""),
    rollbackPlan: String(plan.rollback_plan ?? ""),
  }));

  const stepRows = await db.select<Array<Record<string, unknown>>>(
    `SELECT cs.id, cs.step_order, cs.objective, cs.risk_level,
            cs.command_preview, cs.expected_result, cs.validation_commands,
            cs.rollback_commands
     FROM change_steps cs
     JOIN change_plans cp ON cp.id = cs.change_plan_id
     WHERE cp.deployment_task_id = $1
     ORDER BY cs.step_order, cs.created_at, cs.id`,
    [taskId],
  );
  const steps: DeploymentReportStep[] = stepRows.map((step) => ({
    id: String(step.id ?? ""),
    order: Number(step.step_order ?? 0),
    objective: String(step.objective ?? ""),
    riskLevel: String(step.risk_level ?? ""),
    commands: String(step.command_preview ?? ""),
    expectedResult: String(step.expected_result ?? ""),
    validationCommands: String(step.validation_commands ?? ""),
    rollbackCommands: String(step.rollback_commands ?? ""),
  }));

  const approvalRows = await db.select<Array<Record<string, unknown>>>(
    `SELECT ar.reviewer, ar.decision, ar.comment, ar.decided_at
     FROM approval_records ar
     JOIN change_plans cp ON cp.id = ar.change_plan_id
     WHERE cp.deployment_task_id = $1
     ORDER BY ar.decided_at, ar.id`,
    [taskId],
  );
  const approvals: DeploymentReportApproval[] = approvalRows.map((approval) => ({
    reviewer: String(approval.reviewer ?? ""),
    decision: String(approval.decision ?? ""),
    comment: String(approval.comment ?? ""),
    decidedAt: String(approval.decided_at ?? ""),
  }));

  const evidenceRows = await db.select<Array<Record<string, unknown>>>(
    `SELECT executor, executed_at, actual_command_redacted, exit_code,
            stdout_redacted, stderr_redacted, related_logs_redacted,
            human_actions, evidence_status
     FROM manual_execution_evidence
     WHERE deployment_task_id = $1
     ORDER BY executed_at, id`,
    [taskId],
  );
  const evidence: DeploymentReportEvidence[] = evidenceRows.map((item) => ({
    executor: String(item.executor ?? ""),
    executedAt: String(item.executed_at ?? ""),
    actualCommand: String(item.actual_command_redacted ?? ""),
    exitCode: item.exit_code === null || item.exit_code === undefined ? null : Number(item.exit_code),
    stdout: String(item.stdout_redacted ?? ""),
    stderr: String(item.stderr_redacted ?? ""),
    relatedLogs: String(item.related_logs_redacted ?? ""),
    humanActions: String(item.human_actions ?? ""),
    evidenceStatus: String(item.evidence_status ?? ""),
  }));

  return {
    task,
    plans,
    steps,
    approvals,
    evidence,
    generatedAt: new Date().toISOString(),
    generatedBy: actor,
  };
}

export interface GeneratedReportRecord {
  id: string;
  taskId: string;
  title: string;
  bodyMarkdown: string;
  reviewStatus: string;
  generatedAt: string;
}

export async function generateAndArchiveDeploymentReport(
  taskId: string,
  generatedBy: string,
): Promise<{ record: GeneratedReportRecord; fileName: string }> {
  const actor = generatedBy.trim();
  if (actor.length < 2) throw new Error("请填写报告生成人。");
  const data = await loadDeploymentReportData(taskId, actor);
  const bodyMarkdown = buildDeploymentReportMarkdown(data);
  const db = await getDatabase();
  const id = makeId("artifact");
  const title = `${data.task.title}——部署与变更报告`;
  await db.execute("BEGIN IMMEDIATE");
  try {
    await db.execute(
      `INSERT INTO generated_artifacts (
         id, deployment_task_id, artifact_type, title, body_markdown, review_status
       ) VALUES ($1, $2, 'deployment_report', $3, $4, 'draft')`,
      [id, taskId, title, bodyMarkdown],
    );
    await appendAuditEvent(db, actor, "deployment_report_generated", id, {
      taskId,
      title,
      evidenceCount: data.evidence.length,
      approvalCount: data.approvals.length,
    }, taskId);
    await db.execute("COMMIT");
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }
  return {
    record: {
      id,
      taskId,
      title,
      bodyMarkdown,
      reviewStatus: "draft",
      generatedAt: data.generatedAt,
    },
    fileName: deploymentReportFileName(data.task),
  };
}

export async function listGeneratedReports(limit = 50): Promise<GeneratedReportRecord[]> {
  const db = await getDatabase();
  return db.select<GeneratedReportRecord[]>(
    `SELECT id, deployment_task_id AS taskId, title, body_markdown AS bodyMarkdown,
            review_status AS reviewStatus, generated_at AS generatedAt
     FROM generated_artifacts
     WHERE artifact_type = 'deployment_report'
     ORDER BY generated_at DESC
     LIMIT $1`,
    [limit],
  );
}
