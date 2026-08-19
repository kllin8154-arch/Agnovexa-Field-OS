import Database from "@tauri-apps/plugin-sql";

const DATABASE_URL = "sqlite:opsdesk.db";
let databasePromise: Promise<Database> | null = null;

export function isDesktopRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function getDatabase(): Promise<Database> {
  if (!isDesktopRuntime()) {
    throw new Error("当前为浏览器预览模式，不能写入生产工作区。请运行 Windows 桌面版。");
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

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function environmentLabel(value: string): string {
  const labels: Record<string, string> = {
    development: "开发",
    test: "测试",
    staging: "预生产",
    production: "生产",
    demo: "演示",
  };
  return labels[value] ?? value;
}

export interface ProjectRecord {
  id: string;
  name: string;
  code: string;
  description: string;
  status: "active" | "paused" | "archived";
  createdAt: string;
  updatedAt: string;
}

interface ProjectRow {
  id: string;
  name: string;
  code: string;
  description: string;
  status: ProjectRecord["status"];
  created_at: string;
  updated_at: string;
}

export async function listProjects(): Promise<ProjectRecord[]> {
  const db = await getDatabase();
  const rows = await db.select<ProjectRow[]>(
    `SELECT id, name, code, description, status, created_at, updated_at
     FROM projects
     WHERE status <> 'archived'
     ORDER BY updated_at DESC, name COLLATE NOCASE`,
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createProject(input: {
  name: string;
  code?: string;
  description?: string;
}): Promise<ProjectRecord> {
  const name = input.name.trim();
  if (name.length < 2) throw new Error("项目名称至少需要 2 个字符。");
  const db = await getDatabase();
  const id = makeId("project");
  await db.execute(
    `INSERT INTO projects (id, name, code, description, status)
     VALUES ($1, $2, $3, $4, 'active')`,
    [id, name, input.code?.trim() ?? "", input.description?.trim() ?? ""],
  );
  const rows = await db.select<ProjectRow[]>(
    `SELECT id, name, code, description, status, created_at, updated_at
     FROM projects WHERE id = $1`,
    [id],
  );
  const row = rows[0];
  if (!row) throw new Error("项目创建后未能读取，请重试。");
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface AssetRecord {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  host: string;
  port: number;
  username: string;
  serverModel: string;
  operatingSystem: string;
  architecture: "x86_64" | "aarch64" | "unknown";
  environment: "development" | "test" | "staging" | "production" | "demo";
  environmentLabel: string;
  tags: string[];
  notes: string;
  lastSnapshotAt?: string;
  snapshotStatus: "complete" | "missing" | "conflict" | "uncollected";
}

interface AssetRow {
  id: string;
  project_id: string;
  project_name: string;
  name: string;
  host: string;
  port: number;
  username: string;
  server_model: string;
  operating_system: string;
  architecture: AssetRecord["architecture"];
  environment: AssetRecord["environment"];
  tags_json: string;
  notes: string;
  snapshot_status: AssetRecord["snapshotStatus"] | null;
  last_snapshot_at: string | null;
}

export async function listAssets(): Promise<AssetRecord[]> {
  const db = await getDatabase();
  const rows = await db.select<AssetRow[]>(
    `SELECT a.id, a.project_id, p.name AS project_name, a.name, a.host, a.port,
            a.username, a.server_model, a.operating_system, a.architecture,
            a.environment, a.tags_json, a.notes,
            COALESCE(s.status, 'uncollected') AS snapshot_status,
            s.collected_at AS last_snapshot_at
     FROM assets a
     JOIN projects p ON p.id = a.project_id
     LEFT JOIN environment_snapshots s ON s.id = (
       SELECT es.id FROM environment_snapshots es
       WHERE es.asset_id = a.id
       ORDER BY es.collected_at DESC LIMIT 1
     )
     ORDER BY CASE a.environment WHEN 'production' THEN 0 ELSE 1 END,
              p.name COLLATE NOCASE, a.name COLLATE NOCASE`,
  );
  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    name: row.name,
    host: row.host,
    port: Number(row.port),
    username: row.username,
    serverModel: row.server_model,
    operatingSystem: row.operating_system,
    architecture: row.architecture,
    environment: row.environment,
    environmentLabel: environmentLabel(row.environment),
    tags: parseJsonArray(row.tags_json),
    notes: row.notes,
    lastSnapshotAt: row.last_snapshot_at ?? undefined,
    snapshotStatus: row.snapshot_status ?? "uncollected",
  }));
}

export async function createAsset(input: {
  projectId: string;
  name: string;
  host: string;
  port: number;
  username?: string;
  serverModel?: string;
  operatingSystem?: string;
  architecture: AssetRecord["architecture"];
  environment: AssetRecord["environment"];
  tags?: string[];
  notes?: string;
}): Promise<string> {
  if (!input.projectId) throw new Error("请选择项目。");
  if (input.name.trim().length < 2) throw new Error("资产名称至少需要 2 个字符。");
  if (!input.host.trim()) throw new Error("请填写主机名、资产编号或 IP。");
  if (!Number.isInteger(input.port) || input.port < 1 || input.port > 65535) {
    throw new Error("端口必须是 1 到 65535 之间的整数。");
  }
  const db = await getDatabase();
  const id = makeId("asset");
  await db.execute(
    `INSERT INTO assets (
       id, project_id, name, host, port, username, server_model,
       operating_system, architecture, environment, connection_mode,
       tags_json, notes
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'manual', $11, $12)`,
    [
      id,
      input.projectId,
      input.name.trim(),
      input.host.trim(),
      input.port,
      input.username?.trim() ?? "",
      input.serverModel?.trim() ?? "",
      input.operatingSystem?.trim() ?? "",
      input.architecture,
      input.environment,
      JSON.stringify(input.tags ?? []),
      input.notes?.trim() ?? "",
    ],
  );
  return id;
}

export async function deleteAsset(assetId: string): Promise<void> {
  const db = await getDatabase();
  await db.execute("DELETE FROM assets WHERE id = $1", [assetId]);
}

export interface ParsedSnapshotInput {
  status: "complete" | "missing" | "conflict";
  facts: Record<string, string>;
  missingFacts: string[];
  conflictingFacts: string[];
}

export async function saveEnvironmentSnapshot(input: {
  assetId: string;
  collectedBy?: string;
  rawOutputRedacted: string;
  parsed: ParsedSnapshotInput;
}): Promise<string> {
  if (!input.assetId) throw new Error("请选择目标资产。");
  if (input.rawOutputRedacted.trim().length < 20) throw new Error("采集输出过短，不能保存为环境快照。");
  const db = await getDatabase();
  const id = makeId("snapshot");
  await db.execute(
    `INSERT INTO environment_snapshots (
       id, asset_id, status, collected_by, raw_output_redacted,
       parsed_facts_json, missing_facts_json, conflicting_facts_json, checksum
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '')`,
    [
      id,
      input.assetId,
      input.parsed.status,
      input.collectedBy?.trim() ?? "",
      input.rawOutputRedacted,
      JSON.stringify(input.parsed.facts),
      JSON.stringify(input.parsed.missingFacts),
      JSON.stringify(input.parsed.conflictingFacts),
    ],
  );
  return id;
}

export interface DeploymentTaskRecord {
  id: string;
  projectId: string;
  projectName: string;
  assetId: string;
  assetName: string;
  title: string;
  taskType: string;
  workflowPhase: string;
  riskLevel: string;
  status: string;
  createdAt: string;
}

interface DeploymentTaskRow {
  id: string;
  project_id: string;
  project_name: string;
  asset_id: string;
  asset_name: string;
  title: string;
  task_type: string;
  workflow_phase: string;
  risk_level: string;
  status: string;
  created_at: string;
}

export async function listDeploymentTasks(limit = 50): Promise<DeploymentTaskRecord[]> {
  const db = await getDatabase();
  const rows = await db.select<DeploymentTaskRow[]>(
    `SELECT t.id, t.project_id, p.name AS project_name, t.asset_id,
            a.name AS asset_name, t.title, t.task_type, t.workflow_phase,
            t.risk_level, t.status, t.created_at
     FROM deployment_tasks t
     JOIN projects p ON p.id = t.project_id
     JOIN assets a ON a.id = t.asset_id
     ORDER BY t.updated_at DESC
     LIMIT $1`,
    [limit],
  );
  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    assetId: row.asset_id,
    assetName: row.asset_name,
    title: row.title,
    taskType: row.task_type,
    workflowPhase: row.workflow_phase,
    riskLevel: row.risk_level,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export async function createDeploymentTask(input: {
  projectId: string;
  assetId: string;
  title: string;
  taskType: string;
  environment: AssetRecord["environment"];
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  targetDefinition: Record<string, unknown>;
  acceptanceCriteria: string[];
  rollbackRequirements: string;
}): Promise<string> {
  if (!input.projectId || !input.assetId) throw new Error("请选择项目和目标资产。");
  if (input.title.trim().length < 4) throw new Error("任务标题至少需要 4 个字符。");
  const db = await getDatabase();
  const id = makeId("task");
  await db.execute(
    `INSERT INTO deployment_tasks (
       id, project_id, asset_id, title, task_type, environment,
       workflow_phase, risk_level, target_definition_json,
       acceptance_criteria_json, rollback_requirements, status
     ) VALUES ($1, $2, $3, $4, $5, $6, 'DEFINE', $7, $8, $9, $10, 'in_progress')`,
    [
      id,
      input.projectId,
      input.assetId,
      input.title.trim(),
      input.taskType.trim() || "manual-deployment",
      input.environment,
      input.riskLevel,
      JSON.stringify(input.targetDefinition),
      JSON.stringify(input.acceptanceCriteria),
      input.rollbackRequirements.trim(),
    ],
  );
  return id;
}

export interface ManualPackageRecord {
  taskId: string;
  planId: string;
  stepId: string;
  title: string;
  projectName: string;
  assetName: string;
  phase: string;
  riskLevel: string;
  objective: string;
  commands: string;
  expectedResult: string;
  validationCommands: string;
  rollbackCommands: string;
  createdAt: string;
}

interface ManualPackageRow {
  task_id: string;
  plan_id: string;
  step_id: string;
  title: string;
  project_name: string;
  asset_name: string;
  workflow_phase: string;
  risk_level: string;
  objective: string;
  command_preview: string;
  expected_result: string;
  validation_commands: string;
  rollback_commands: string;
  created_at: string;
}

export async function listManualPackages(): Promise<ManualPackageRecord[]> {
  const db = await getDatabase();
  const rows = await db.select<ManualPackageRow[]>(
    `SELECT t.id AS task_id, cp.id AS plan_id, cs.id AS step_id, t.title,
            p.name AS project_name, a.name AS asset_name, t.workflow_phase,
            cp.risk_level, cs.objective, cs.command_preview, cs.expected_result,
            cs.validation_commands, cs.rollback_commands, t.created_at
     FROM deployment_tasks t
     JOIN projects p ON p.id = t.project_id
     JOIN assets a ON a.id = t.asset_id
     JOIN change_plans cp ON cp.deployment_task_id = t.id
     JOIN change_steps cs ON cs.change_plan_id = cp.id AND cs.step_order = 1
     ORDER BY t.updated_at DESC`,
  );
  return rows.map((row) => ({
    taskId: row.task_id,
    planId: row.plan_id,
    stepId: row.step_id,
    title: row.title,
    projectName: row.project_name,
    assetName: row.asset_name,
    phase: row.workflow_phase,
    riskLevel: row.risk_level,
    objective: row.objective,
    commands: row.command_preview,
    expectedResult: row.expected_result,
    validationCommands: row.validation_commands,
    rollbackCommands: row.rollback_commands,
    createdAt: row.created_at,
  }));
}

export async function createManualPackage(input: {
  projectId: string;
  assetId: string;
  title: string;
  taskType: "command" | "sql" | "config";
  environment: AssetRecord["environment"];
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  objective: string;
  commands: string;
  expectedResult: string;
  validationCommands: string;
  rollbackCommands: string;
}): Promise<ManualPackageRecord> {
  if (!input.projectId || !input.assetId) throw new Error("请选择项目和目标资产。");
  if (input.title.trim().length < 4) throw new Error("执行包标题至少需要 4 个字符。");
  if (input.commands.trim().length < 3) throw new Error("命令或 SQL 不能为空。");
  if (!input.validationCommands.trim()) throw new Error("必须填写独立验证命令或人工验证步骤。");
  if (!input.rollbackCommands.trim()) throw new Error("必须填写回滚命令或明确的不可回滚说明。");

  const db = await getDatabase();
  const taskId = makeId("task");
  const planId = makeId("plan");
  const stepId = makeId("step");
  await db.execute("BEGIN IMMEDIATE");
  try {
    await db.execute(
      `INSERT INTO deployment_tasks (
         id, project_id, asset_id, title, task_type, environment,
         workflow_phase, risk_level, target_definition_json,
         acceptance_criteria_json, rollback_requirements, status
       ) VALUES ($1, $2, $3, $4, $5, $6, 'PLAN', $7, '{}', '[]', $8, 'in_progress')`,
      [taskId, input.projectId, input.assetId, input.title.trim(), input.taskType, input.environment, input.riskLevel, input.rollbackCommands.trim()],
    );
    await db.execute(
      `INSERT INTO change_plans (
         id, deployment_task_id, title, objective, risk_level,
         verification_plan, rollback_plan, approval_required
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 1)`,
      [planId, taskId, input.title.trim(), input.objective.trim(), input.riskLevel, input.validationCommands.trim(), input.rollbackCommands.trim()],
    );
    await db.execute(
      `INSERT INTO change_steps (
         id, change_plan_id, step_order, objective, risk_level,
         command_preview, expected_result, validation_commands,
         rollback_commands, network_required
       ) VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8, 0)`,
      [stepId, planId, input.objective.trim(), input.riskLevel, input.commands.trim(), input.expectedResult.trim(), input.validationCommands.trim(), input.rollbackCommands.trim()],
    );
    await db.execute("COMMIT");
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }

  const rows = await listManualPackages();
  const created = rows.find((item) => item.taskId === taskId);
  if (!created) throw new Error("执行包创建后未能读取，请重试。");
  return created;
}

export async function recordManualExecutionEvidence(input: {
  taskId: string;
  stepId: string;
  executor: string;
  actualCommandRedacted: string;
  exitCode: number;
  stdoutRedacted: string;
  stderrRedacted: string;
  relatedLogsRedacted?: string;
  humanActions?: string;
}): Promise<string> {
  if (!Number.isInteger(input.exitCode)) throw new Error("退出码必须是整数。");
  if (input.executor.trim().length < 2) throw new Error("请填写执行人员。");
  const db = await getDatabase();
  const id = makeId("evidence");
  const evidenceStatus = input.exitCode === 0 ? "unverified" : "failed";
  await db.execute("BEGIN IMMEDIATE");
  try {
    await db.execute(
      `INSERT INTO manual_execution_evidence (
         id, deployment_task_id, change_step_id, executor, executed_at,
         actual_command_redacted, exit_code, stdout_redacted, stderr_redacted,
         related_logs_redacted, human_actions, evidence_status
       ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        input.taskId,
        input.stepId,
        input.executor.trim(),
        input.actualCommandRedacted,
        input.exitCode,
        input.stdoutRedacted,
        input.stderrRedacted,
        input.relatedLogsRedacted ?? "",
        input.humanActions ?? "",
        evidenceStatus,
      ],
    );
    await db.execute(
      `UPDATE deployment_tasks
       SET workflow_phase = $1, status = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [input.exitCode === 0 ? "VERIFY" : "MANUAL_EXECUTE", input.exitCode === 0 ? "partially_verified" : "failed", input.taskId],
    );
    await db.execute("COMMIT");
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }
  return id;
}

export interface KnowledgeRecord {
  id: string;
  projectId?: string;
  projectName?: string;
  title: string;
  summary: string;
  bodyMarkdown: string;
  tags: string[];
  sourceScope: "inner" | "public";
  sourceType: "skill" | "sop" | "incident" | "official_doc" | "web_result";
  verificationStatus: "draft" | "reviewed" | "verified" | "deprecated";
  environmentScope: "development" | "test" | "staging" | "production" | "general";
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  lastVerifiedAt?: string;
  updatedAt: string;
}

interface KnowledgeRow {
  id: string;
  project_id: string | null;
  project_name: string | null;
  title: string;
  summary: string;
  body_markdown: string;
  tags: string;
  source_scope: KnowledgeRecord["sourceScope"];
  source_type: KnowledgeRecord["sourceType"];
  verification_status: KnowledgeRecord["verificationStatus"];
  environment_scope: KnowledgeRecord["environmentScope"];
  risk_level: KnowledgeRecord["riskLevel"];
  last_verified_at: string | null;
  updated_at: string;
}

export async function listKnowledge(input: {
  scope: "inner" | "public";
  query?: string;
}): Promise<KnowledgeRecord[]> {
  const db = await getDatabase();
  const keyword = input.query?.trim() ?? "";
  const rows = await db.select<KnowledgeRow[]>(
    `SELECT k.id, k.project_id, p.name AS project_name, k.title, k.summary,
            k.body_markdown, k.tags, k.source_scope, k.source_type,
            k.verification_status, k.environment_scope, k.risk_level,
            k.last_verified_at, k.updated_at
     FROM knowledge_entries k
     LEFT JOIN projects p ON p.id = k.project_id
     WHERE k.source_scope = $1
       AND ($2 = '' OR k.title LIKE '%' || $2 || '%' OR k.summary LIKE '%' || $2 || '%' OR k.tags LIKE '%' || $2 || '%')
     ORDER BY CASE k.verification_status WHEN 'verified' THEN 0 WHEN 'reviewed' THEN 1 ELSE 2 END,
              k.updated_at DESC`,
    [input.scope, keyword],
  );
  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id ?? undefined,
    projectName: row.project_name ?? undefined,
    title: row.title,
    summary: row.summary,
    bodyMarkdown: row.body_markdown,
    tags: row.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
    sourceScope: row.source_scope,
    sourceType: row.source_type,
    verificationStatus: row.verification_status,
    environmentScope: row.environment_scope,
    riskLevel: row.risk_level,
    lastVerifiedAt: row.last_verified_at ?? undefined,
    updatedAt: row.updated_at,
  }));
}

