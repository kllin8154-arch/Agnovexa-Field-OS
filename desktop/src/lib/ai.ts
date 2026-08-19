import { invoke } from "@tauri-apps/api/core";
import { redactSensitiveText } from "./redaction";

export type AiProviderKind =
  | "deepseek"
  | "openai"
  | "qwen"
  | "kimi"
  | "zhipu"
  | "siliconflow"
  | "local"
  | "custom";

export type AiTaskMode = "plan" | "diagnose-error" | "sql-review" | "knowledge";

export interface AiProviderProfile {
  id: string;
  kind: AiProviderKind;
  name: string;
  baseUrl: string;
  model: string;
  apiKeyRequired: boolean;
  enabled: boolean;
  note: string;
}

export interface AiChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiChatRequest {
  providerName: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
  messages: AiChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutSeconds?: number;
}

export interface AiChatResponse {
  providerName: string;
  model: string;
  content: string;
  reasoningContent?: string;
  requestId?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface OpsPromptInput {
  mode: AiTaskMode;
  task: string;
  projectContext?: string;
  commandOrSql?: string;
  exitCode?: string;
  executionOutput?: string;
  environment?: string;
  expectedResult?: string;
}

export interface PreparedPrompt {
  prompt: string;
  redactionCount: number;
}

const STORAGE_KEY = "agnovexa.opsdesk.ai.providers.v1";

export const DEFAULT_AI_SYSTEM_PROMPT = `你是 Agnovexa OpsDesk 的现场部署运维 AI 助手。

绝对边界：
1. 你不能连接服务器、数据库、Shell、SSH、SFTP、远程文件系统或进程管理器。
2. 你不能执行命令、SQL、脚本、重启、删除、修改配置或回滚。
3. 你只能根据用户提供且已脱敏的事实，生成供人工审核和人工执行的方案、命令、SQL、验证、回滚和知识草稿。
4. 不得声称“已经执行”“已经修复”“已经验证”，除非用户回填了对应执行证据。
5. 任何命令或 SQL 必须明确标记风险，包含前置检查、成功标准和回滚方案。
6. 对高风险操作必须给出停止条件；对 DELETE、UPDATE、DROP、TRUNCATE、ALTER、rm、磁盘、网络和权限变更必须重点审查。
7. 信息不足时列出缺失事实，不得编造服务器型号、版本、路径、账号、表结构或执行结果。
8. 不在回答中复述密码、Token、私钥、完整连接串或其他秘密。
9. AI 返回的新命令或 SQL 仍然只能交给人工执行，并要求重新回填退出码、stdout、stderr 和验证证据。

默认输出结构：
- 已确认事实
- 缺失信息与冲突
- 根因判断或方案目标
- 风险等级
- 人工执行前检查
- 待人工执行命令或 SQL
- 预期结果与成功标准
- 报错后的下一步排查
- 回滚方案
- 可沉淀知识草稿`;

export const DEFAULT_PROVIDER_PROFILES: AiProviderProfile[] = [
  {
    id: "deepseek",
    kind: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-v4-flash",
    apiKeyRequired: true,
    enabled: true,
    note: "OpenAI Chat Completions 兼容；模型 ID 可按控制台调整。",
  },
  {
    id: "openai",
    kind: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-5",
    apiKeyRequired: true,
    enabled: true,
    note: "使用 Chat Completions 兼容入口；模型 ID 可按账号权限调整。",
  },
  {
    id: "qwen",
    kind: "qwen",
    name: "通义千问 / 阿里云百炼",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen3.7-plus",
    apiKeyRequired: true,
    enabled: true,
    note: "支持替换为业务空间专属 OpenAI 兼容 Base URL。",
  },
  {
    id: "kimi",
    kind: "kimi",
    name: "Kimi / Moonshot",
    baseUrl: "https://api.moonshot.cn/v1",
    model: "",
    apiKeyRequired: true,
    enabled: true,
    note: "请填写控制台当前可用的模型 ID。",
  },
  {
    id: "zhipu",
    kind: "zhipu",
    name: "智谱 GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-5.2",
    apiKeyRequired: true,
    enabled: true,
    note: "通用 OpenAI Chat Completion 兼容入口；专属套餐可改为对应地址。",
  },
  {
    id: "siliconflow",
    kind: "siliconflow",
    name: "硅基流动 SiliconFlow",
    baseUrl: "https://api.siliconflow.cn/v1",
    model: "deepseek-ai/DeepSeek-V3",
    apiKeyRequired: true,
    enabled: true,
    note: "模型 ID 以硅基流动模型广场显示为准。",
  },
  {
    id: "local",
    kind: "local",
    name: "本地 OpenAI 兼容服务",
    baseUrl: "http://127.0.0.1:11434/v1",
    model: "",
    apiKeyRequired: false,
    enabled: true,
    note: "适用于 Ollama、LM Studio、LiteLLM 或其他本机兼容网关。",
  },
  {
    id: "custom",
    kind: "custom",
    name: "自定义 OpenAI 兼容接口",
    baseUrl: "",
    model: "",
    apiKeyRequired: true,
    enabled: true,
    note: "填写 Base URL 和模型 ID；程序会自动追加 /chat/completions。",
  },
];

export function cloneDefaultProviderProfiles(): AiProviderProfile[] {
  return DEFAULT_PROVIDER_PROFILES.map((profile) => ({ ...profile }));
}

export function loadProviderProfiles(): AiProviderProfile[] {
  const defaults = cloneDefaultProviderProfiles();
  if (typeof window === "undefined") return defaults;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as AiProviderProfile[];
    if (!Array.isArray(parsed) || parsed.length === 0) return defaults;

    const byId = new Map(parsed.map((profile) => [profile.id, profile]));
    const merged = defaults.map((profile) => ({
      ...profile,
      ...(byId.get(profile.id) ?? {}),
      id: profile.id,
      kind: profile.kind,
    }));
    for (const profile of parsed) {
      if (!merged.some((item) => item.id === profile.id)) merged.push(profile);
    }
    return merged;
  } catch {
    return defaults;
  }
}

