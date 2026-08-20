import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const APP_IDENTIFIER = "com.kllin.agnovexa.opsdesk";
const DATABASE_FILE = "opsdesk.db";
const MAX_TEXT = 12_000;

type SqlValue = null | number | bigint | string | Uint8Array;
type Row = Record<string, SqlValue>;

function text(value: SqlValue | undefined): string {
  return typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
}

function number(value: SqlValue | undefined): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function parseJson<T>(value: SqlValue | undefined, fallback: T): T {
  try {
    return value ? JSON.parse(text(value)) as T : fallback;
  } catch {
    return fallback;
  }
}

function redactJson<T>(value: SqlValue | undefined, fallback: T): T {
  const parsed = parseJson<unknown>(value, fallback);
  const sanitize = (item: unknown, key = ""): unknown => {
    if (typeof item === "string") {
      if (/password|passwd|token|secret|api[_-]?key|credential/i.test(key)) return "[敏感值已隐藏]";
      return redactSensitiveText(item);
    }
    if (Array.isArray(item)) return item.slice(0, 200).map((entry) => sanitize(entry));
    if (item && typeof item === "object") {
      return Object.fromEntries(
        Object.entries(item as Record<string, unknown>)
          .slice(0, 200)
          .map(([entryKey, entryValue]) => [entryKey, sanitize(entryValue, entryKey)]),
      );
    }
    return item;
  };
  return sanitize(parsed) as T;
}

function limit(value: number | undefined, fallback = 20, maximum = 100): number {
  return Math.min(maximum, Math.max(1, Math.trunc(value ?? fallback)));
}

export function redactSensitiveText(value: string): string {
  return value
    .slice(0, MAX_TEXT)
    .replace(/-----BEGIN [^-]+ PRIVATE KEY-----[\s\S]*?-----END [^-]+ PRIVATE KEY-----/gi, "[私钥已隐藏]")
    .replace(/\b(api[_-]?key|token|password|passwd|secret)\b\s*[:=]\s*([^\s,;]+)/gi, "$1=[敏感值已隐藏]")
    .replace(/\b(Bearer)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 [敏感值已隐藏]");
}

export function maskHost(value: string): string {
  const host = value.trim();
  if (!host) return "未登记";
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) return `${ipv4[1]}.${ipv4[2]}.${ipv4[3]}.***`;
  if (host.includes(":")) return `${host.slice(0, 6)}…`;
  const parts = host.split(".");
  if (parts.length > 1) return `***.${parts.slice(1).join(".")}`;
  return host.length <= 3 ? "***" : `${host.slice(0, 2)}***${host.slice(-1)}`;
}

export function resolveWorkspaceDatabase(explicitPath = process.env.AGNOVEXA_OPSDESK_DB): string {
  if (explicitPath?.trim()) return resolve(explicitPath.trim());
  if (process.platform === "win32" && process.env.APPDATA) {
    return join(process.env.APPDATA, APP_IDENTIFIER, DATABASE_FILE);
  }
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", APP_IDENTIFIER, DATABASE_FILE);
  }
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), APP_IDENTIFIER, DATABASE_FILE);
}

export interface WorkspaceReaderOptions {
  databasePath?: string;
}

export class WorkspaceReader {
  readonly databasePath: string;
  private readonly database: DatabaseSync;

  constructor(options: WorkspaceReaderOptions = {}) {
    this.databasePath = resolveWorkspaceDatabase(options.databasePath);
    if (!existsSync(this.databasePath)) {
      throw new Error(`没有找到 OpsDesk 数据库：${this.databasePath}`);
    }
    this.database = new DatabaseSync(this.databasePath, { readOnly: true, timeout: 5_000 });
    this.database.exec("PRAGMA query_only = ON; PRAGMA foreign_keys = ON;");
  }

  close(): void {
    this.database.close();
  }

  private all(sql: string, ...values: Array<string | number | null>): Row[] {
    return this.database.prepare(sql).all(...values) as Row[];
  }

  private get(sql: string, ...values: Array<string | number | null>): Row | undefined {
    return this.database.prepare(sql).get(...values) as Row | undefined;
  }