export async function createKnowledgeEntry(input: {
  projectId?: string;
  title: string;
  summary: string;
  bodyMarkdown: string;
  tags: string[];
  sourceScope: "inner" | "public";
  sourceType: KnowledgeRecord["sourceType"];
  verificationStatus: "draft" | "reviewed";
  environmentScope: KnowledgeRecord["environmentScope"];
  riskLevel: KnowledgeRecord["riskLevel"];
}): Promise<string> {
  if (input.title.trim().length < 4) throw new Error("知识标题至少需要 4 个字符。");
  if (input.bodyMarkdown.trim().length < 10) throw new Error("知识正文至少需要 10 个字符。");
  if (input.verificationStatus === "reviewed" && input.sourceScope === "public") {
    // reviewed public data is allowed; verified is intentionally not accepted by this creation API.
  }
  const db = await getDatabase();
  const id = makeId("knowledge");
  await db.execute(
    `INSERT INTO knowledge_entries (
       id, project_id, title, summary, body_markdown, tags, source_scope,
       source_type, verification_status, environment_scope, risk_level,
       applicable_versions_json, requires_human_approval,
       contains_sensitive_data, web_source_reviewed
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, '{}', 1, 0, $12)`,
    [
      id,
      input.projectId || null,
      input.title.trim(),
      input.summary.trim(),
      input.bodyMarkdown.trim(),
      input.tags.join(","),
      input.sourceScope,
      input.sourceType,
      input.verificationStatus,
      input.environmentScope,
      input.riskLevel,
      input.sourceScope === "public" && input.verificationStatus === "reviewed" ? 1 : 0,
    ],
  );
  return id;
}