export function saveProviderProfiles(profiles: AiProviderProfile[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

export function resetProviderProfiles(): AiProviderProfile[] {
  const defaults = cloneDefaultProviderProfiles();
  saveProviderProfiles(defaults);
  return defaults;
}

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function normalizeChatEndpoint(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (/\/chat\/completions$/i.test(trimmed)) return trimmed;
  return `${trimmed}/chat/completions`;
}

export function prepareOpsPrompt(input: OpsPromptInput): PreparedPrompt {
  const modeTitle: Record<AiTaskMode, string> = {
    plan: "生成部署或变更计划",
    "diagnose-error": "分析人工执行报错并给出下一步排查",
    "sql-review": "审查 SQL 风险、兼容性和回滚",
    knowledge: "生成待审核知识条目草稿",
  };

  const raw = [
    `任务模式：${modeTitle[input.mode]}`,
    input.projectContext?.trim() ? `已选择项目上下文：\n${input.projectContext.trim()}` : "",
    `用户任务：\n${input.task.trim() || "<未填写>"}`,
    input.environment?.trim() ? `目标环境事实：\n${input.environment.trim()}` : "",
    input.commandOrSql?.trim() ? `人工准备或实际执行的命令/SQL：\n${input.commandOrSql.trim()}` : "",
    input.exitCode?.trim() ? `人工执行退出码：${input.exitCode.trim()}` : "",
    input.executionOutput?.trim() ? `人工回填 stdout/stderr/日志：\n${input.executionOutput.trim()}` : "",
    input.expectedResult?.trim() ? `期望结果：\n${input.expectedResult.trim()}` : "",
    "请严格遵守人工执行边界。先区分已确认事实、推断和待验证项；不要直接输出自动执行结论。",
  ]
    .filter(Boolean)
    .join("\n\n");

  const redacted = redactSensitiveText(raw);
  return { prompt: redacted.text, redactionCount: redacted.total };
}

export async function requestAiCompletion(request: AiChatRequest): Promise<AiChatResponse> {
  if (!isTauriRuntime()) {
    throw new Error("浏览器预览模式不发起 AI 请求。请运行 Windows 桌面版或 npm run tauri:dev。");
  }
  return invoke<AiChatResponse>("chat_completion", { request });
}
