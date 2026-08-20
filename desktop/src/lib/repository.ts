import Database from "@tauri-apps/plugin-sql";
import { buildDeploymentExecutionDraft, type DeploymentExecutionDraft } from "./deploymentDraft";

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

function parseJsonObject(value: string | null | undefined): Record<string, string> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .filter((entry): entry is [string, string] => typeof entry[1] === "string")
        .map(([key, item]) => [key, item.trim()])
        .filter(([, item]) => item.length > 0),
    );
  } catch {
    return {};
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
  profile: ProjectProfile;
  technologies: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectProfile {
  operatingSystems: string[];
  architectures: string[];
  deploymentMode: "offline" | "intranet" | "hybrid";
  constraints: string;
}

export const EMPTY_PROJECT_PROFILE: ProjectProfile = {
  operatingSystems: [],
  architectures: [],
  deploymentMode: "offline",
  constraints: "",
};

interface ProjectRow {
  id: string;
  name: string;
  code: string;
  description: string;
  status: ProjectRecord["status"];
  profile_json: string;
  technologies_json: string;
  created_at: string;
  updated_at: string;
}

function normalizeTextList(values: string[], maxItems = 40): string[] {
  return Array.from(new Set(values.map((item) => item.trim().replace(/\s+/g, " ")).filter(Boolean)))
    .slice(0, maxItems)
    .map((item) => item.slice(0, 80));
}

function parseProjectProfile(value: string): ProjectProfile {
  try {
    const parsed = JSON.parse(value) as Partial<ProjectProfile>;
    const deploymentMode = parsed.deploymentMode === "intranet" || parsed.deploymentMode === "hybrid"
      ? parsed.deploymentMode
      : "offline";
    return {
      operatingSystems: normalizeTextList(Array.isArray(parsed.operatingSystems) ? parsed.operatingSystems.filter((item): item is string => typeof item === "string") : []),
      architectures: normalizeTextList(Array.isArray(parsed.architectures) ? parsed.architectures.filter((item): item is string => typeof item === "string") : []),
      deploymentMode,
      constraints: typeof parsed.constraints === "string" ? parsed.constraints.trim().slice(0, 4_000) : "",
    };
  } catch {
    return { ...EMPTY_PROJECT_PROFILE };
  }
}

function mapProjectRow(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    status: row.status,
    profile: parseProjectProfile(row.profile_json),
    technologies: normalizeTextList(parseJsonArray(row.technologies_json)),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const PROJECT_COLUMNS = "id, name, code, description, status, profile_json, technologies_json, created_at, updated_at";

export async function listProjects(): Promise<ProjectRecord[]> {
  const db = await getDatabase();
  const rows = await db.select<ProjectRow[]>(
    `SELECT ${PROJECT_COLUMNS}
     FROM projects
     WHERE status <> 'archived'
     ORDER BY updated_at DESC, name COLLATE NOCASE`,
  );
  return rows.map(mapProjectRow);
}

export async function createProject(input: {
  name: string;
  code?: string;
  description?: string;
  status?: "active" | "paused";
  profile?: ProjectProfile;
  technologies?: string[];
}): Promise<ProjectRecord> {
  const name = input.name.trim();
  if (name.length < 2) throw new Error("项目名称至少需要 2 个字符。");
  if ((input.technologies?.length ?? 0) > 40) throw new Error("单个项目最多保存 40 项技术，建议合并重复版本描述。");
  const db = await getDatabase();
  const id = makeId("project");
  await db.execute(
    `INSERT INTO projects (id, name, code, description, status, profile_json, technologies_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      name,
      input.code?.trim() ?? "",
      input.description?.trim() ?? "",
      input.status === "paused" ? "paused" : "active",
      JSON.stringify(input.profile ?? EMPTY_PROJECT_PROFILE),
      JSON.stringify(normalizeTextList(input.technologies ?? [])),
    ],
  );
  const rows = await db.select<ProjectRow[]>(
    `SELECT ${PROJECT_COLUMNS}
     FROM projects WHERE id = $1`,
    [id],
  );
  const row = rows[0];
  if (!row) throw new Error("项目创建后未能读取，请重试。");
  return mapProjectRow(row);
}

export async function updateProject(input: {
  id: string;
  name: string;
  code: string;
  description: string;
  status: "active" | "paused";
  profile: ProjectProfile;
  technologies: string[];
}): Promise<ProjectRecord> {
  const name = input.name.trim();
  if (name.length < 2) throw new Error("项目名称至少需要 2 个字符。");
  if (input.technologies.length > 40) throw new Error("单个项目最多保存 40 项技术，建议合并重复版本描述。");
  const db = await getDatabase();
  await db.execute(
    `UPDATE projects
     SET name = $2, code = $3, description = $4, status = $5,
         profile_json = $6, technologies_json = $7, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [
      input.id,
      name,
      input.code.trim(),
      input.description.trim(),
      input.status,
      JSON.stringify({
        operatingSystems: normalizeTextList(input.profile.operatingSystems),
        architectures: normalizeTextList(input.profile.architectures),
        deploymentMode: input.profile.deploymentMode,
        constraints: input.profile.constraints.trim().slice(0, 4_000),
      }),
      JSON.stringify(normalizeTextList(input.technologies)),
    ],
  );
  const rows = await db.select<ProjectRow[]>(`SELECT ${PROJECT_COLUMNS} FROM projects WHERE id = $1`, [input.id]);
  const row = rows[0];
  if (!row) throw new Error("项目更新后未能读取，请重试。");
  return mapProjectRow(row);
}

export interface ProjectAiContext {
  projectId: string;
  projectName: string;
  projectCode: string;
  assetCount: number;
  verifiedKnowledgeCount: number;
  summary: string;
}

interface ProjectContextAssetRow {
  name: string;
  environment: AssetRecord["environment"];
  operating_system: string;
  architecture: AssetRecord["architecture"];
  server_model: string;
  parsed_facts_json: string | null;
}

interface ProjectContextKnowledgeRow {
  title: string;
  summary: string;
  environment_scope: string;
}

export async function getProjectAiContext(projectId: string): Promise<ProjectAiContext> {
  if (!projectId) throw new Error("请选择需要作为 AI 上下文的项目。");
  const db = await getDatabase();
  const projects = await db.select<ProjectRow[]>(
    `SELECT ${PROJECT_COLUMNS}
     FROM projects WHERE id = $1 AND status <> 'archived'`,
    [projectId],
  );
  const project = projects[0];
  if (!project) throw new Error("所选项目不存在或已归档。");
  const projectRecord = mapProjectRow(project);

  const [assets, knowledge] = await Promise.all([
    db.select<ProjectContextAssetRow[]>(
      `SELECT a.name, a.environment, a.operating_system, a.architecture, a.server_model,
              s.parsed_facts_json
       FROM assets a
       LEFT JOIN environment_snapshots s ON s.id = (
         SELECT es.id FROM environment_snapshots es
         WHERE es.asset_id = a.id ORDER BY es.collected_at DESC LIMIT 1
       )
       WHERE a.project_id = $1
       ORDER BY CASE a.environment WHEN 'production' THEN 0 ELSE 1 END, a.name COLLATE NOCASE`,
      [projectId],
    ),
    db.select<ProjectContextKnowledgeRow[]>(
      `SELECT title, summary, environment_scope
       FROM knowledge_entries
       WHERE verification_status = 'verified' AND (project_id = $1 OR project_id IS NULL)
       ORDER BY CASE WHEN project_id = $1 THEN 0 ELSE 1 END, updated_at DESC
       LIMIT 12`,
      [projectId],
    ),
  ]);

  const assetLines = assets.map((asset) => {
    const facts = parseJsonObject(asset.parsed_facts_json);
    const factText = Object.entries(facts).slice(0, 8).map(([key, value]) => `${key}=${value}`).join("；");
    const base = [
      asset.name,
      environmentLabel(asset.environment),
      asset.operating_system || "系统待采集",
      asset.architecture,
      asset.server_model,
    ].filter(Boolean).join(" / ");
    return `- ${base}${factText ? `；最近快照：${factText}` : ""}`;
  });
  const knowledgeLines = knowledge.map((entry) =>
    `- [${entry.environment_scope}] ${entry.title}${entry.summary ? `：${entry.summary}` : ""}`,
  );
  const summary = [
    `项目：${project.name}${project.code ? `（${project.code}）` : ""}`,
    project.description ? `项目说明：${project.description}` : "",
    `项目操作系统：${projectRecord.profile.operatingSystems.join("、") || "未指定"}`,
    `项目架构：${projectRecord.profile.architectures.join("、") || "未指定"}`,
    `项目技术栈：${projectRecord.technologies.join("、") || "未指定"}`,
    projectRecord.profile.constraints ? `现场约束：${projectRecord.profile.constraints}` : "",
    `服务器资产（${assets.length}）：`,
    assetLines.length ? assetLines.join("\n") : "- 暂无资产或环境快照",
    `已验证知识（${knowledge.length}）：`,
    knowledgeLines.length ? knowledgeLines.join("\n") : "- 暂无可直接引用的已验证知识",
    "上下文不包含资产地址、用户名、密码、Token 或连接串。",
  ].filter(Boolean).join("\n");

  return {
    projectId: project.id,
    projectName: project.name,
    projectCode: project.code,
    assetCount: assets.length,
    verifiedKnowledgeCount: knowledge.length,
    summary,
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
  executionDraft: {
    objective: string;
    commands: string;
    expectedResult: string;
    validationCommands: string;
    rollbackCommands: string;
    missingFacts: string[];
  };
}): Promise<string> {
  if (!input.projectId || !input.assetId) throw new Error("请选择项目和目标资产。");
  if (input.title.trim().length < 4) throw new Error("任务标题至少需要 4 个字符。");
  const db = await getDatabase();
  const id = makeId("task");
  const planId = makeId("plan");
  const stepId = makeId("step");
  await db.execute("BEGIN IMMEDIATE");
  try {
    await db.execute(
      `INSERT INTO deployment_tasks (
         id, project_id, asset_id, title, task_type, environment,
         workflow_phase, risk_level, target_definition_json,
         acceptance_criteria_json, rollback_requirements, status
       ) VALUES ($1, $2, $3, $4, $5, $6, 'PLAN', $7, $8, $9, $10, 'in_progress')`,
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
        input.executionDraft.rollbackCommands,
      ],
    );
    await db.execute(
      `INSERT INTO change_plans (
         id, deployment_task_id, title, objective, risk_level,
         missing_facts_json, verification_plan, rollback_plan, approval_required
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)`,
      [
        planId,
        id,
        input.title.trim(),
        input.executionDraft.objective,
        input.riskLevel,
        JSON.stringify(input.executionDraft.missingFacts),
        input.executionDraft.validationCommands,
        input.executionDraft.rollbackCommands,
      ],
    );
    await db.execute(
      `INSERT INTO change_steps (
         id, change_plan_id, step_order, objective, prerequisites_json,
         risk_level, command_preview, expected_result, evidence_required_json,
         validation_commands, rollback_commands, network_required
       ) VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8, $9, $10, 0)`,
      [
        stepId,
        planId,
        input.executionDraft.objective,
        JSON.stringify(input.executionDraft.missingFacts),
        input.riskLevel,
        input.executionDraft.commands,
        input.executionDraft.expectedResult,
        JSON.stringify(["实际执行命令（脱敏）", "退出码", "stdout / stderr（脱敏）", "人工验证结果"]),
        input.executionDraft.validationCommands,
        input.executionDraft.rollbackCommands,
      ],
    );
    await db.execute("COMMIT");
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }
  return id;
}

export interface ManualPackageRecord {
  taskId: string;
  projectId: string;
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
  ready: boolean;
}

interface ManualPackageRow {
  task_id: string;
  project_id: string;
  plan_id: string | null;
  step_id: string | null;
  title: string;
  project_name: string;
  asset_name: string;
  workflow_phase: string;
  risk_level: string;
  objective: string | null;
  command_preview: string | null;
  expected_result: string | null;
  validation_commands: string | null;
  rollback_commands: string | null;
  created_at: string;
}

export async function listManualPackages(): Promise<ManualPackageRecord[]> {
  const db = await getDatabase();
  const rows = await db.select<ManualPackageRow[]>(
    `SELECT t.id AS task_id, t.project_id, cp.id AS plan_id, cs.id AS step_id, t.title,
            p.name AS project_name, a.name AS asset_name, t.workflow_phase,
            COALESCE(cp.risk_level, t.risk_level) AS risk_level,
            cs.objective, cs.command_preview, cs.expected_result,
            cs.validation_commands, cs.rollback_commands, t.created_at
     FROM deployment_tasks t
     JOIN projects p ON p.id = t.project_id
     JOIN assets a ON a.id = t.asset_id
     LEFT JOIN change_plans cp ON cp.id = (
       SELECT id FROM change_plans WHERE deployment_task_id = t.id ORDER BY created_at DESC LIMIT 1
     )
     LEFT JOIN change_steps cs ON cs.change_plan_id = cp.id AND cs.step_order = 1
     ORDER BY t.updated_at DESC`,
  );
  return rows.map((row) => ({
    taskId: row.task_id,
    projectId: row.project_id,
    planId: row.plan_id ?? "",
    stepId: row.step_id ?? "",
    title: row.title,
    projectName: row.project_name,
    assetName: row.asset_name,
    phase: row.workflow_phase,
    riskLevel: row.risk_level,
    objective: row.objective ?? "尚未生成执行草案",
    commands: row.command_preview ?? "",
    expectedResult: row.expected_result ?? "",
    validationCommands: row.validation_commands ?? "",
    rollbackCommands: row.rollback_commands ?? "",
    createdAt: row.created_at,
    ready: Boolean(row.plan_id && row.step_id),
  }));
}

interface OrphanDeploymentTaskRow {
  id: string;
  title: string;
  task_type: string;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  target_definition_json: string;
  acceptance_criteria_json: string;
  rollback_requirements: string;
  asset_name: string;
  host: string;
  operating_system: string;
  architecture: string;
}

function readDraftTarget(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function targetText(target: Record<string, unknown>, key: string): string {
  return typeof target[key] === "string" ? String(target[key]) : "";
}

function targetList(target: Record<string, unknown>, key: string): string[] {
  const value = target[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

async function insertDeploymentDraft(
  db: Database,
  task: Pick<OrphanDeploymentTaskRow, "id" | "title" | "risk_level">,
  draft: DeploymentExecutionDraft,
  existingPlanId?: string,
): Promise<void> {
  const planId = existingPlanId || makeId("plan");
  const stepId = makeId("step");
  if (!existingPlanId) {
    await db.execute(
      `INSERT INTO change_plans (
         id, deployment_task_id, title, objective, risk_level,
         missing_facts_json, verification_plan, rollback_plan, approval_required
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)`,
      [planId, task.id, task.title, draft.objective, task.risk_level, JSON.stringify(draft.missingFacts), draft.validationCommands, draft.rollbackCommands],
    );
  }
  await db.execute(
    `INSERT INTO change_steps (
       id, change_plan_id, step_order, objective, prerequisites_json,
       risk_level, command_preview, expected_result, evidence_required_json,
       validation_commands, rollback_commands, network_required
     ) VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8, $9, $10, 0)`,
    [stepId, planId, draft.objective, JSON.stringify(draft.missingFacts), task.risk_level, draft.commands, draft.expectedResult, JSON.stringify(["实际执行命令（脱敏）", "退出码", "stdout / stderr（脱敏）", "人工验证结果"]), draft.validationCommands, draft.rollbackCommands],
  );
  await db.execute(
    "UPDATE deployment_tasks SET workflow_phase = 'PLAN', status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
    [task.id],
  );
}

export async function repairDeploymentTaskDraft(taskId: string): Promise<boolean> {
  const db = await getDatabase();
  const rows = await db.select<OrphanDeploymentTaskRow[]>(
    `SELECT t.id, t.title, t.task_type, t.risk_level, t.target_definition_json,
            t.acceptance_criteria_json, t.rollback_requirements,
            a.name AS asset_name, a.host, a.operating_system, a.architecture
     FROM deployment_tasks t
     JOIN assets a ON a.id = t.asset_id
     WHERE t.id = $1
     LIMIT 1`,
    [taskId],
  );
  const task = rows[0];
  if (!task) throw new Error("没有找到这项部署任务。");
  const target = readDraftTarget(task.target_definition_json);
  const templateId = targetText(target, "templateId") || task.task_type;
  const draft = buildDeploymentExecutionDraft({
    templateId,
    asset: {
      name: task.asset_name,
      host: task.host,
      operatingSystem: task.operating_system,
      architecture: task.architecture,
    },
    offlineMedia: targetText(target, "offlineMedia"),
    targetDirectories: targetText(target, "targetDirectories"),
    acceptanceCriteria: parseJsonArray(task.acceptance_criteria_json),
    rollbackRequirements: task.rollback_requirements,
    requiredInputs: targetList(target, "requiredInputs"),
  });

  await db.execute("BEGIN IMMEDIATE");
  try {
    const existingPlans = await db.select<Array<{ id: string; step_count: number }>>(
      `SELECT cp.id, COUNT(cs.id) AS step_count
       FROM change_plans cp
       LEFT JOIN change_steps cs ON cs.change_plan_id = cp.id
       WHERE cp.deployment_task_id = $1
       GROUP BY cp.id
       ORDER BY cp.created_at DESC`,
      [task.id],
    );
    const incompletePlan = existingPlans.find((item) => Number(item.step_count) === 0);
    if (existingPlans.length > 0 && !incompletePlan) {
      await db.execute("ROLLBACK");
      return false;
    }
    await insertDeploymentDraft(db, task, draft, incompletePlan?.id);
    await db.execute("COMMIT");
    return true;
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }
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
