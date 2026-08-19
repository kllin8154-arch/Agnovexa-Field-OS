export interface DeploymentReportTask {
  id: string;
  title: string;
  taskType: string;
  environment: string;
  workflowPhase: string;
  riskLevel: string;
  status: string;
  projectName: string;
  assetName: string;
  assetHost: string;
  operatingSystem: string;
  architecture: string;
  targetDefinition: string;
  acceptanceCriteria: string[];
  rollbackRequirements: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeploymentReportPlan {
  id: string;
  title: string;
  objective: string;
  riskLevel: string;
  confirmedFacts: string[];
  missingFacts: string[];
  impactScope: string;
  configDiff: string;
  backupPlan: string;
  verificationPlan: string;
  rollbackPlan: string;
}

export interface DeploymentReportStep {
  id: string;
  order: number;
  objective: string;
  riskLevel: string;
  commands: string;
  expectedResult: string;
  validationCommands: string;
  rollbackCommands: string;
}

export interface DeploymentReportApproval {
  reviewer: string;
  decision: string;
  comment: string;
  decidedAt: string;
}

export interface DeploymentReportEvidence {
  executor: string;
  executedAt: string;
  actualCommand: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  relatedLogs: string;
  humanActions: string;
  evidenceStatus: string;
}

export interface DeploymentReportData {
  task: DeploymentReportTask;
  plans: DeploymentReportPlan[];
  steps: DeploymentReportStep[];
  approvals: DeploymentReportApproval[];
  evidence: DeploymentReportEvidence[];
  generatedAt: string;
  generatedBy: string;
}

function block(value: string, language = "text"): string {
  const content = value.trim() || "（未填写）";
  return `\n\`\`\`${language}\n${content}\n\`\`\`\n`;
}

function list(values: string[]): string {
  return values.length > 0 ? values.map((item) => `- ${item}`).join("\n") : "- （无）";
}

function humanDecisionLabel(value: string): string {
  const labels: Record<string, string> = {
    approved_for_manual_execution: "批准人工执行",
    rejected: "拒绝",
    returned_for_revision: "退回修改",
  };
  return labels[value] ?? value;
}

export function buildDeploymentReportMarkdown(data: DeploymentReportData): string {
  const { task } = data;
  const lines: string[] = [
    `# ${task.title}——部署与变更报告`,
    "",
    "> 本报告由 Agnovexa OpsDesk 根据本地台账、人工审批与人工回填证据生成。AI 建议不等于执行结果，目标环境操作均由现场工程师人工完成。",
    "",
    "## 1. 报告信息",
    "",
    `- 报告生成时间：${data.generatedAt}`,
    `- 报告生成人：${data.generatedBy}`,
    `- 任务编号：${task.id}`,
    `- 项目：${task.projectName}`,
    `- 目标资产：${task.assetName}`,
    `- 资产标识/地址：${task.assetHost}`,
    `- 操作系统：${task.operatingSystem || "未记录"}`,
    `- 架构：${task.architecture || "未记录"}`,
    `- 环境：${task.environment}`,
    `- 任务类型：${task.taskType}`,
    `- 风险等级：${task.riskLevel}`,
    `- 当前阶段：${task.workflowPhase}`,
    `- 当前状态：${task.status}`,
    `- 创建时间：${task.createdAt}`,
    `- 更新时间：${task.updatedAt}`,
    "",
    "## 2. 目标定义",
    block(task.targetDefinition, "json").trimEnd(),
    "",
    "## 3. 验收标准",
    "",
    list(task.acceptanceCriteria),
    "",
    "## 4. 变更计划",
    "",
  ];

  if (data.plans.length === 0) {
    lines.push("（尚未形成变更计划）", "");
  } else {
    data.plans.forEach((plan, index) => {
      lines.push(
        `### 4.${index + 1} ${plan.title}`,
        "",
        `- 目标：${plan.objective || "未填写"}`,
        `- 风险：${plan.riskLevel}`,
        `- 影响范围：${plan.impactScope || "未填写"}`,
        "",
        "**已确认事实**",
        "",
        list(plan.confirmedFacts),
        "",
        "**缺失信息**",
        "",
        list(plan.missingFacts),
        "",
        "**备份计划**",
        block(plan.backupPlan).trimEnd(),
        "",
        "**配置差异**",
        block(plan.configDiff, "diff").trimEnd(),
        "",
        "**验证计划**",
        block(plan.verificationPlan).trimEnd(),
        "",
        "**回滚计划**",
        block(plan.rollbackPlan).trimEnd(),
        "",
      );
    });
  }

  lines.push("## 5. 人工执行步骤", "");
  if (data.steps.length === 0) {
    lines.push("（尚未形成命令或 SQL 执行包）", "");
  } else {
    data.steps.forEach((step, index) => {
      lines.push(
        `### 5.${index + 1} ${step.objective}`,
        "",
        `- 步骤编号：${step.id}`,
        `- 风险等级：${step.riskLevel}`,
        `- 预期结果：${step.expectedResult || "未填写"}`,
        "",
        "**待人工执行命令 / SQL**",
        block(step.commands, task.taskType === "sql" ? "sql" : "bash").trimEnd(),
        "",
        "**独立验证**",
        block(step.validationCommands).trimEnd(),
        "",
        "**回滚命令 / 说明**",
        block(step.rollbackCommands).trimEnd(),
        "",
      );
    });
  }

  lines.push("## 6. 人工审批记录", "");
  if (data.approvals.length === 0) {
    lines.push("- 尚无审批记录。", "");
  } else {
    data.approvals.forEach((approval) => {
      lines.push(
        `- ${approval.decidedAt}｜${approval.reviewer}｜${humanDecisionLabel(approval.decision)}${approval.comment ? `｜${approval.comment}` : ""}`,
      );
    });
    lines.push("");
  }

  lines.push("## 7. 人工执行证据", "");
  if (data.evidence.length === 0) {
    lines.push("- 尚未回填人工执行证据。", "");
  } else {
    data.evidence.forEach((evidence, index) => {
      lines.push(
        `### 7.${index + 1} ${evidence.executedAt} / ${evidence.executor}`,
        "",
        `- 退出码：${evidence.exitCode ?? "未记录"}`,
        `- 证据状态：${evidence.evidenceStatus}`,
        `- 人工补充操作：${evidence.humanActions || "无"}`,
        "",
        "**实际执行内容（脱敏）**",
        block(evidence.actualCommand, task.taskType === "sql" ? "sql" : "bash").trimEnd(),
        "",
        "**stdout（脱敏）**",
        block(evidence.stdout).trimEnd(),
        "",
        "**stderr（脱敏）**",
        block(evidence.stderr).trimEnd(),
        "",
        "**相关日志（脱敏）**",
        block(evidence.relatedLogs).trimEnd(),
        "",
      );
    });
  }

  lines.push(
    "## 8. 回滚要求",
    "",
    task.rollbackRequirements || "（未填写）",
    "",
    "## 9. 结论与待办",
    "",
    `- 当前任务状态：${task.status}`,
    `- 当前工作流阶段：${task.workflowPhase}`,
    "- 只有文件/包、服务/进程、网络/端口和业务功能均有人工证据通过后，才可认定部署验证通过。",
    "- 外部资料和 AI 草案必须经过现场验证与人工审核后，才可升级为内部已验证知识。",
    "",
  );

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
}

export function deploymentReportFileName(task: DeploymentReportTask): string {
  const safeTitle = task.title.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-").slice(0, 60);
  return `${safeTitle || "Agnovexa-OpsDesk-Report"}-${task.id}.md`;
}