  private count(table: string, where = "1 = 1"): number {
    const allowed = new Set([
      "projects", "assets", "deployment_tasks", "change_plans", "change_steps",
      "approval_records", "manual_execution_evidence", "knowledge_entries", "audit_events",
    ]);
    if (!allowed.has(table)) throw new Error("请求了不允许统计的数据表。");
    return number(this.get(`SELECT COUNT(*) AS count FROM ${table} WHERE ${where}`)?.count);
  }

  workspaceOverview() {
    const integrityRow = this.get("PRAGMA integrity_check");
    const integrity = text(Object.values(integrityRow ?? { integrity_check: "unknown" })[0]);
    const counts = {
      projects: this.count("projects", "status <> 'archived'"),
      assets: this.count("assets"),
      tasks: this.count("deployment_tasks"),
      plans: this.count("change_plans"),
      steps: this.count("change_steps"),
      approvals: this.count("approval_records"),
      evidence: this.count("manual_execution_evidence"),
      knowledge: this.count("knowledge_entries"),
    };
    const brokenTasks = number(this.get(
      `SELECT COUNT(*) AS count FROM deployment_tasks t
       WHERE NOT EXISTS (SELECT 1 FROM change_plans p WHERE p.deployment_task_id = t.id)`,
    )?.count);
    return {
      mode: "read-only",
      database: { fileName: DATABASE_FILE, directory: dirname(this.databasePath), integrity },
      counts,
      readiness: {
        canCreateDeployment: counts.projects > 0 && counts.assets > 0,
        canReviewExecution: counts.plans > 0 && counts.steps > 0,
        brokenTaskLinks: brokenTasks,
      },
      security: {
        remoteExecution: false,
        databaseWrites: false,
        secretsReturned: false,
        assetAddressesMasked: true,
      },
    };
  }

  listProjects(input: { query?: string; limit?: number } = {}) {
    const query = input.query?.trim() ?? "";
    return this.all(
      `SELECT p.id, p.name, p.code, p.description, p.status, p.profile_json, p.technologies_json,
              p.updated_at, COUNT(DISTINCT a.id) AS asset_count,
              COUNT(DISTINCT t.id) AS task_count
       FROM projects p
       LEFT JOIN assets a ON a.project_id = p.id
       LEFT JOIN deployment_tasks t ON t.project_id = p.id
       WHERE p.status <> 'archived'
         AND (? = '' OR p.name LIKE '%' || ? || '%' OR p.code LIKE '%' || ? || '%')
       GROUP BY p.id
       ORDER BY p.updated_at DESC
       LIMIT ?`,
      query, query, query, limit(input.limit),
    ).map((row) => ({
      id: text(row.id), name: text(row.name), code: text(row.code),
      description: redactSensitiveText(text(row.description)), status: text(row.status),
      profile: redactJson(row.profile_json, {}), technologies: redactJson(row.technologies_json, []),
      assetCount: number(row.asset_count), taskCount: number(row.task_count), updatedAt: text(row.updated_at),
    }));
  }

  getProjectContext(projectId: string) {
    const project = this.get(
      `SELECT id, name, code, description, status, profile_json, technologies_json, updated_at
       FROM projects WHERE id = ? AND status <> 'archived'`,
      projectId,
    );
    if (!project) throw new Error("没有找到指定项目。");
    const assets = this.listAssets({ projectId, limit: 100 });
    const tasks = this.listTasks({ projectId, limit: 100 });
    const knowledge = this.all(
      `SELECT id, title, summary, verification_status, environment_scope, risk_level, updated_at
       FROM knowledge_entries
       WHERE (project_id = ? OR project_id IS NULL) AND verification_status IN ('reviewed', 'verified')
       ORDER BY CASE verification_status WHEN 'verified' THEN 0 ELSE 1 END, updated_at DESC LIMIT 30`,
      projectId,
    ).map((row) => ({
      id: text(row.id), title: text(row.title), summary: redactSensitiveText(text(row.summary)),
      verificationStatus: text(row.verification_status), environment: text(row.environment_scope),
      riskLevel: text(row.risk_level), updatedAt: text(row.updated_at),
    }));
    return {
      project: {
        id: text(project.id), name: text(project.name), code: text(project.code),
        description: redactSensitiveText(text(project.description)), status: text(project.status),
        profile: redactJson(project.profile_json, {}), technologies: redactJson(project.technologies_json, []),
        updatedAt: text(project.updated_at),
      },
      assets,
      tasks,
      knowledge,
      workflowDiagnosis: this.diagnoseWorkflow({ projectId }),
    };
  }

