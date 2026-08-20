import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import { CodeBlock, Notice, Tag } from "../components/Ui";
import {
  loadProviderProfiles,
  prepareOpsPrompt,
  requestAiCompletion,
  type AiChatResponse,
  type AiProviderProfile,
  type AiTaskMode,
} from "../lib/ai";
import { OPSDESK_PRODUCTION_AI_PROMPT } from "../lib/aiPolicy";
import { getSessionApiKey, useSessionApiKeyStatus } from "../lib/aiSession";
import {
  getProjectAiContext,
  isDesktopRuntime,
  listProjects,
  type ProjectAiContext,
  type ProjectRecord,
} from "../lib/repository";

const PENDING_ERROR_KEY = "agnovexa.opsdesk.pendingErrorContext";
const PREFERRED_PROVIDER_KEY = "agnovexa.opsdesk.ai.preferred-provider.v1";
const PREFERRED_PROJECT_KEY = "agnovexa.opsdesk.ai.preferred-project.v1";

interface PendingErrorContext {
  projectId?: string;
  task?: string;
  commandOrSql?: string;
  exitCode?: string;
  executionOutput?: string;
  environment?: string;
  expectedResult?: string;
}

interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  response?: AiChatResponse;
}

const modeOptions: Array<{
  value: AiTaskMode;
  label: string;
  description: string;
  starter: string;
}> = [
  { value: "plan", label: "部署方案", description: "前置检查、人工步骤、验证与回滚", starter: "根据当前项目事实，生成一份可审阅的部署或变更方案。" },
  { value: "diagnose-error", label: "故障排查", description: "结合退出码和完整日志分析根因", starter: "分析这次人工执行失败的原因，并给出下一轮排查步骤。" },
  { value: "sql-review", label: "SQL 审查", description: "检查影响范围、兼容性和回滚", starter: "审查下面 SQL 的风险、兼容性、事务边界和回滚方案。" },
  { value: "knowledge", label: "知识整理", description: "把已验证事实整理为待审核草稿", starter: "把本次已验证结论整理成一条项目知识草稿。" },
];

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "AI 请求失败，请检查服务配置和当前网络。";
}

function makeMessageId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadPreferredProvider(profiles: AiProviderProfile[]): string {
  const preferred = window.localStorage.getItem(PREFERRED_PROVIDER_KEY);
  return profiles.some((profile) => profile.id === preferred)
    ? preferred ?? profiles[0]?.id ?? ""
    : profiles[0]?.id ?? "";
}

function DraftText({ value }: { value: string }) {
  const blocks = value.trim().split(/\n{2,}/).filter(Boolean);
  return (
    <div className="ai-draft-text">
      {blocks.map((block, index) => <p key={`${index}-${block.slice(0, 16)}`}>{block}</p>)}
    </div>
  );
}

