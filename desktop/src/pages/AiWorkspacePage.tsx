import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CodeBlock, Notice, Panel, Tag } from "../components/Ui";
import {
  loadProviderProfiles,
  prepareOpsPrompt,
  requestAiCompletion,
  type AiChatResponse,
  type AiProviderProfile,
  type AiTaskMode,
} from "../lib/ai";
import { OPSDESK_PRODUCTION_AI_PROMPT } from "../lib/aiPolicy";
import {
  getSessionApiKey,
  useSessionApiKeyStatus,
} from "../lib/aiSession";

const PENDING_ERROR_KEY = "agnovexa.opsdesk.pendingErrorContext";
const PREFERRED_PROVIDER_KEY = "agnovexa.opsdesk.ai.preferred-provider.v1";

interface PendingErrorContext {
  task?: string;
  commandOrSql?: string;
  exitCode?: string;
  executionOutput?: string;
  environment?: string;
  expectedResult?: string;
}

const modeOptions: Array<{
  value: AiTaskMode;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  { value: "plan", label: "部署与变更方案", shortLabel: "方案", description: "生成前置检查、人工命令、验证与回滚" },
  { value: "diagnose-error", label: "人工执行报错分析", shortLabel: "排错", description: "基于退出码和完整日志定位根因" },
  { value: "sql-review", label: "SQL 安全审查", shortLabel: "SQL", description: "审查影响范围、事务、兼容性与回滚" },
  { value: "knowledge", label: "知识条目草稿", shortLabel: "知识", description: "把已验证事实整理为待审核知识" },
];

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "AI 请求失败，请检查服务配置和当前网络。";
}

function loadPreferredProvider(profiles: AiProviderProfile[]): string {
  const preferred = window.localStorage.getItem(PREFERRED_PROVIDER_KEY);
  return profiles.some((profile) => profile.id === preferred)
    ? preferred ?? profiles[0]?.id ?? ""
    : profiles[0]?.id ?? "";
}