  listAssets(input: { projectId?: string; environment?: string; limit?: number } = {}) {
    const projectId = input.projectId?.trim() ?? "";
    const environment = input.environment?.trim() ?? "";
    return this.all(
      `SELECT a.id, a.project_id, p.name AS project_name, a.name, a.host, a.port,
              a.server_model, a.operating_system, a.architecture, a.environment,
              a.tags_json, a.notes, COALESCE(s.status, 'uncollected') AS snapshot_status,
              s.collected_at AS snapshot_at
       FROM assets a
       JOIN projects p ON p.id = a.project_id
       LEFT JOIN environment_snapshots s ON s.id = (
         SELECT id FROM environment_snapshots WHERE asset_id = a.id ORDER BY collected_at DESC LIMIT 1
       )
       WHERE (? = '' OR a.project_id = ?) AND (? = '' OR a.environment = ?)
       ORDER BY p.name, a.name LIMIT ?`,
      projectId, projectId, environment, environment, limit(input.limit),
    ).map((row) => ({
      id: text(row.id), projectId: text(row.project_id), projectName: text(row.project_name),
      name: text(row.name), hostMasked: maskHost(text(row.host)), port: number(row.port),
      serverModel: text(row.server_model), operatingSystem: text(row.operating_system),
      architecture: text(row.architecture), environment: text(row.environment),
      tags: parseJson(row.tags_json, []), notes: redactSensitiveText(text(row.notes)),
      snapshotStatus: text(row.snapshot_status), snapshotAt: text(row.snapshot_at) || undefined,
    }));
  }

  listTasks(input: { projectId?: string; taskId?: string; status?: string; limit?: number } = {}) {
    const projectId = input.projectId?.trim() ?? "";
    const taskId = input.taskId?.trim() ?? "";
    const status = input.status?.trim() ?? "";
    return this.all(
      `SELECT t.id, t.project_id, p.name AS project_name, t.asset_id, a.name AS asset_name,
              t.title, t.task_type, t.workflow_phase, t.risk_level, t.status,
              t.created_at, t.updated_at,
              COUNT(DISTINCT cp.id) AS plan_count, COUNT(DISTINCT cs.id) AS step_count,
              COUNT(DISTINCT ar.id) AS approval_count, COUNT(DISTINCT me.id) AS evidence_count
       FROM deployment_tasks t
       JOIN projects p ON p.id = t.project_id
       JOIN assets a ON a.id = t.asset_id
       LEFT JOIN change_plans cp ON cp.deployment_task_id = t.id
       LEFT JOIN change_steps cs ON cs.change_plan_id = cp.id
       LEFT JOIN approval_records ar ON ar.change_plan_id = cp.id
       LEFT JOIN manual_execution_evidence me ON me.deployment_task_id = t.id
       WHERE (? = '' OR t.project_id = ?) AND (? = '' OR t.id = ?) AND (? = '' OR t.status = ?)
       GROUP BY t.id ORDER BY t.updated_at DESC LIMIT ?`,
      projectId, projectId, taskId, taskId, status, status, limit(input.limit),
    ).map((row) => ({
      id: text(row.id), projectId: text(row.project_id), projectName: text(row.project_name),
      assetId: text(row.asset_id), assetName: text(row.asset_name), title: text(row.title),
      taskType: text(row.task_type), phase: text(row.workflow_phase), riskLevel: text(row.risk_level),
      status: text(row.status), planCount: number(row.plan_count), stepCount: number(row.step_count),
      approvalCount: number(row.approval_count), evidenceCount: number(row.evidence_count),
      createdAt: text(row.created_at), updatedAt: text(row.updated_at),
    }));
  }

