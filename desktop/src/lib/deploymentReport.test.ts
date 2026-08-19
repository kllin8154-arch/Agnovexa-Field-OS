import { describe, expect, it } from "vitest";
import { buildDeploymentReportMarkdown, type DeploymentReportData } from "./deploymentReport";

const data: DeploymentReportData = {
  task: {
    id: "task-1",
    title: "离线部署 Java 服务",
    taskType: "command",
    environment: "production",
    workflowPhase: "VERIFY",
    riskLevel: "MEDIUM",
    status: "partially_verified",
    projectName: "项目 A",
    assetName: "业务节点",
    assetHost: "asset-001",
    operatingSystem: "Kylin V10",
    architecture: "x86_64",
    targetDefinition: "{\"version\":\"1.0.0\"}",
    acceptanceCriteria: ["服务为 active", "健康检查返回 200"],
    rollbackRequirements: "恢复备份并重启原版本",
    createdAt: "2026-08-19T00:00:00Z",
    updatedAt: "2026-08-19T01:00:00Z",
  },
  plans: [],
  steps: [{
    id: "step-1",
    order: 1,
    objective: "复制并启动服务",
    riskLevel: "MEDIUM",
    commands: "systemctl start company-app",
    expectedResult: "服务启动",
    validationCommands: "systemctl is-active company-app",
    rollbackCommands: "systemctl stop company-app",
  }],
  approvals: [{
    reviewer: "实施负责人",
    decision: "approved_for_manual_execution",
    comment: "已核对",
    decidedAt: "2026-08-19T00:30:00Z",
  }],
  evidence: [{
    executor: "现场工程师",
    executedAt: "2026-08-19T00:45:00Z",
    actualCommand: "systemctl start company-app",
    exitCode: 0,
    stdout: "",
    stderr: "",
    relatedLogs: "active (running)",
    humanActions: "核对日志",
    evidenceStatus: "unverified",
  }],
  generatedAt: "2026-08-19T01:10:00Z",
  generatedBy: "现场工程师",
};

describe("deployment report", () => {
  it("keeps manual execution and verification boundaries visible", () => {
    const markdown = buildDeploymentReportMarkdown(data);
    expect(markdown).toContain("目标环境操作均由现场工程师人工完成");
    expect(markdown).toContain("退出码：0");
    expect(markdown).toContain("健康检查返回 200");
    expect(markdown).toContain("只有文件/包、服务/进程、网络/端口和业务功能均有人工证据通过后");
  });
});