export interface DashboardSummary {
  projects: number;
  assets: number;
  pendingManual: number;
  failedTasks: number;
  verifiedKnowledge: number;
  publicDrafts: number;
}

interface CountRow { count: number; }

async function count(db: Database, sql: string, values: unknown[] = []): Promise<number> {
  const rows = await db.select<CountRow[]>(sql, values);
  return Number(rows[0]?.count ?? 0);
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const db = await getDatabase();
  const [projects, assets, pendingManual, failedTasks, verifiedKnowledge, publicDrafts] = await Promise.all([
    count(db, "SELECT COUNT(*) AS count FROM projects WHERE status <> 'archived'"),
    count(db, "SELECT COUNT(*) AS count FROM assets"),
    count(db, "SELECT COUNT(*) AS count FROM deployment_tasks WHERE workflow_phase = 'MANUAL_EXECUTE'"),
    count(db, "SELECT COUNT(*) AS count FROM deployment_tasks WHERE status = 'failed'"),
    count(db, "SELECT COUNT(*) AS count FROM knowledge_entries WHERE source_scope = 'inner' AND verification_status = 'verified'"),
    count(db, "SELECT COUNT(*) AS count FROM knowledge_entries WHERE source_scope = 'public' AND verification_status IN ('draft', 'reviewed')"),
  ]);
  return { projects, assets, pendingManual, failedTasks, verifiedKnowledge, publicDrafts };
}

export async function approveManualPackage(input: {
  taskId: string;
  planId: string;
  reviewer: string;
  comment?: string;
}): Promise<void> {
  if (input.reviewer.trim().length < 2) throw new Error("请填写审阅人员。");
  const db = await getDatabase();
  const id = makeId("approval");
  await db.execute("BEGIN IMMEDIATE");
  try {
    await db.execute(
      `INSERT INTO approval_records (
         id, change_plan_id, reviewer, decision,
         reviewed_target, reviewed_commands, reviewed_diff,
         reviewed_validation, reviewed_rollback, comment
       ) VALUES ($1, $2, $3, 'approved_for_manual_execution', 1, 1, 1, 1, 1, $4)`,
      [id, input.planId, input.reviewer.trim(), input.comment?.trim() ?? ""],
    );
    await db.execute(
      `UPDATE deployment_tasks
       SET workflow_phase = 'MANUAL_EXECUTE', status = 'in_progress', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [input.taskId],
    );
    await db.execute("COMMIT");
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }
}