  getTaskDetails(taskId: string) {
    const task = this.listTasks({ taskId, limit: 1 })[0];
    if (!task) throw new Error("没有找到指定任务。");
    const plans = this.all(
      `SELECT id, title, objective, risk_level, confirmed_facts_json, missing_facts_json,
              impact_scope, config_diff, backup_plan, verification_plan, rollback_plan,
              approval_required, created_at, updated_at
       FROM change_plans WHERE deployment_task_id = ? ORDER BY created_at`,
      taskId,
    ).map((row) => ({
      id: text(row.id), title: text(row.title), objective: text(row.objective), riskLevel: text(row.risk_level),
      confirmedFacts: parseJson(row.confirmed_facts_json, []), missingFacts: parseJson(row.missing_facts_json, []),
      impactScope: redactSensitiveText(text(row.impact_scope)), configDiff: redactSensitiveText(text(row.config_diff)),
      backupPlan: redactSensitiveText(text(row.backup_plan)), verificationPlan: redactSensitiveText(text(row.verification_plan)),
      rollbackPlan: redactSensitiveText(text(row.rollback_plan)), approvalRequired: number(row.approval_required) === 1,
      createdAt: text(row.created_at), updatedAt: text(row.updated_at),
    }));
    const steps = this.all(
      `SELECT cs.id, cs.change_plan_id, cs.step_order, cs.objective, cs.prerequisites_json,
              cs.risk_level, cs.command_preview, cs.expected_result, cs.evidence_required_json,
              cs.validation_commands, cs.rollback_commands, cs.network_required
       FROM change_steps cs JOIN change_plans cp ON cp.id = cs.change_plan_id
       WHERE cp.deployment_task_id = ? ORDER BY cs.step_order`,
      taskId,
    ).map((row) => ({
      id: text(row.id), planId: text(row.change_plan_id), order: number(row.step_order),
      objective: text(row.objective), prerequisites: parseJson(row.prerequisites_json, []),
      riskLevel: text(row.risk_level), commandPreview: redactSensitiveText(text(row.command_preview)),
      expectedResult: redactSensitiveText(text(row.expected_result)),
      evidenceRequired: parseJson(row.evidence_required_json, []),
      validationCommands: redactSensitiveText(text(row.validation_commands)),
      rollbackCommands: redactSensitiveText(text(row.rollback_commands)),
      networkRequired: number(row.network_required) === 1,
    }));
    const approvals = this.all(
      `SELECT ar.reviewer, ar.decision, ar.comment, ar.decided_at
       FROM approval_records ar JOIN change_plans cp ON cp.id = ar.change_plan_id
       WHERE cp.deployment_task_id = ? ORDER BY ar.decided_at DESC`,
      taskId,
    ).map((row) => ({ reviewer: text(row.reviewer), decision: text(row.decision), comment: redactSensitiveText(text(row.comment)), decidedAt: text(row.decided_at) }));
    const evidence = this.all(
      `SELECT executor, executed_at, actual_command_redacted, exit_code, stdout_redacted,
              stderr_redacted, related_logs_redacted, human_actions, evidence_status
       FROM manual_execution_evidence WHERE deployment_task_id = ? ORDER BY executed_at DESC LIMIT 30`,
      taskId,
    ).map((row) => ({
      executor: text(row.executor), executedAt: text(row.executed_at),
      actualCommand: redactSensitiveText(text(row.actual_command_redacted)), exitCode: number(row.exit_code),
      stdout: redactSensitiveText(text(row.stdout_redacted)), stderr: redactSensitiveText(text(row.stderr_redacted)),
      logs: redactSensitiveText(text(row.related_logs_redacted)), humanActions: redactSensitiveText(text(row.human_actions)),
      status: text(row.evidence_status),
    }));
    return { task, plans, steps, approvals, evidence, diagnosis: this.diagnoseTask(task) };
  }

