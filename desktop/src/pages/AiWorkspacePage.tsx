import { useEffect, useMemo, useState } from "react";
import { CodeBlock, Notice, Panel, Tag } from "../components/Ui";
import {
  DEFAULT_AI_SYSTEM_PROMPT,
  loadProviderProfiles,
  normalizeChatEndpoint,
  prepareOpsPrompt,
  requestAiCompletion,
  resetProviderProfiles,
  saveProviderProfiles,
  type AiChatResponse,
  type AiProviderProfile,
  type AiTaskMode,
} from "../lib/ai";

const PENDING_ERROR_KEY = "agnovexa.opsdesk.pendingErrorContext";

interface PendingErrorContext {
  task?: string;
  commandOrSql?: string;
  exitCode?: string;
  executionOutput?: string;
  environment?: string;
  expectedResult?: string;
}

const modeOptions: Array<{ value: AiTaskMode; label: string; description: string }> = [
  { value: "plan", label: "方案", description: "生成前置检查、命令/SQL、验证和回滚" },
  { value: "diagnose-error", label: "报错", description: "分析人工执行返回的 stdout/stderr" },
  { value: "sql-review", label: "SQL 审查", description: "审查风险、兼容性、事务与回滚" },
  { value: "knowledge", label: "知识草稿", description: "把已验证事实整理为待审核知识" },
];

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "AI 请求失败，请检查接口地址、模型、密钥和网络。";
}