export function AiWorkspacePage() {
  const profiles = useMemo(() => loadProviderProfiles().filter((profile) => profile.enabled), []);
  const [selectedId, setSelectedId] = useState(() => loadPreferredProvider(profiles));
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectContext, setProjectContext] = useState<ProjectAiContext | null>(null);
  const [contextLoading, setContextLoading] = useState(isDesktopRuntime());
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
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [requestError, setRequestError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const conversationEndRef = useRef<HTMLDivElement | null>(null);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedId) ?? profiles[0],
    [profiles, selectedId],
  );
  const hasSessionKey = useSessionApiKeyStatus(selectedProfile?.id ?? "");
  const prepared = useMemo(
    () => prepareOpsPrompt({
      mode,
      task,
      projectContext: projectContext?.summary,
      environment,
      commandOrSql,
      exitCode,
      executionOutput,
      expectedResult,
    }),
    [mode, task, projectContext, environment, commandOrSql, exitCode, executionOutput, expectedResult],
  );

  useEffect(() => {
    if (!isDesktopRuntime()) {
      setContextLoading(false);
      return;
    }
    void listProjects()
      .then((nextProjects) => {
        setProjects(nextProjects);
        const preferred = window.localStorage.getItem(PREFERRED_PROJECT_KEY);
        const nextId = nextProjects.some((project) => project.id === preferred)
          ? preferred ?? ""
          : nextProjects[0]?.id ?? "";
        setSelectedProjectId((current) => current || nextId);
      })
      .catch((error) => setRequestError(errorMessage(error)))
      .finally(() => setContextLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedProjectId || !isDesktopRuntime()) {
      setProjectContext(null);
      return;
    }
    setContextLoading(true);
    void getProjectAiContext(selectedProjectId)
      .then(setProjectContext)
      .catch((error) => {
        setProjectContext(null);
        setRequestError(errorMessage(error));
      })
      .finally(() => setContextLoading(false));
    window.localStorage.setItem(PREFERRED_PROJECT_KEY, selectedProjectId);
  }, [selectedProjectId]);

  useEffect(() => {
    const raw = window.sessionStorage.getItem(PENDING_ERROR_KEY);
    if (!raw) return;
    try {
      const context = JSON.parse(raw) as PendingErrorContext;
      setMode("diagnose-error");
      setSelectedProjectId((current) => context.projectId || current);
      setTask(context.task ?? "分析人工执行失败原因，并给出下一步排查、修复、验证和回滚建议");
      setCommandOrSql(context.commandOrSql ?? "");
      setExitCode(context.exitCode ?? "");
      setExecutionOutput(context.executionOutput ?? "");
      setEnvironment(context.environment ?? "");
      setExpectedResult(context.expectedResult ?? "");
      setStatusMessage("已载入变更中心回传的失败证据；项目事实将自动补充，发送前仍会脱敏。");
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
    if (selectedProfile) window.localStorage.setItem(PREFERRED_PROVIDER_KEY, selectedProfile.id);
  }, [selectedProfile]);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, loading]);

  if (!selectedProfile) {
    return (
      <div className="page-stack">
        <Notice tone="warning" title="没有启用的 AI 服务">请先启用至少一个 Provider，并填写模型与接口地址。</Notice>
        <Link className="primary-button" to="/ai-settings">打开 AI 服务配置</Link>
      </div>
    );
  }

  const submit = async () => {
    setRequestError("");
    setStatusMessage("");
    if (!selectedProfile.baseUrl.trim()) return setRequestError("当前 Provider 尚未配置 Base URL。");
    if (!selectedProfile.model.trim()) return setRequestError("当前 Provider 尚未配置模型 ID。");
    if (selectedProfile.apiKeyRequired && !hasSessionKey) return setRequestError("当前 Provider 的会话 API Key 尚未载入，请前往 AI 服务配置。");
    if (isDesktopRuntime() && projects.length > 0 && !selectedProjectId) return setRequestError("请先选择项目，系统才能提供可靠上下文。");
    if (task.trim().length < 4) return setRequestError("请描述需要分析的问题，至少 4 个字符。");
    if (prepared.redactionCount > 0 && !confirmedPreview) return setRequestError("本次内容发现了可能的敏感信息，请先检查脱敏结果。 ");

    const parsedTemperature = temperature.trim() === "" ? undefined : Number(temperature);
    const parsedMaxTokens = maxTokens.trim() === "" ? undefined : Number(maxTokens);
    if (parsedTemperature !== undefined && (!Number.isFinite(parsedTemperature) || parsedTemperature < 0 || parsedTemperature > 2)) return setRequestError("温度必须为 0 到 2 之间的数字。");
    if (parsedMaxTokens !== undefined && (!Number.isInteger(parsedMaxTokens) || parsedMaxTokens < 1 || parsedMaxTokens > 131072)) return setRequestError("最大输出 Token 必须是 1 到 131072 之间的整数。");

    const userMessage: ConversationMessage = { id: makeMessageId(), role: "user", content: task.trim() };
    const previousMessages = messages.slice(-8).map((message) => ({ role: message.role, content: message.content }));
    setMessages((current) => [...current, userMessage]);
    setLoading(true);
    try {
      const result = await requestAiCompletion({
        providerName: selectedProfile.name,
        baseUrl: selectedProfile.baseUrl,
        apiKey: getSessionApiKey(selectedProfile.id) || undefined,
        model: selectedProfile.model,
        messages: [
          { role: "system", content: OPSDESK_PRODUCTION_AI_PROMPT },
          ...previousMessages,
          { role: "user", content: prepared.prompt },
        ],
        temperature: parsedTemperature,
        maxTokens: parsedMaxTokens,
        timeoutSeconds: 180,
      });
      const content = result.content.trim();
      if (!content || /^(null|undefined)+$/i.test(content.replace(/\s+/g, ""))) {
        throw new Error("Provider 返回了空内容，已阻止显示异常结果。请检查模型兼容性或重试。");
      }
      setMessages((current) => [...current, { id: makeMessageId(), role: "assistant", content, response: result }]);
      setTask("");
      setStatusMessage("已生成待审核建议。可以直接继续追问，当前项目上下文会保持不变。");
    } catch (error) {
      setRequestError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void submit();
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setTask("");
    setCommandOrSql("");
    setExitCode("");
    setExecutionOutput("");
    setExpectedResult("");
    setEnvironment("");
    setRequestError("");
    setStatusMessage("");
  };

  const changeProject = (projectId: string) => {
    if (projectId === selectedProjectId) return;
    startNewConversation();
    setSelectedProjectId(projectId);
    setStatusMessage("项目已切换，上一项目的对话与临时证据已清空。");
  };

  return (
    <div className="ai-chat-workbench simple-ai-workbench">
      {projects.length === 0 && isDesktopRuntime() ? (
        <Notice tone="info" title="先创建项目">AI 助手会自动使用项目资料，因此需要先创建一个项目。<div className="notice-next-action"><Link to="/projects">创建项目 →</Link></div></Notice>
      ) : (
        <div className="simple-ai-toolbar">
          <label>
            <span>当前项目</span>
            <select className="select-input" name="aiProjectContext" value={selectedProjectId} disabled={contextLoading || projects.length === 0} onChange={(event) => changeProject(event.target.value)}>
              {projects.length === 0 && <option value="">桌面版中选择项目</option>}
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
          <div>
            <span className={`connection-pill${selectedProfile.apiKeyRequired && !hasSessionKey ? " warning" : ""}`}>{selectedProfile.apiKeyRequired && !hasSessionKey ? "AI 服务需要设置" : "AI 已就绪"}</span>
            <button className="secondary-button" type="button" onClick={startNewConversation}>新对话</button>
          </div>
        </div>
      )}

      <section className="ai-conversation-shell simple-ai-shell" aria-label="AI 对话工作区">
          {projectContext && <div className="simple-ai-context"><span className="status-dot" /><strong>正在使用：{projectContext.projectName}</strong><span>{projectContext.assetCount} 台服务器 · {projectContext.verifiedKnowledgeCount} 条已核验知识</span><Link to="/projects">编辑项目</Link></div>}

          <div className="ai-message-list" aria-live="polite">
            {messages.length === 0 ? (
              <div className="ai-chat-empty">
                <span className="ai-chat-mark" aria-hidden="true"><BrandMark className="brand-mark" /></span>
                <h2>直接说你遇到了什么问题</h2>
                <p>{projectContext ? `项目“${projectContext.projectName}”的资料已经自动带入，不需要重新填写环境。` : "选择项目后，系统会自动带入已有资料。"}</p>
                <div className="ai-starter-grid">
                  {modeOptions.map((option) => (
                    <button key={option.value} type="button" onClick={() => { setMode(option.value); setTask(option.starter); }}>
                      <strong>{option.label}</strong><span>{option.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : messages.map((message) => (
              <article className={`ai-message ai-message-${message.role}`} key={message.id}>
                <div className="ai-message-avatar" aria-hidden="true">
                  {message.role === "assistant" ? <BrandMark className="brand-mark" /> : "我"}
                </div>
                <div className="ai-message-body">
                  <header>
                    <strong>{message.role === "assistant" ? "Agnovexa AI" : "现场问题"}</strong>
                    {message.response && <span>{message.response.providerName} · {message.response.model}</span>}
                  </header>
                  {message.role === "assistant" ? <DraftText value={message.content} /> : <p className="ai-user-text">{message.content}</p>}
                  {message.response && (
                    <details className="ai-message-copy">
                      <summary>查看元数据与复制完整答复</summary>
                      <div className="inline-actions">
                        {message.response.totalTokens !== undefined && <Tag>{message.response.totalTokens} tokens</Tag>}
                        {message.response.requestId && <Tag>{message.response.requestId}</Tag>}
                      </div>
                      <CodeBlock value={message.content} label="AI 建议 · 仅供人工审阅" />
                    </details>
                  )}
                </div>
              </article>
            ))}
            {loading && <div className="ai-thinking"><span /><span /><span /><p>正在基于项目事实生成建议…</p></div>}
            <div ref={conversationEndRef} />
          </div>

          <div className="ai-composer-dock">
            {requestError && <Notice tone="danger" title="本次请求未发送">{requestError}</Notice>}
            {statusMessage && <div className="ai-inline-status">{statusMessage}</div>}
            <textarea
              className="ai-chat-input"
              name="aiQuestion"
              value={task}
              onChange={(event) => setTask(event.target.value)}
              onKeyDown={onComposerKeyDown}
              placeholder={`向“${projectContext?.projectName ?? "当前项目"}”提问，或描述现场现象…`}
              aria-label="现场问题"
            />

            <div className="simple-ai-send-row">
              <span>Ctrl + Enter 发送</span>
              <button className="primary-button" type="button" disabled={loading || task.trim().length < 4 || (prepared.redactionCount > 0 && !confirmedPreview)} onClick={() => void submit()}>{loading ? "正在生成…" : "发送"}</button>
            </div>

            <details className="ai-evidence-drawer simple-ai-options">
              <summary><span>添加日志、命令或其他资料</span><small>可选</small></summary>
              <div className="ai-evidence-grid">
                <label><span>补充环境事实</span><textarea className="evidence-input small" name="aiEnvironment" value={environment} onChange={(event) => setEnvironment(event.target.value)} placeholder="只补充项目档案中没有的本次现场事实" /></label>
                <label><span>成功标准</span><textarea className="evidence-input small" name="aiExpectedResult" value={expectedResult} onChange={(event) => setExpectedResult(event.target.value)} placeholder="服务、端口、接口、日志或业务验收标准" /></label>
                <label className="wide-field"><span>命令 / SQL / 配置 Diff</span><textarea className="evidence-input medium mono-input" name="aiCommandOrSql" value={commandOrSql} onChange={(event) => setCommandOrSql(event.target.value)} /></label>
                {mode === "diagnose-error" && <label><span>人工执行退出码</span><input className="text-input" name="aiExitCode" value={exitCode} onChange={(event) => setExitCode(event.target.value)} placeholder="例如 1、127" /></label>}
                <label className="wide-field"><span>stdout / stderr / 相关日志</span><textarea className="evidence-input medium mono-input" name="aiExecutionOutput" value={executionOutput} onChange={(event) => setExecutionOutput(event.target.value)} /></label>
              </div>
            </details>

            <details className="ai-send-preview simple-ai-options" open={prepared.redactionCount > 0}>
              <summary><span>AI 服务与发送设置</span><small>{prepared.redactionCount > 0 ? `${prepared.redactionCount} 处敏感内容已处理` : "可选"}</small></summary>
              <label className="ai-provider-simple"><span>AI 服务</span><select className="select-input" name="aiProvider" value={selectedProfile.id} onChange={(event) => setSelectedId(event.target.value)}>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · {profile.model || "未配置模型"}</option>)}</select><Link to="/ai-settings">打开 AI 设置</Link></label>
              <pre>{prepared.prompt}</pre>
              <div className="ai-advanced-options">
                <label><span>温度</span><input className="text-input" name="aiTemperature" value={temperature} onChange={(event) => setTemperature(event.target.value)} placeholder="服务默认" /></label>
                <label><span>最大输出 Token</span><input className="text-input" name="aiMaxTokens" value={maxTokens} onChange={(event) => setMaxTokens(event.target.value)} placeholder="服务默认" /></label>
              </div>
            </details>

            {prepared.redactionCount > 0 && <footer className="ai-composer-actions simple-ai-confirm">
              <label className="ai-safety-confirm">
                <input type="checkbox" name="aiSafetyConfirmed" checked={confirmedPreview} onChange={(event) => setConfirmedPreview(event.target.checked)} />
                <span>我已检查上面的脱敏结果</span>
              </label>
            </footer>}
          </div>
      </section>
    </div>
  );
}
