import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { withWorkspace } from "./workspace.js";

const VERSION = "0.4.0";
const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

function result(data: unknown) {
  const structuredContent = data && typeof data === "object" && !Array.isArray(data)
    ? data as Record<string, unknown>
    : { items: data };
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent,
  };
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "MCP 工具调用失败。";
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

function call<T>(databasePath: string | undefined, action: Parameters<typeof withWorkspace<T>>[1]) {
  try {
    return result(withWorkspace(databasePath, action));
  } catch (error) {
    return failure(error);
  }
}

export function createAgnovexaMcpServer(databasePath = process.env.AGNOVEXA_OPSDESK_DB): McpServer {
  const server = new McpServer({ name: "agnovexa-opsdesk", version: VERSION });

  server.registerTool("workspace_overview", {
    title: "查看 OpsDesk 工作区概况",
    description: "读取本地工作区健康度、数量统计、安全边界及无法继续的任务数量。只读。",
    annotations: readOnlyAnnotations,
  }, async () => call(databasePath, (reader) => reader.workspaceOverview()));

  server.registerTool("list_projects", {
    title: "列出项目",
    description: "按名称或编号检索项目，并返回技术栈、环境摘要、服务器和任务数量。只读。",
    inputSchema: z.object({
      query: z.string().max(120).optional().describe("项目名称或编号关键词"),
      limit: z.number().int().min(1).max(100).optional(),
    }),
    annotations: readOnlyAnnotations,
  }, async (input) => call(databasePath, (reader) => reader.listProjects(input)));

  server.registerTool("get_project_context", {
    title: "读取项目完整上下文",
    description: "读取一个项目的技术栈、服务器摘要、任务、已核验知识和流程诊断；地址会自动遮罩。只读。",
    inputSchema: z.object({ projectId: z.string().min(1).max(200) }),
    annotations: readOnlyAnnotations,
  }, async ({ projectId }) => call(databasePath, (reader) => reader.getProjectContext(projectId)));

  server.registerTool("list_assets", {
    title: "列出服务器资产",
    description: "查看服务器系统、架构、环境和快照状态；主机地址会自动遮罩。只读。",
    inputSchema: z.object({
      projectId: z.string().max(200).optional(),
      environment: z.enum(["development", "test", "staging", "production", "demo"]).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    }),
    annotations: readOnlyAnnotations,
  }, async (input) => call(databasePath, (reader) => reader.listAssets(input)));

  server.registerTool("list_tasks", {
    title: "列出部署与变更任务",
    description: "查看任务阶段、状态以及计划、步骤、审阅和证据数量。只读。",
    inputSchema: z.object({
      projectId: z.string().max(200).optional(),
      status: z.enum(["draft", "in_progress", "blocked", "partially_verified", "verified", "failed", "human_exempt", "archived"]).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    }),
    annotations: readOnlyAnnotations,
  }, async (input) => call(databasePath, (reader) => reader.listTasks(input)));

  server.registerTool("get_task_details", {
    title: "读取任务调试详情",
    description: "读取任务、计划、步骤、审阅、执行证据和下一步诊断，敏感文本自动遮罩。只读。",
    inputSchema: z.object({ taskId: z.string().min(1).max(200) }),
    annotations: readOnlyAnnotations,
  }, async ({ taskId }) => call(databasePath, (reader) => reader.getTaskDetails(taskId)));

  server.registerTool("diagnose_workflow", {
    title: "诊断流程为什么走不通",
    description: "检查任务是否缺少计划、步骤、人工审阅或执行证据，并给出明确下一步。只读。",
    inputSchema: z.object({ projectId: z.string().max(200).optional() }),
    annotations: readOnlyAnnotations,
  }, async (input) => call(databasePath, (reader) => reader.diagnoseWorkflow(input)));

  server.registerTool("search_knowledge", {
    title: "检索已保存知识",
    description: "按关键词检索项目知识和已核验经验，返回前会隐藏常见密钥格式。只读。",
    inputSchema: z.object({
      query: z.string().min(2).max(200),
      projectId: z.string().max(200).optional(),
      limit: z.number().int().min(1).max(30).optional(),
    }),
    annotations: readOnlyAnnotations,
  }, async (input) => call(databasePath, (reader) => reader.searchKnowledge(input)));

  server.registerTool("recent_audit_events", {
    title: "查看最近审计记录",
    description: "按项目或任务读取最近的脱敏审计事件。只读。",
    inputSchema: z.object({
      projectId: z.string().max(200).optional(),
      taskId: z.string().max(200).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    }),
    annotations: readOnlyAnnotations,
  }, async (input) => call(databasePath, (reader) => reader.recentAudit(input)));

  server.registerResource(
    "workspace-overview",
    "agnovexa://workspace/overview",
    { title: "Agnovexa OpsDesk 工作区概况", mimeType: "application/json" },
    async (uri) => {
      const data = withWorkspace(databasePath, (reader) => reader.workspaceOverview());
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.registerPrompt("understand_project", {
    title: "了解 OpsDesk 项目",
    description: "先读取项目上下文，再总结系统、架构、技术栈、服务器、任务与风险。",
    argsSchema: z.object({ projectId: z.string().min(1).describe("list_projects 返回的项目 ID") }),
  }, ({ projectId }) => ({
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: `请先调用 get_project_context，projectId=${projectId}。然后用中文说明项目目标、技术栈、服务器环境、当前任务、已知约束和最需要推进的一步。不要猜测缺失信息。`,
      },
    }],
  }));

  server.registerPrompt("debug_workflow", {
    title: "调试 OpsDesk 流程",
    description: "定位任务为何无法从部署继续到执行、验收或归档。",
    argsSchema: z.object({ projectId: z.string().max(200).optional() }),
  }, ({ projectId }) => ({
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: `请调用 diagnose_workflow${projectId ? `，projectId=${projectId}` : ""}。对每个异常任务说明缺少的数据关系、用户可见症状和最小修复建议；不要执行命令或修改数据库。`,
      },
    }],
  }));

  return server;
}