export function AiWorkspacePage() {
  const initialProfiles = useMemo(() => loadProviderProfiles(), []);
  const [profiles, setProfiles] = useState<AiProviderProfile[]>(initialProfiles);
  const [selectedId, setSelectedId] = useState(initialProfiles[0]?.id ?? "deepseek");
  const [sessionKeys, setSessionKeys] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<AiTaskMode>("plan");
  const [task, setTask] = useState("");
  const [environment, setEnvironment] = useState("");
  const [commandOrSql, setCommandOrSql] = useState("");
  const [exitCode, setExitCode] = useState("");
  const [executionOutput, setExecutionOutput] = useState("");
  const [expectedResult, setExpectedResult] = useState("");
  const [temperature, setTemperature] = useState("");
  const [maxTokens, setMaxTokens] = useState("");
  const [confirmedPreview, setConfirmedPreview] = useState(false);
  const [response, setResponse] = useState<AiChatResponse | null>(null);
  const [requestError, setRequestError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedId) ?? profiles[0],
    [profiles, selectedId],
  );

  const prepared = useMemo(
    () => prepareOpsPrompt({ mode, task, environment, commandOrSql, exitCode, executionOutput, expectedResult }),
    [mode, task, environment, commandOrSql, exitCode, executionOutput, expectedResult],
  );

  useEffect(() => {
    const raw = window.sessionStorage.getItem(PENDING_ERROR_KEY);
    if (!raw) return;
    try {
      const context = JSON.parse(raw) as PendingErrorContext;
      setMode("diagnose-error");
      setTask(context.task ?? "分析人工执行失败原因，并给出下一步排查与修复建议");
      setCommandOrSql(context.commandOrSql ?? "");
      setExitCode(context.exitCode ?? "");
      setExecutionOutput(context.executionOutput ?? "");
      setEnvironment(context.environment ?? "");
      setExpectedResult(context.expectedResult ?? "");
      setStatusMessage("已载入变更中心回传的人工执行报错；发送前会再次脱敏。");
    } catch {
      setStatusMessage("未能读取变更中心的报错上下文，请手工粘贴。");
    } finally {
      window.sessionStorage.removeItem(PENDING_ERROR_KEY);
    }
  }, []);

  useEffect(() => setConfirmedPreview(false), [prepared.prompt, selectedId]);

  if (!selectedProfile) {
    return <Notice tone="danger" title="没有可用 AI Provider">请恢复默认 Provider 配置。</Notice>;
  }

  const updateProfile = <K extends keyof AiProviderProfile>(field: K, value: AiProviderProfile[K]) => {
    setProfiles((current) => current.map((profile) =>
      profile.id === selectedProfile.id ? { ...profile, [field]: value } : profile,
    ));
    setStatusMessage("");
  };

  const persistProfiles = () => {
    saveProviderProfiles(profiles);
    setStatusMessage("Provider 元数据已保存在本机。API Key 未保存，只保留在本次运行内存中。");
  };

  const restoreDefaults = () => {
    const defaults = resetProviderProfiles();
    setProfiles(defaults);
    setSelectedId(defaults[0]?.id ?? "deepseek");
    setSessionKeys({});
    setStatusMessage("已恢复默认 Provider 模板；所有会话密钥已清空。");
  };

  const submit = async (connectionTest = false) => {
    setRequestError("");
    setStatusMessage("");
    setResponse(null);

    const baseUrl = selectedProfile.baseUrl.trim();
    const model = selectedProfile.model.trim();
    const apiKey = sessionKeys[selectedProfile.id]?.trim() ?? "";

    if (!selectedProfile.enabled) return setRequestError("当前 Provider 已停用，请先启用或切换接口。");
    if (!baseUrl) return setRequestError("请填写 Base URL。");
    if (!model) return setRequestError("请填写模型 ID。模型名称以对应服务商控制台为准。");
    if (selectedProfile.apiKeyRequired && !apiKey) {
      return setRequestError("当前 Provider 需要 API Key。密钥只在本次运行内存中使用，不会落盘。");
    }
    if (!connectionTest && task.trim().length < 4) return setRequestError("请先填写要分析的任务或报错。");
    if (!connectionTest && !confirmedPreview) {
      return setRequestError("请先核对脱敏后的实际发送文本，并勾选人工确认。");
    }

    const parsedTemperature = temperature.trim() === "" ? undefined : Number(temperature);
    const parsedMaxTokens = maxTokens.trim() === "" ? undefined : Number(maxTokens);
    if (parsedTemperature !== undefined && (!Number.isFinite(parsedTemperature) || parsedTemperature < 0 || parsedTemperature > 2)) {
      return setRequestError("温度必须为 0 到 2 之间的数字，或留空使用 Provider 默认值。");
    }
    if (parsedMaxTokens !== undefined && (!Number.isInteger(parsedMaxTokens) || parsedMaxTokens < 1 || parsedMaxTokens > 131072)) {
      return setRequestError("最大输出 Token 必须为 1 到 131072 之间的整数。");
    }

    setLoading(true);
    try {
      const result = await requestAiCompletion({
        providerName: selectedProfile.name,
        baseUrl,
        apiKey: apiKey || undefined,
        model,
        messages: [
          { role: "system", content: DEFAULT_AI_SYSTEM_PROMPT },
          {
            role: "user",
            content: connectionTest
              ? "这是连接测试。不要调用工具，不要生成命令，只回复：连接成功。"
              : prepared.prompt,
          },
        ],
        temperature: parsedTemperature,
        maxTokens: connectionTest ? undefined : parsedMaxTokens,
        timeoutSeconds: connectionTest ? 45 : 180,
      });
      setResponse(result);
      setStatusMessage(connectionTest ? "接口连接测试成功。" : "AI 已返回草案；内容仍需人工审核和人工执行。");
    } catch (error) {
      setRequestError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-stack">
      <Notice tone="warning" title="AI 不拥有执行能力">
        AI 仅接收经过脱敏的文字上下文并返回草案。应用没有 SSH、Shell、数据库执行、进程启动或远程写入工具；命令和 SQL 必须由现场工程师人工执行，再将退出码与完整报错回填。
      </Notice>

      <div className="ai-layout">
        <Panel eyebrow="PROVIDER REGISTRY" title="多 AI 接口">
          <div className="provider-list">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                className={`provider-item${profile.id === selectedProfile.id ? " active" : ""}`}
                onClick={() => setSelectedId(profile.id)}
              >
                <span className="provider-avatar">{profile.name.slice(0, 2).toUpperCase()}</span>
                <span><strong>{profile.name}</strong><small>{profile.model || "待填写模型 ID"}</small></span>
                <Tag>{profile.enabled ? (profile.apiKeyRequired ? "API Key" : "可无密钥") : "已停用"}</Tag>
              </button>
            ))}
          </div>
        </Panel>

        <Panel eyebrow="OPENAI-COMPATIBLE PROFILE" title={selectedProfile.name} actions={<Tag>Chat Completions</Tag>}>
          <div className="ai-config-grid">
            <label><span>显示名称</span><input className="text-input" value={selectedProfile.name} onChange={(e) => updateProfile("name", e.target.value)} /></label>
            <label className="wide-field">
              <span>Base URL</span>
              <input className="text-input" value={selectedProfile.baseUrl} onChange={(e) => updateProfile("baseUrl", e.target.value)} placeholder="例如：https://api.example.com/v1" />
              <small>实际请求：{normalizeChatEndpoint(selectedProfile.baseUrl) || "待填写"}</small>
            </label>
            <label><span>模型 ID</span><input className="text-input" value={selectedProfile.model} onChange={(e) => updateProfile("model", e.target.value)} placeholder="以服务商控制台为准" /></label>
            <label>
              <span>API Key（仅本次运行）</span>
              <input className="text-input" type="password" autoComplete="off" value={sessionKeys[selectedProfile.id] ?? ""} onChange={(e) => setSessionKeys((current) => ({ ...current, [selectedProfile.id]: e.target.value }))} placeholder={selectedProfile.apiKeyRequired ? "不会写入 SQLite / localStorage" : "可留空"} />
            </label>
            <label><span>温度</span><input className="text-input" value={temperature} onChange={(e) => setTemperature(e.target.value)} placeholder="留空使用默认值" /></label>
            <label><span>最大输出 Token</span><input className="text-input" value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)} placeholder="留空使用默认值" /></label>
            <label className="approval-check"><input type="checkbox" checked={selectedProfile.enabled} onChange={(e) => updateProfile("enabled", e.target.checked)} /><span>启用当前 Provider</span></label>
          </div>
          <p className="provider-note">{selectedProfile.note}</p>
          <div className="inline-actions end">
            <button className="secondary-button" type="button" onClick={restoreDefaults}>恢复默认模板</button>
            <button className="secondary-button" type="button" disabled={loading} onClick={() => void submit(true)}>{loading ? "请求中…" : "测试接口"}</button>
            <button className="primary-button" type="button" onClick={persistProfiles}>保存 Provider 元数据</button>
          </div>
        </Panel>
      </div>

      <Panel eyebrow="HUMAN-IN-THE-LOOP" title="任务、命令/SQL与人工报错回传">
        <div className="mode-switcher">
          {modeOptions.map((option) => (
            <button key={option.value} type="button" className={`mode-card${mode === option.value ? " active" : ""}`} onClick={() => setMode(option.value)}>
              <strong>{option.label}</strong><span>{option.description}</span>
            </button>
          ))}
        </div>

        <div className="ai-form-grid">
          <label className="wide-field"><span>任务或问题</span><textarea className="evidence-input small" value={task} onChange={(e) => setTask(e.target.value)} placeholder="例如：Kylin V10 离线安装 PostgreSQL 16，生成完整人工执行方案；或分析下方报错。" /></label>
          <label><span>目标环境事实</span><textarea className="evidence-input small" value={environment} onChange={(e) => setEnvironment(e.target.value)} placeholder="OS、架构、软件版本、目录、已确认依赖；不要填写密码或 Token。" /></label>
          <label><span>期望结果 / 成功标准</span><textarea className="evidence-input small" value={expectedResult} onChange={(e) => setExpectedResult(e.target.value)} placeholder="例如：服务开机自启、端口监听、接口返回 200。" /></label>
          <label className="wide-field"><span>待审查或实际人工执行的命令 / SQL</span><textarea className="evidence-input" value={commandOrSql} onChange={(e) => setCommandOrSql(e.target.value)} placeholder="粘贴命令、SQL、配置 Diff。AI 只能分析文本，不会执行。" /></label>
          <label><span>退出码</span><input className="text-input" value={exitCode} onChange={(e) => setExitCode(e.target.value)} placeholder="例如：0、1、127" /></label>
          <label className="wide-field"><span>人工回填 stdout / stderr / 日志</span><textarea className="evidence-input" value={executionOutput} onChange={(e) => setExecutionOutput(e.target.value)} placeholder="完整粘贴报错与相关上下文；发送前会自动脱敏。" /></label>
        </div>

        <details className="reasoning-box" open={prepared.redactionCount > 0}>
          <summary>查看实际发送给 Provider 的脱敏文本（检测 {prepared.redactionCount} 处）</summary>
          <pre>{prepared.prompt}</pre>
        </details>
        <label className="approval-check">
          <input type="checkbox" checked={confirmedPreview} onChange={(e) => setConfirmedPreview(e.target.checked)} />
          <span>我已人工检查实际发送文本，不含客户名、项目名、内部路径或其他不应发送的信息。</span>
        </label>

        {requestError && <Notice tone="danger" title="AI 请求失败">{requestError}</Notice>}
        {statusMessage && <Notice tone="success" title="当前状态">{statusMessage}</Notice>}
        <div className="inline-actions end"><button className="primary-button" type="button" disabled={loading} onClick={() => void submit(false)}>{loading ? "正在请求 AI…" : "生成待人工审核草案"}</button></div>
      </Panel>

      {response && (
        <Panel eyebrow={`${response.providerName} / ${response.model}`} title="AI 返回结果" actions={<div className="inline-actions">{response.totalTokens !== undefined && <Tag>{response.totalTokens} tokens</Tag>}{response.requestId && <Tag>{response.requestId}</Tag>}</div>}>
          <Notice tone="info" title="这是草案，不是执行结果">请人工核对命令、SQL、路径、版本、影响范围、验证和回滚。执行完成后把退出码与输出回填到变更中心或本页继续排错。</Notice>
          {response.reasoningContent && <details className="reasoning-box"><summary>查看 Provider 返回的 reasoning_content</summary><pre>{response.reasoningContent}</pre></details>}
          <CodeBlock value={response.content} label="AI 草案 · 可复制到人工工单" />
        </Panel>
      )}
    </div>
  );
}
