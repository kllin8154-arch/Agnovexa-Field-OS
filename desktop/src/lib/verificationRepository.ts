import {
  clipProductionText,
  getProductionDatabase,
  makeProductionId,
} from "./productionCore";
import { redactSensitiveText } from "./redaction";
import {
  VERIFICATION_CATEGORIES,
  VERIFICATION_CATEGORY_META,
  evaluateVerificationGate,
  type VerificationCategory,
  type VerificationLayer,
  type VerificationLayerStatus,
  type VerificationOverallStatus,
} from "./verificationPolicy";

export interface VerificationTask {
  id: string;
  title: string;
  projectName: string;
  assetName: string;
  environment: string;
  riskLevel: string;
  workflowPhase: string;
  status: string;
  updatedAt: string;
}

export interface VerificationClosure {
  overallStatus: VerificationOverallStatus;
  reviewer: string;
  summary: string;
  decidedAt?: string;
}

export interface VerificationWorkspace {
  task: VerificationTask;
  layers: Record<VerificationCategory, VerificationLayer>;
  closure?: VerificationClosure;
}

interface TaskRow {
  id: string;
  title: string;
  project_name: string;
  asset_name: string;
  environment: string;
  risk_level: string;
  workflow_phase: string;
  status: string;
  updated_at: string;
}