export function AiWorkspacePage() {
  const profiles = useMemo(
    () => loadProviderProfiles().filter((profile) => profile.enabled),
    [],
  );
  const [selectedId, setSelectedId] = useState(() => loadPreferredProvider(profiles));
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
  const hasSessionKey = useSessionApiKeyStatus(selectedProfile?.id ?? "");

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
      setTask(context.task ?? "分析人工执行失败原因，并给出下一步排查、修复、验证和回滚建议");
      setCommandOrSql(context.commandOrSql ?? "");
      setExitCode(context.exitCode ?? "");
      setExecutionOutput(context.executionOutput ?? "");
      setEnvironment(context.environment ?? "");
      setExpectedResult(context.expectedResult ?? "");
      setStatusMessage("已载入变更中心回传的失败证据，发送前会重新脱敏并要求人工预览。");
    } catch {
      setStatusMessage("未能读取变更中心的报错上下文，请手工粘贴完整证据。");
    } finally {
      window.sessionStorage.removeItem(PENDING_ERROR_KEY);
    }
  }, []);

  useEffect(() => {
    setConfirmedPreview(false);
  }, [prepared.prompt, selectedId]);

  useEffect(() => {
    if (selectedProfile) {
      window.localStorage.setItem(PREFERRED_PROVIDER_KEY, selectedProfile.id);
    }
  }, [selectedProfile]);

  if (!selectedProfile) {
    return (
      <div className="page-stack">
        <Notice tone="warning" title="没有启用的 AI 服务">
          请先在 AI 服务配置页启用至少一个 Provider，并填写模型与接口地址。
        </Notice>
        <Link className="primary-button" to="/ai-settings">打开 AI 服务配置</Link>
      </div>
    );
  }

  const submit = async () => {
    setRequestError("");
    setStatusMessage("");
    setResponse(null);

    if (!selectedProfile.baseUrl.trim()) return setRequestError("当前 Provider 尚未配置 Base URL。");
    if (!selectedProfile.model.trim()) return setRequestError("当前 Provider 尚未配置模型 ID。");
    if (selectedProfile.apiKeyRequired && !hasSessionKey) {
      return setRequestError("当前 Provider 的会话 API Key 尚未载入，请前往 AI 服务配置。");
    }
    if (task.trim().length < 4) return setRequestError("请填写需要分析的任务、问题或报错。");
    if (!confirmedPreview) return setRequestError("请先核对脱敏后的实际发送文本并完成人工确认。");

    const parsedTemperature = temperature.trim() === "" ? undefined : Number(temperature);
    const parsedMaxTokens = maxTokens.trim() === "" ? undefined : Number(maxTokens);
    if (parsedTemperature !== undefined && (!Number.isFinite(parsedTemperature) || parsedTemperature < 0 || parsedTemperature > 2)) {
      return setRequestError("温度必须为 0 到 2 之间的数字，或留空使用服务默认值。");
    }
    if (parsedMaxTokens !== undefined && (!Number.isInteger(parsedMaxTokens) || parsedMaxTokens < 1 || parsedMaxTokens > 131072)) {
      return setRequestError("最大输出 Token 必须为 1 到 131072 之间的整数。");
    }

    setLoading(true);
    try {
      const result = await requestAiCompletion({
        providerName: selectedProfile.name,
        baseUrl: selectedProfile.baseUrl,
        apiKey: getSessionApiKey(selectedProfile.id) || undefined,
        model: selectedProfile.model,
        messages: [
          { role: "system", content: OPSDESK_PRODUCTION_AI_PROMPT },
          { role: "user", content: prepared.prompt },
        ],
        temperature: parsedTemperature,
        maxTokens: parsedMaxTokens,
        timeoutSeconds: 180,
      });
      setResponse(result);
      setStatusMessage("AI 已返回待审核草案。任何命令和 SQL 仍需人工检查、人工执行并回填证据。");
    } catch (error) {
      setRequestError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const activeMode = modeOptions.find((option) => option.value === mode) ?? modeOptions[0];

  return (
    <div className="page-stack ai-workbench">
      <div className="ai-context-bar">
        <div className="ai-provider-summary">
          <span className={`ai-provider-dot${selectedProfile.enabled ? " online" : ""}`} />
          <div>
            <small>当前 AI 服务</small>
            <strong>{selectedProfile.name}</strong>
            <span>{selectedProfile.model || "模型未配置"}</span>
          </div>
        </div>

        <div className="ai-context-controls">
          <label>
            <span>切换服务</span>
            <select
              className="select-input"
              value={selectedProfile.id}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>{profile.name}</option>
              ))}
            </select>
          </label>
          <div className={`connection-pill${selectedProfile.apiKeyRequired && !hasSessionKey ? " warning" : ""}`}>
            {selectedProfile.apiKeyRequired
              ? hasSessionKey ? "会话密钥已载入" : "缺少会话密钥"
              : "无需 API Key"}
          </div>
          <Link className="secondary-button" to="/ai-settings">配置 AI 服务</Link>
        </div>
      </div>

      <Notice tone="warning" title="AI 只生成文字草案，不具有执行权限">
        应用没有 SSH、Shell、SFTP、生产数据库连接、进程启动或远程文件写入工具。命令、SQL、配置 Diff、验证与回滚只能复制后由现场工程师人工执行。
      </Notice>

      <div className="ai-workspace-grid">
        <aside className="ai-mode-rail" aria-label="AI 任务模式">
          <div className="ai-mode-rail-title">任务模式</div>
          {modeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`ai-mode-item${mode === option.value ? " active" : ""}`}
              onClick={() => setMode(option.value)}
            >
              <span>{option.shortLabel}</span>
              <div><strong>{option.label}</strong><small>{option.description}</small></div>
            </button>
          ))}
          <div className="ai-mode-help">
            <strong>发送前检查</strong>
            <span>系统自动脱敏，仍需人工核对实际发送文本。</span>
          </div>
        </aside>

        <section className="ai-composer-card">
          <header className="ai-composer-header">
            <div>
              <span className="eyebrow">{activeMode.value.toUpperCase()}</span>
              <h2>{activeMode.label}</h2>
              <p>{activeMode.description}</p>
            </div>
            <Tag>{prepared.redactionCount} 处脱敏</Tag>
          </header>

          <div className="ai-form-grid redesigned">
            <label className="wide-field">
              <span>任务或问题</span>
              <textarea
                className="evidence-input task-input"
                value={task}
                onChange={(event) => setTask(event.target.value)}
                placeholder="描述要完成的目标、当前现象或需要审查的内容。不要填写密码、Token、私钥或客户敏感信息。"
              />
            </label>
            <label>
              <span>目标环境事实</span>
              <textarea
                className="evidence-input medium"
                value={environment}
                onChange={(event) => setEnvironment(event.target.value)}
                placeholder="OS、架构、软件版本、目录、网络条件和已确认依赖。"
              />
            </label>
            <label>
              <span>成功标准</span>
              <textarea
                className="evidence-input medium"
                value={expectedResult}
                onChange={(event) => setExpectedResult(event.target.value)}
                placeholder="服务状态、端口、接口返回、日志和业务验收标准。"
              />
            </label>
            <label className="wide-field">
              <span>命令 / SQL / 配置 Diff</span>
              <textarea
                className="evidence-input command-input"
                value={commandOrSql}
                onChange={(event) => setCommandOrSql(event.target.value)}
                placeholder="粘贴待审查内容，或人工实际执行过的命令和 SQL。"
              />
            </label>
            <label>
              <span>人工执行退出码</span>
              <input
                className="text-input"
                value={exitCode}
                onChange={(event) => setExitCode(event.target.value)}
                placeholder="例如 0、1、127"
              />
            </label>
            <label className="wide-field">
              <span>stdout / stderr / 相关日志</span>
              <textarea
                className="evidence-input output-input"
                value={executionOutput}
                onChange={(event) => setExecutionOutput(event.target.value)}
                placeholder="粘贴完整输出和上下文，不要只填写“失败了”。"
              />
            </label>
          </div>

          <details className="prompt-preview" open={prepared.redactionCount > 0}>
            <summary>
              <span>实际发送文本预览</span>
              <strong>{prepared.redactionCount} 处敏感内容已处理</strong>
            </summary>
            <pre>{prepared.prompt}</pre>
          </details>

          <label className="approval-check ai-approval-check">
            <input
              type="checkbox"
              checked={confirmedPreview}
              onChange={(event) => setConfirmedPreview(event.target.checked)}
            />
            <span>我已人工检查实际发送文本，确认不含不应发送的项目、客户或生产敏感信息。</span>
          </label>

          {requestError && <Notice tone="danger" title="无法发起 AI 请求">{requestError}</Notice>}
          {statusMessage && <Notice tone="success" title="当前状态">{statusMessage}</Notice>}

          <footer className="ai-composer-footer">
            <span>请求只发送到当前选中的 Provider；应用不会在后台自动调用模型。</span>
            <button
              className="primary-button ai-submit-button"
              type="button"
              disabled={loading}
              onClick={() => void submit()}
            >
              {loading ? "正在生成草案…" : "生成待人工审核草案"}
            </button>
          </footer>
        </section>

        <aside className="ai-side-panel">
          <Panel eyebrow="REQUEST OPTIONS" title="请求参数">
            <div className="stacked-fields">
              <label><span>温度</span><input className="text-input" value={temperature} onChange={(event) => setTemperature(event.target.value)} placeholder="留空使用默认值" /></label>
              <label><span>最大输出 Token</span><input className="text-input" value={maxTokens} onChange={(event) => setMaxTokens(event.target.value)} placeholder="留空使用默认值" /></label>
            </div>
          </Panel>

          <Panel eyebrow="SAFETY CHECK" title="发送检查">
            <div className="safety-check-list">
              <div className={task.trim().length >= 4 ? "done" : ""}><span>1</span><p>任务描述完整</p></div>
              <div className={prepared.redactionCount >= 0 ? "done" : ""}><span>2</span><p>敏感信息扫描完成</p></div>
              <div className={confirmedPreview ? "done" : ""}><span>3</span><p>人工预览确认</p></div>
              <div className={!selectedProfile.apiKeyRequired || hasSessionKey ? "done" : ""}><span>4</span><p>Provider 凭据就绪</p></div>
            </div>
          </Panel>

          <Panel eyebrow="KNOWLEDGE POLICY" title="知识来源优先级">
            <ol className="source-priority-list">
              <li>已验证 Skill</li>
              <li>项目私有知识</li>
              <li>内部通用知识</li>
              <li>已审核公开资料</li>
              <li>外部待验证建议</li>
            </ol>
          </Panel>
        </aside>
      </div>

      {response && (
        <section className="ai-response-card">
          <header>
            <div>
              <span className="eyebrow">AI DRAFT</span>
              <h2>待人工审核结果</h2>
              <p>{response.providerName} · {response.model}</p>
            </div>
            <div className="inline-actions">
              {response.totalTokens !== undefined && <Tag>{response.totalTokens} tokens</Tag>}
              {response.requestId && <Tag>{response.requestId}</Tag>}
            </div>
          </header>
          <Notice tone="info" title="这是建议，不是执行结果">
            请逐项核对版本、路径、参数、影响范围、验证和回滚；执行完成后必须回填退出码和完整证据。
          </Notice>
          {response.reasoningContent && (
            <details className="prompt-preview">
              <summary><span>Provider reasoning_content</span><strong>仅供审阅</strong></summary>
              <pre>{response.reasoningContent}</pre>
            </details>
          )}
          <CodeBlock value={response.content} label="AI 草案 · 可复制到人工工单" />
        </section>
      )}
    </div>
  );
}
