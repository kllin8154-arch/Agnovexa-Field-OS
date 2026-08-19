import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Notice, Panel, Tag } from "../components/Ui";
import {
  loadProviderProfiles,
  normalizeChatEndpoint,
  requestAiCompletion,
  resetProviderProfiles,
  saveProviderProfiles,
  type AiProviderProfile,
} from "../lib/ai";
import {
  clearAllSessionApiKeys,
  clearSessionApiKey,
  getSessionApiKey,
  setSessionApiKey,
  useSessionApiKeyStatus,
} from "../lib/aiSession";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "接口测试失败，请检查地址、模型、密钥和网络。";
}

function providerInitials(name: string): string {
  const words = name.trim().split(/[\s/]+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0] ?? "A"}${words[1][0] ?? "I"}`.toUpperCase();
  return name.trim().slice(0, 2).toUpperCase() || "AI";
}

export function AiProviderSettingsPage() {
  const initialProfiles = useMemo(() => loadProviderProfiles(), []);
  const [profiles, setProfiles] = useState<AiProviderProfile[]>(initialProfiles);
  const [selectedId, setSelectedId] = useState(initialProfiles[0]?.id ?? "deepseek");
  const [sessionKey, setSessionKey] = useState("");
  const [status, setStatus] = useState<
    | { tone: "success" | "warning" | "danger" | "info"; title: string; message: string }
    | null
  >(null);
  const [testing, setTesting] = useState(false);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedId) ?? profiles[0],
    [profiles, selectedId],
  );
  const keyLoaded = useSessionApiKeyStatus(selectedProfile?.id ?? "");

  useEffect(() => {
    if (!selectedProfile) return;
    setSessionKey(getSessionApiKey(selectedProfile.id));
    setStatus(null);
  }, [selectedProfile?.id]);

  if (!selectedProfile) {
    return (
      <div className="page-stack">
        <Notice tone="danger" title="没有可用 AI Provider">
          Provider 配置为空，请恢复默认配置后继续。
        </Notice>
        <button
          className="primary-button"
          type="button"
          onClick={() => {
            const defaults = resetProviderProfiles();
            setProfiles(defaults);
            setSelectedId(defaults[0]?.id ?? "deepseek");
          }}
        >
          恢复默认 Provider
        </button>
      </div>
    );
  }

  const updateProfile = <K extends keyof AiProviderProfile>(
    field: K,
    value: AiProviderProfile[K],
  ) => {
    setProfiles((current) =>
      current.map((profile) =>
        profile.id === selectedProfile.id ? { ...profile, [field]: value } : profile,
      ),
    );
    setStatus(null);
  };

  const validateCurrent = (): string | null => {
    if (!selectedProfile.name.trim()) return "显示名称不能为空。";
    if (!selectedProfile.baseUrl.trim()) return "Base URL 不能为空。";
    if (!normalizeChatEndpoint(selectedProfile.baseUrl)) return "Base URL 无效。";
    if (!selectedProfile.model.trim()) return "模型 ID 不能为空。";
    if (selectedProfile.apiKeyRequired && !sessionKey.trim()) {
      return "当前 Provider 需要 API Key。密钥只保留在本次运行内存中。";
    }
    return null;
  };

  const saveCurrent = () => {
    const validationError = validateCurrent();
    if (validationError) {
      setStatus({ tone: "danger", title: "配置未保存", message: validationError });
      return;
    }
    setSessionApiKey(selectedProfile.id, sessionKey);
    saveProviderProfiles(profiles);
    setStatus({
      tone: "success",
      title: "配置已保存",
      message: "Provider 元数据已保存到本机；API Key 仅保留在当前应用运行内存中。",
    });
  };

  const testConnection = async () => {
    const validationError = validateCurrent();
    if (validationError) {
      setStatus({ tone: "danger", title: "无法测试接口", message: validationError });
      return;
    }

    setTesting(true);
    setStatus({ tone: "info", title: "正在测试", message: "仅发送最小连接测试文本，不包含项目或现场数据。" });
    setSessionApiKey(selectedProfile.id, sessionKey);
    try {
      await requestAiCompletion({
        providerName: selectedProfile.name,
        baseUrl: selectedProfile.baseUrl,
        apiKey: sessionKey.trim() || undefined,
        model: selectedProfile.model,
        messages: [
          { role: "system", content: "你正在执行连接测试，不要调用工具，不要生成命令。" },
          { role: "user", content: "只回复：连接成功。" },
        ],
        timeoutSeconds: 45,
      });
      saveProviderProfiles(profiles);
      setStatus({ tone: "success", title: "接口可用", message: "Provider 已返回有效响应，可以在 AI 工作台中使用。" });
    } catch (error) {
      setStatus({ tone: "danger", title: "连接测试失败", message: toErrorMessage(error) });
    } finally {
      setTesting(false);
    }
  };

  const addCustomProvider = () => {
    const id = `custom-${Date.now()}`;
    const profile: AiProviderProfile = {
      id,
      kind: "custom",
      name: "自定义 Provider",
      baseUrl: "",
      model: "",
      apiKeyRequired: true,
      enabled: true,
      note: "填写 OpenAI Chat Completions 兼容地址和模型 ID。",
    };
    setProfiles((current) => [...current, profile]);
    setSelectedId(id);
    setSessionKey("");
  };

  const removeCurrentProvider = () => {
    if (selectedProfile.kind !== "custom") {
      setStatus({ tone: "warning", title: "内置模板不能删除", message: "可以停用内置 Provider，或恢复默认值。" });
      return;
    }
    clearSessionApiKey(selectedProfile.id);
    const next = profiles.filter((profile) => profile.id !== selectedProfile.id);
    setProfiles(next);
    saveProviderProfiles(next);
    setSelectedId(next[0]?.id ?? "deepseek");
  };

  const restoreDefaults = () => {
    const defaults = resetProviderProfiles();
    clearAllSessionApiKeys();
    setProfiles(defaults);
    setSelectedId(defaults[0]?.id ?? "deepseek");
    setSessionKey("");
    setStatus({ tone: "success", title: "已恢复默认配置", message: "自定义配置和当前会话密钥已清空。" });
  };

  return (
    <div className="page-stack ai-provider-page">
      <Notice tone="info" title="配置与使用已经分离">
        本页只管理 AI 服务、模型和当前会话密钥；实际方案生成、报错分析和 SQL 审查请进入 AI 工作台。应用不会把 API Key 写入 SQLite、localStorage、知识库或报告。
      </Notice>

      <div className="provider-settings-layout">
        <Panel
          className="provider-rail"
          eyebrow="PROVIDER REGISTRY"
          title="AI 服务"
          actions={
            <button className="icon-text-button" type="button" onClick={addCustomProvider}>
              ＋ 自定义
            </button>
          }
        >
          <div className="provider-list refined">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                className={`provider-nav-card${profile.id === selectedProfile.id ? " active" : ""}`}
                onClick={() => setSelectedId(profile.id)}
              >
                <span className="provider-logo">{providerInitials(profile.name)}</span>
                <span className="provider-nav-copy">
                  <strong>{profile.name}</strong>
                  <small>{profile.model || "模型待配置"}</small>
                </span>
                <span className={`provider-state${profile.enabled ? " online" : ""}`} />
              </button>
            ))}
          </div>
          <div className="provider-rail-footer">
            <span>{profiles.filter((profile) => profile.enabled).length} 个服务已启用</span>
            <button className="text-button" type="button" onClick={restoreDefaults}>恢复默认</button>
          </div>
        </Panel>

        <div className="provider-settings-main">
          <Panel
            eyebrow="SERVICE PROFILE"
            title={selectedProfile.name}
            actions={
              <div className="inline-actions">
                <Tag>{selectedProfile.kind === "custom" ? "自定义" : "内置模板"}</Tag>
                <Tag>{keyLoaded ? "会话密钥已载入" : "未载入密钥"}</Tag>
              </div>
            }
          >
            <div className="provider-toolbar">
              <div>
                <strong>OpenAI Chat Completions 兼容配置</strong>
                <span>只在显式点击测试或生成时发起请求</span>
              </div>
              <label className="switch-control">
                <input
                  type="checkbox"
                  checked={selectedProfile.enabled}
                  onChange={(event) => updateProfile("enabled", event.target.checked)}
                />
                <span />
                <strong>{selectedProfile.enabled ? "已启用" : "已停用"}</strong>
              </label>
            </div>

            <div className="config-form-grid">
              <label>
                <span>显示名称</span>
                <input
                  className="text-input"
                  value={selectedProfile.name}
                  onChange={(event) => updateProfile("name", event.target.value)}
                  placeholder="例如：公司内网模型网关"
                />
              </label>
              <label>
                <span>模型 ID</span>
                <input
                  className="text-input"
                  value={selectedProfile.model}
                  onChange={(event) => updateProfile("model", event.target.value)}
                  placeholder="以服务商控制台或本地服务为准"
                />
              </label>
              <label className="wide-field">
                <span>Base URL</span>
                <input
                  className="text-input"
                  value={selectedProfile.baseUrl}
                  onChange={(event) => updateProfile("baseUrl", event.target.value)}
                  placeholder="https://api.example.com/v1"
                />
                <small className="field-help">
                  实际请求地址：{normalizeChatEndpoint(selectedProfile.baseUrl) || "待填写"}
                </small>
              </label>
              <label className="wide-field">
                <span>API Key · 当前运行会话</span>
                <input
                  className="text-input secret-input"
                  type="password"
                  autoComplete="off"
                  value={sessionKey}
                  onChange={(event) => setSessionKey(event.target.value)}
                  placeholder={selectedProfile.apiKeyRequired ? "关闭应用后自动清空" : "可留空"}
                />
              </label>
              <label className="wide-field">
                <span>说明</span>
                <textarea
                  className="evidence-input small"
                  value={selectedProfile.note}
                  onChange={(event) => updateProfile("note", event.target.value)}
                  placeholder="记录用途、网络条件和模型限制；不要填写秘密。"
                />
              </label>
              <label className="approval-check compact-check">
                <input
                  type="checkbox"
                  checked={selectedProfile.apiKeyRequired}
                  onChange={(event) => updateProfile("apiKeyRequired", event.target.checked)}
                  disabled={selectedProfile.kind !== "custom"}
                />
                <span>此接口必须提供 API Key</span>
              </label>
            </div>

            <div className="secret-banner">
              <div className="secret-banner-icon">◎</div>
              <div>
                <strong>会话密钥不会落盘</strong>
                <span>Provider 名称、地址和模型可保存；密钥只存在于当前进程内存。</span>
              </div>
              {keyLoaded && (
                <button
                  className="text-button danger-text"
                  type="button"
                  onClick={() => {
                    clearSessionApiKey(selectedProfile.id);
                    setSessionKey("");
                  }}
                >
                  清除密钥
                </button>
              )}
            </div>

            {status && <Notice tone={status.tone} title={status.title}>{status.message}</Notice>}

            <div className="provider-actions">
              <button className="secondary-button danger-button" type="button" onClick={removeCurrentProvider}>
                {selectedProfile.kind === "custom" ? "删除当前服务" : "停用请使用上方开关"}
              </button>
              <div className="inline-actions">
                <Link className="secondary-button" to="/ai">打开 AI 工作台</Link>
                <button className="secondary-button" type="button" disabled={testing} onClick={() => void testConnection()}>
                  {testing ? "正在测试…" : "测试接口"}
                </button>
                <button className="primary-button" type="button" onClick={saveCurrent}>保存配置</button>
              </div>
            </div>
          </Panel>

          <Panel eyebrow="SECURITY BOUNDARY" title="AI 服务运行边界">
            <div className="policy-grid compact-policy-grid">
              <div><span>调用方式</span><strong>用户显式触发</strong><Tag>无后台请求</Tag></div>
              <div><span>现场数据</span><strong>发送前脱敏</strong><Tag>人工预览</Tag></div>
              <div><span>执行能力</span><strong>永久关闭</strong><Tag>无 SSH / Shell</Tag></div>
              <div><span>失败处理</span><strong>返回人工阶段</strong><Tag>不自动重试命令</Tag></div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