interface AuditRow {
  event_type: string;
  actor: string;
  detail_redacted_json: string;
  occurred_at: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseDetail(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function layerStatus(value: unknown): VerificationLayerStatus {
  return value === "passed" || value === "failed" || value === "human_exempt"
    ? value
    : "pending";
}

function defaultLayers(): Record<VerificationCategory, VerificationLayer> {
  return Object.fromEntries(
    VERIFICATION_CATEGORIES.map((category) => [
      category,
      {
        category,
        status: "pending",
        evidence: "",
        exemptionReason: "",
        successCriteria: VERIFICATION_CATEGORY_META[category].defaultCriteria,
        verifier: "",
      } satisfies VerificationLayer,
    ]),
  ) as Record<VerificationCategory, VerificationLayer>;
}

async function appendTaskAudit(input: {
  taskId: string;
  actor: string;
  eventType: string;
  detail: Record<string, unknown>;
}): Promise<void> {
  const db = await getProductionDatabase();
  await db.execute(
    `INSERT INTO audit_events (
       id, project_id, deployment_task_id, actor, event_type,
       entity_type, entity_id, detail_redacted_json
     )
     SELECT $1, t.project_id, t.id, $2, $3,
            'deployment_task', t.id, $4
     FROM deployment_tasks t
     WHERE t.id = $5`,
    [
      makeProductionId("audit"),
      input.actor.trim() || "local-user",
      input.eventType,
      JSON.stringify(input.detail),
      input.taskId,
    ],
  );
}

function mapTask(row: TaskRow): VerificationTask {
  return {
    id: row.id,
    title: row.title,
    projectName: row.project_name,
    assetName: row.asset_name,
    environment: row.environment,
    riskLevel: row.risk_level,
    workflowPhase: row.workflow_phase,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

export async function listVerificationTasks(): Promise<VerificationTask[]> {
  const db = await getProductionDatabase();
  const rows = await db.select<TaskRow[]>(
    `SELECT t.id, t.title, p.name AS project_name, a.name AS asset_name,
            t.environment, t.risk_level, t.workflow_phase, t.status, t.updated_at
     FROM deployment_tasks t
     JOIN projects p ON p.id = t.project_id
     JOIN assets a ON a.id = t.asset_id
     WHERE t.workflow_phase IN ('VERIFY', 'KNOWLEDGE')
        OR t.status IN ('partially_verified', 'verified', 'human_exempt', 'blocked')
        OR EXISTS (
          SELECT 1 FROM manual_execution_evidence e
          WHERE e.deployment_task_id = t.id AND e.exit_code = 0
        )
     ORDER BY
       CASE
         WHEN t.workflow_phase = 'VERIFY' THEN 0
         WHEN t.status = 'blocked' THEN 1
         ELSE 2
       END,
       t.updated_at DESC`,
  );
  return rows.map(mapTask);
}

export async function loadVerificationWorkspace(
  taskId: string,
): Promise<VerificationWorkspace> {
  const db = await getProductionDatabase();
  const taskRows = await db.select<TaskRow[]>(
    `SELECT t.id, t.title, p.name AS project_name, a.name AS asset_name,
            t.environment, t.risk_level, t.workflow_phase, t.status, t.updated_at
     FROM deployment_tasks t
     JOIN projects p ON p.id = t.project_id
     JOIN assets a ON a.id = t.asset_id
     WHERE t.id = $1`,
    [taskId],
  );
  const taskRow = taskRows[0];
  if (!taskRow) throw new Error("没有找到待验收任务。");

  const auditRows = await db.select<AuditRow[]>(
    `SELECT event_type, actor, detail_redacted_json, occurred_at
     FROM audit_events
     WHERE deployment_task_id = $1
       AND event_type IN (
         'verification.layer_recorded',
         'verification.closed',
         'verification.returned_for_revision'
       )
     ORDER BY occurred_at DESC, id DESC`,
    [taskId],
  );

  const layers = defaultLayers();
  const seen = new Set<VerificationCategory>();
  let closure: VerificationClosure | undefined;

  for (const row of auditRows) {
    const detail = parseDetail(row.detail_redacted_json);
    if (row.event_type === "verification.layer_recorded") {
      const category = detail.category;
      if (
        VERIFICATION_CATEGORIES.includes(category as VerificationCategory) &&
        !seen.has(category as VerificationCategory)
      ) {
        const typedCategory = category as VerificationCategory;
        layers[typedCategory] = {
          category: typedCategory,
          status: layerStatus(detail.status),
          evidence: typeof detail.evidence === "string" ? detail.evidence : "",
          exemptionReason:
            typeof detail.exemptionReason === "string"
              ? detail.exemptionReason
              : "",
          successCriteria:
            typeof detail.successCriteria === "string" &&
            detail.successCriteria.trim()
              ? detail.successCriteria
              : VERIFICATION_CATEGORY_META[typedCategory].defaultCriteria,
          verifier: row.actor,
          recordedAt: row.occurred_at,
        };
        seen.add(typedCategory);
      }
    } else if (row.event_type === "verification.closed" && !closure) {
      const value = detail.overallStatus;
      const overallStatus: VerificationOverallStatus =
        value === "verified" || value === "human_exempt" || value === "failed"
          ? value
          : "pending";
      closure = {
        overallStatus,
        reviewer: row.actor,
        summary: typeof detail.summary === "string" ? detail.summary : "",
        decidedAt: row.occurred_at,
      };
    } else if (
      row.event_type === "verification.returned_for_revision" &&
      !closure
    ) {
      closure = {
        overallStatus: "failed",
        reviewer: row.actor,
        summary:
          typeof detail.reason === "string"
            ? detail.reason
            : "已退回人工执行阶段。",
        decidedAt: row.occurred_at,
      };
    }
  }

  return { task: mapTask(taskRow), layers, closure };
}

export async function saveVerificationLayer(input: {
  taskId: string;
  category: VerificationCategory;
  status: VerificationLayerStatus;
  evidence: string;
  exemptionReason: string;
  successCriteria: string;
  verifier: string;
}): Promise<void> {
  if (!VERIFICATION_CATEGORIES.includes(input.category)) {
    throw new Error("未知验收类别。");
  }
  if (input.verifier.trim().length < 2) {
    throw new Error("请填写验证人员。");
  }
  if (input.successCriteria.trim().length < 6) {
    throw new Error("请填写明确的成功标准。");
  }
  if (input.status !== "pending" && input.evidence.trim().length < 10) {
    throw new Error("验证证据至少需要 10 个字符。");
  }
  if (
    input.status === "human_exempt" &&
    input.exemptionReason.trim().length < 10
  ) {
    throw new Error("人工豁免必须填写至少 10 个字符的原因和责任说明。");
  }

  const evidence = redactSensitiveText(input.evidence).text;
  const exemptionReason = redactSensitiveText(input.exemptionReason).text;
  const successCriteria = redactSensitiveText(input.successCriteria).text;

  await appendTaskAudit({
    taskId: input.taskId,
    actor: input.verifier,
    eventType: "verification.layer_recorded",
    detail: {
      category: input.category,
      status: input.status,
      evidence: clipProductionText(evidence, 20_000),
      exemptionReason: clipProductionText(exemptionReason, 4_000),
      successCriteria: clipProductionText(successCriteria, 4_000),
      humanOnly: true,
    },
  });

  const db = await getProductionDatabase();
  await db.execute(
    `UPDATE deployment_tasks
     SET workflow_phase = 'VERIFY',
         status = CASE WHEN $1 = 'failed' THEN 'blocked' ELSE 'partially_verified' END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
       AND status NOT IN ('verified', 'human_exempt', 'archived')`,
    [input.status, input.taskId],
  );
}

export async function closeVerificationTask(input: {
  taskId: string;
  reviewer: string;
  summary: string;
}): Promise<VerificationOverallStatus> {
  if (input.reviewer.trim().length < 2) {
    throw new Error("请填写关单审核人员。");
  }
  if (input.summary.trim().length < 10) {
    throw new Error("关单结论至少需要 10 个字符。");
  }

  const workspace = await loadVerificationWorkspace(input.taskId);
  const gate = evaluateVerificationGate(workspace.layers);
  if (!gate.canClose) {
    throw new Error(
      `四层验收尚未满足关单条件：${gate.issues.join("；") || "存在失败项。"}`,
    );
  }

  const summary = redactSensitiveText(input.summary).text;
  const db = await getProductionDatabase();
  await db.execute("BEGIN IMMEDIATE");
  try {
    await db.execute(
      `UPDATE deployment_tasks
       SET workflow_phase = 'KNOWLEDGE',
           status = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [gate.overallStatus, input.taskId],
    );
    await db.execute(
      `INSERT INTO audit_events (
         id, project_id, deployment_task_id, actor, event_type,
         entity_type, entity_id, detail_redacted_json
       )
       SELECT $1, t.project_id, t.id, $2, 'verification.closed',
              'deployment_task', t.id, $3
       FROM deployment_tasks t
       WHERE t.id = $4`,
      [
        makeProductionId("audit"),
        input.reviewer.trim(),
        JSON.stringify({
          overallStatus: gate.overallStatus,
          summary: clipProductionText(summary, 8_000),
          layerStatuses: Object.fromEntries(
            VERIFICATION_CATEGORIES.map((category) => [
              category,
              workspace.layers[category].status,
            ]),
          ),
          humanOnly: true,
        }),
        input.taskId,
      ],
    );
    await db.execute("COMMIT");
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }

  return gate.overallStatus;
}

export async function returnVerificationToManualExecution(input: {
  taskId: string;
  reviewer: string;
  reason: string;
}): Promise<void> {
  if (input.reviewer.trim().length < 2) {
    throw new Error("请填写退回人员。");
  }
  if (input.reason.trim().length < 10) {
    throw new Error("退回原因至少需要 10 个字符。");
  }

  const reason = redactSensitiveText(input.reason).text;
  const db = await getProductionDatabase();
  await db.execute("BEGIN IMMEDIATE");
  try {
    await db.execute(
      `UPDATE deployment_tasks
       SET workflow_phase = 'MANUAL_EXECUTE',
           status = 'blocked',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [input.taskId],
    );
    await db.execute(
      `INSERT INTO audit_events (
         id, project_id, deployment_task_id, actor, event_type,
         entity_type, entity_id, detail_redacted_json
       )
       SELECT $1, t.project_id, t.id, $2, 'verification.returned_for_revision',
              'deployment_task', t.id, $3
       FROM deployment_tasks t
       WHERE t.id = $4`,
      [
        makeProductionId("audit"),
        input.reviewer.trim(),
        JSON.stringify({
          reason: clipProductionText(reason, 8_000),
          nextPhase: "MANUAL_EXECUTE",
          humanOnly: true,
        }),
        input.taskId,
      ],
    );
    await db.execute("COMMIT");
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }
}

export function buildVerificationMarkdown(
  workspace: VerificationWorkspace,
): string {
  const gate = evaluateVerificationGate(workspace.layers);
  const lines = [
    `# ${workspace.task.title}——四层验收记录`,
    "",
    "> 本记录来自现场工程师人工回填的脱敏证据。Agnovexa OpsDesk 不连接目标服务器或数据库，也不会执行验证命令。",
    "",
    "## 任务信息",
    "",
    `- 任务编号：${workspace.task.id}`,
    `- 项目：${workspace.task.projectName}`,
    `- 目标资产：${workspace.task.assetName}`,
    `- 环境：${workspace.task.environment}`,
    `- 风险等级：${workspace.task.riskLevel}`,
    `- 当前阶段：${workspace.task.workflowPhase}`,
    `- 当前状态：${workspace.task.status}`,
    "",
    "## 四层验收",
    "",
  ];

  VERIFICATION_CATEGORIES.forEach((category, index) => {
    const layer = workspace.layers[category];
    const meta = VERIFICATION_CATEGORY_META[category];
    lines.push(
      `### ${index + 1}. ${meta.label}`,
      "",
      `- 状态：${layer.status}`,
      `- 验证人员：${layer.verifier || "未记录"}`,
      `- 记录时间：${layer.recordedAt || "未记录"}`,
      `- 成功标准：${layer.successCriteria}`,
      `- 豁免原因：${layer.exemptionReason || "无"}`,
      "",
      "```text",
      layer.evidence || "（未填写验证证据）",
      "```",
      "",
    );
  });

  lines.push(
    "## 关单判断",
    "",
    `- 是否满足关单：${gate.canClose ? "是" : "否"}`,
    `- 综合状态：${gate.overallStatus}`,
    `- 阻断项：${gate.issues.length ? gate.issues.join("；") : "无"}`,
    `- 关单审核人：${workspace.closure?.reviewer || "未关单"}`,
    `- 关单时间：${workspace.closure?.decidedAt || "未关单"}`,
    `- 关单结论：${workspace.closure?.summary || "未关单"}`,
    "",
  );

  return `${lines.join("\n")}\n`;
}
