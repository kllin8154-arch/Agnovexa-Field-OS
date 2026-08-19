import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Notice, Panel, Tag } from "../components/Ui";
import {
  DEFAULT_AI_SYSTEM_PROMPT,
  loadProviderProfiles,
  normalizeChatEndpoint,
  requestAiCompletion,
  resetProviderProfiles,
  saveProviderProfiles,
  type AiProviderProfile,
} from "../lib/ai";
import { useAiRuntime } from "../lib/aiRuntime";

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function AiProvidersPage() {
  const [profiles, setProfiles] = useState<AiProviderProfile[]>(() => loadProviderProfiles());
  const runtime = useAiRuntime();
  const initialId = profiles.some((profile) => profile.id === runtime.selectedProviderId)
    ? runtime.selectedProviderId
    : profiles[0]?.id ?? "deepseek";
  const [selectedId, setSelectedId] = useState(initialId);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);

  const selected = useMemo(
    () => profiles.find((profile) => profile.id === selectedId) ?? profiles[0],
    [profiles, selectedId],
  );

  if (!selected) {
    return <Notice tone="danger" title="没有 AI Provider">请恢复默认 Provider 模板。</Notice>;
  }

  const select = (id: string) => {
    setSelectedId(id);
    runtime.selectProvider(id);
    setError("");
    setStatus("");
  };

  const update = <K extends keyof AiProviderProfile>(field: K, value: AiProviderProfile[K]) => {
    setProfiles((current) => current.map((profile) =>
      profile.id === selected.id ? { ...profile, [field]: value } : profile,
    ));
    setError("");
    setStatus("");
  };

  const save = () => {
    saveProviderProfiles(profiles);
    runtime.selectProvider(selected.id);
    setStatus("Provider 元数据已保存在本机；API Key 仍只存在当前应用进程内存中。");
  };

  const restore = () => {
    const defaults = resetProviderProfiles();
    runtime.clearAllApiKeys();
    runtime.selectProvider(defaults[0]?.id ?? "deepseek");
    setProfiles(defaults);
    setSelectedId(defaults[0]?.id ?? "deepseek");
    setStatus("已恢复默认 Provider 模板，并清空所有会话密钥。");
  };

  const addCustom = () => {
    const id = `custom-${crypto.randomUUID()}`;
    const profile: AiProviderProfile = {
      id,
      kind: "custom",
      name: "自定义接口",
      baseUrl: "",
      model: "",
      apiKeyRequired: true,
      enabled: true,
      note: "OpenAI Chat Completions 兼容接口。",
    };
    setProfiles((current) => [...current, profile]);
    select(id);
  };

  const removeCustom = () => {
    if (!selected.id.startsWith("custom-")) return;
    const next = profiles.filter((profile) => profile.id !== selected.id);
    runtime.clearApiKey(selected.id);
    setProfiles(next);
    select(next[0]?.id ?? "deepseek");
  };

  const testConnection = async () => {
    setError("");
    setStatus("");
    const apiKey = runtime.getApiKey(selected.id).trim();
    if (!selected.enabled) return setError("当前 Provider 已停用。");
    if (!selected.baseUrl.trim()) return setError("请填写 Base URL。");
    if (!selected.model.trim()) return setError("请填写服务商当前可用的模型 ID。");
    if (selected.apiKeyRequired && !apiKey) return setError("请输入 API Key；密钥不会落盘。");

    setTesting(true);
    try {
      const result = await requestAiCompletion({
        providerName: selected.name,
        baseUrl: selected.baseUrl,
        apiKey: apiKey || undefined,
        model: selected.model,
        messages: [
          { role: "system", content: DEFAULT_AI_SYSTEM_PROMPT },
          { role: "user", content: "这是接口连通性测试。不要生成命令，只回复：连接成功。" },
        ],
        timeoutSeconds: 45,
      });
      setStatus(`连接成功：${result.providerName} / ${result.model}`);
    } catch (reason) {
      setError(readableError(reason));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="page-stack">
      <Notice tone="info" title="AI 接口配置与业务使用已分离">
        本页只管理 Provider 元数据、会话密钥和连通性测试。部署方案、SQL 审查和报错分析请进入 AI 工作台。
      </Notice>

      <div className="provider-settings-layout">
        <Panel
          eyebrow="PROVIDER REGISTRY"
          title="AI 接口"
          actions={<button className="secondary-button" type="button" onClick={addCustom}>＋ 自定义接口</button>}
        >
          <div className="provider-list">
            {profiles.map((profile) => (
              <button
                className={`provider-item${profile.id === selected.id ? " active" : ""}`}
                key={profile.id}
                type="button"
                onClick={() => select(profile.id)}
              >
                <span className="provider-avatar">{profile.name.slice(0, 2).toUpperCase()}</span>
                <span className="provider-copy">
                  <strong>{profile.name}</strong>
                  <small>{profile.model || "尚未配置模型"}</small>
                </span>
                <span className={`provider-state${profile.enabled ? " online" : ""}`}>
                  {profile.enabled ? "启用" : "停用"}
                </span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel
          eyebrow="OPENAI-COMPATIBLE PROFILE"
          title={selected.name}
          actions={<Tag>{selected.kind}</Tag>}
        >
          <div className="ai-config-grid">
            <label>
              <span>显示名称</span>
              <input className="text-input" value={selected.name} onChange={(event) => update("name", event.target.value)} />
            </label>
            <label>
              <span>模型 ID</span>
              <input className="text-input" value={selected.model} onChange={(event) => update("model", event.target.value)} placeholder="以服务商控制台当前值为准" />
            </label>
            <label className="wide-field">
              <span>Base URL</span>
              <input className="text-input" value={selected.baseUrl} onChange={(event) => update("baseUrl", event.target.value)} placeholder="https://api.example.com/v1" />
              <small>请求地址：{normalizeChatEndpoint(selected.baseUrl) || "待配置"}</small>
            </label>
            <label className="wide-field">
              <span>API Key（仅当前运行内存）</span>
              <div className="secret-input-row">
                <input
                  className="text-input"
                  type="password"
                  autoComplete="off"
                  value={runtime.getApiKey(selected.id)}
                  onChange={(event) => runtime.setApiKey(selected.id, event.target.value)}
                  placeholder={selected.apiKeyRequired ? "关闭应用后自动清空" : "可留空"}
                />
                <button className="secondary-button" type="button" onClick={() => runtime.clearApiKey(selected.id)}>清空</button>
              </div>
            </label>
            <label className="approval-check">
              <input type="checkbox" checked={selected.enabled} onChange={(event) => update("enabled", event.target.checked)} />
              <span>启用当前 Provider</span>
            </label>
            <label className="approval-check">
              <input type="checkbox" checked={selected.apiKeyRequired} onChange={(event) => update("apiKeyRequired", event.target.checked)} />
              <span>请求必须提供 API Key</span>
            </label>
            <label className="wide-field">
              <span>备注</span>
              <textarea className="evidence-input small" value={selected.note} onChange={(event) => update("note", event.target.value)} />
            </label>
          </div>

          <div className="security-summary">
            <div><span>元数据</span><strong>可本地保存</strong></div>
            <div><span>API Key</span><strong>仅进程内存</strong></div>
            <div><span>调用方式</span><strong>用户显式触发</strong></div>
            <div><span>执行能力</span><strong>无</strong></div>
          </div>

          {error && <Notice tone="danger" title="接口测试失败">{error}</Notice>}
          {status && <Notice tone="success" title="当前状态">{status}</Notice>}

          <div className="inline-actions end">
            {selected.id.startsWith("custom-") && <button className="text-button danger-text" type="button" onClick={removeCustom}>删除当前接口</button>}
            <button className="secondary-button" type="button" onClick={restore}>恢复默认模板</button>
            <button className="secondary-button" type="button" disabled={testing} onClick={() => void testConnection()}>{testing ? "测试中…" : "测试接口"}</button>
            <button className="primary-button" type="button" onClick={save}>保存配置</button>
          </div>
        </Panel>
      </div>

      <div className="provider-footer-card">
        <div>
          <span className="eyebrow">READY TO USE</span>
          <strong>当前工作 Provider：{profiles.find((item) => item.id === runtime.selectedProviderId)?.name ?? selected.name}</strong>
          <p>进入工作台后，只显示任务输入、脱敏预览和 AI 返回结果，不再混入接口配置表单。</p>
        </div>
        <Link className="primary-button link-button" to="/ai">进入 AI 工作台</Link>
      </div>
    </div>
  );
}