  private diagnoseTask(task: ReturnType<WorkspaceReader["listTasks"]>[number]) {
    const missing: string[] = [];
    let nextAction = "查看任务详情";
    if (task.planCount === 0) {
      missing.push("没有变更计划");
      nextAction = "从部署模板生成计划和步骤";
    } else if (task.stepCount === 0) {
      missing.push("计划没有执行步骤");
      nextAction = "补充至少一个可审阅步骤";
    } else if (task.approvalCount === 0) {
      missing.push("尚未完成人工审阅");
      nextAction = "核对目标、命令、验证和回滚后记录审阅";
    } else if (task.evidenceCount === 0) {
      missing.push("尚未回填执行证据");
      nextAction = "人工执行后回填退出码和脱敏输出";
    } else if (task.phase === "VERIFY") {
      nextAction = "完成独立验收并关闭任务";
    }
    return { healthy: missing.length === 0, missing, nextAction };
  }

  diagnoseWorkflow(input: { projectId?: string } = {}) {
    const tasks = this.listTasks({ projectId: input.projectId, limit: 100 });
    const diagnosed = tasks.map((task) => ({ ...task, diagnosis: this.diagnoseTask(task) }));
    return {
      projectId: input.projectId || null,
      taskCount: diagnosed.length,
      blockedCount: diagnosed.filter((item) => !item.diagnosis.healthy).length,
      tasks: diagnosed,
      recommendedNextAction: diagnosed[0]?.diagnosis.nextAction ?? "先创建项目并登记服务器",
    };
  }

  searchKnowledge(input: { query: string; projectId?: string; limit?: number }) {
    const query = input.query.trim();
    if (query.length < 2) throw new Error("检索词至少需要 2 个字符。");
    const projectId = input.projectId?.trim() ?? "";
    return this.all(
      `SELECT k.id, k.project_id, p.name AS project_name, k.title, k.summary, k.body_markdown,
              k.tags, k.source_scope, k.source_type, k.verification_status,
              k.environment_scope, k.risk_level, k.updated_at
       FROM knowledge_entries k LEFT JOIN projects p ON p.id = k.project_id
       WHERE (? = '' OR k.project_id = ? OR k.project_id IS NULL)
         AND (k.title LIKE '%' || ? || '%' OR k.summary LIKE '%' || ? || '%'
              OR k.body_markdown LIKE '%' || ? || '%' OR k.tags LIKE '%' || ? || '%')
       ORDER BY CASE k.verification_status WHEN 'verified' THEN 0 WHEN 'reviewed' THEN 1 ELSE 2 END,
                k.updated_at DESC LIMIT ?`,
      projectId, projectId, query, query, query, query, limit(input.limit, 10, 30),
    ).map((row) => ({
      id: text(row.id), projectId: text(row.project_id) || null, projectName: text(row.project_name) || null,
      title: text(row.title), summary: redactSensitiveText(text(row.summary)),
      body: redactSensitiveText(text(row.body_markdown)), tags: text(row.tags).split(",").map((item) => item.trim()).filter(Boolean),
      sourceScope: text(row.source_scope), sourceType: text(row.source_type),
      verificationStatus: text(row.verification_status), environment: text(row.environment_scope),
      riskLevel: text(row.risk_level), updatedAt: text(row.updated_at),
    }));
  }

  recentAudit(input: { projectId?: string; taskId?: string; limit?: number } = {}) {
    const projectId = input.projectId?.trim() ?? "";
    const taskId = input.taskId?.trim() ?? "";
    return this.all(
      `SELECT id, project_id, deployment_task_id, actor, event_type, entity_type,
              entity_id, detail_redacted_json, occurred_at
       FROM audit_events
       WHERE (? = '' OR project_id = ?) AND (? = '' OR deployment_task_id = ?)
       ORDER BY occurred_at DESC LIMIT ?`,
      projectId, projectId, taskId, taskId, limit(input.limit, 20, 100),
    ).map((row) => ({
      id: text(row.id), projectId: text(row.project_id) || null, taskId: text(row.deployment_task_id) || null,
      actor: text(row.actor), eventType: text(row.event_type), entityType: text(row.entity_type),
      entityId: text(row.entity_id), detail: parseJson(redactSensitiveText(text(row.detail_redacted_json)), {}),
      occurredAt: text(row.occurred_at),
    }));
  }
}

export function withWorkspace<T>(databasePath: string | undefined, action: (reader: WorkspaceReader) => T): T {
  const reader = new WorkspaceReader({ databasePath });
  try {
    return action(reader);
  } finally {
    reader.close();
  }
}
