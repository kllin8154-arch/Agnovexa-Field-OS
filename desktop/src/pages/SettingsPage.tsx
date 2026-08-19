import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Notice, Panel, Tag } from "../components/Ui";
import { probeStorage, type StorageProbe } from "../lib/database";
import { DEFAULT_RUNTIME_POLICY, loadRuntimePolicy } from "../lib/runtimePolicy";
import { THEME_OPTIONS, useTheme } from "../lib/theme";
import type { RuntimePolicy } from "../types";

export function SettingsPage() {
  const { mode, resolvedTheme, customTheme, setMode, importCustomTheme, removeCustomTheme } = useTheme();
  const themeFileRef = useRef<HTMLInputElement | null>(null);
  const [themeStatus, setThemeStatus] = useState<{ tone: "success" | "danger"; title: string; message: string } | null>(null);
  const [policy, setPolicy] = useState<RuntimePolicy>(DEFAULT_RUNTIME_POLICY);
  const [storage, setStorage] = useState<StorageProbe>({
    mode: "browser-preview",
    detail: "正在检测…",
  });

  useEffect(() => {
    void loadRuntimePolicy().then(setPolicy);
    void probeStorage().then(setStorage);
  }, []);

  const loadThemeFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 32 * 1024) {
      setThemeStatus({ tone: "danger", title: "主题导入失败", message: "主题文件不能超过 32 KB。" });
      return;
    }
    try {
      const imported = importCustomTheme(await file.text());
      setThemeStatus({ tone: "success", title: "自定义主题已启用", message: `“${imported.name}”已通过结构和可读性校验，仅保存在本机。` });
    } catch (error) {
      setThemeStatus({ tone: "danger", title: "主题导入失败", message: error instanceof Error ? error.message : String(error) });
    } finally {
      if (themeFileRef.current) themeFileRef.current.value = "";
    }
  };

  return (
    <div className="page-stack settings-page">
      <Panel eyebrow="APPEARANCE" title="外观与主题">
        <div className="theme-choice-grid">
          {THEME_OPTIONS.map((option) => (
            <button key={option.value} type="button" className={`theme-choice-card${mode === option.value ? " active" : ""}`} onClick={() => setMode(option.value)}>
              <div className={`theme-preview theme-preview-${option.value}`}><span /><div><i /><i /><i /></div></div>
              <strong>{option.label}</strong>
              <span>{option.description}</span>
              {mode === option.value && <small>当前选择</small>}
            </button>
          ))}
          <button type="button" className={`theme-choice-card${mode === "custom" ? " active" : ""}`} onClick={() => customTheme ? setMode("custom") : themeFileRef.current?.click()}>
            <div className="theme-preview theme-preview-custom" style={customTheme ? { background: customTheme.background, borderColor: customTheme.outline } : undefined}><span style={customTheme ? { background: customTheme.surfaceElevated } : undefined} /><div style={customTheme ? { background: customTheme.surface } : undefined}><i style={customTheme ? { background: customTheme.primary } : undefined} /><i style={customTheme ? { background: customTheme.secondary } : undefined} /><i style={customTheme ? { background: customTheme.success } : undefined} /></div></div>
            <strong>{customTheme?.name ?? "导入主题"}</strong>
            <span>{customTheme ? "本机自定义 JSON 主题" : "校验 JSON 后安全应用"}</span>
            {mode === "custom" && <small>当前选择</small>}
          </button>
        </div>
        <input ref={themeFileRef} className="visually-hidden" type="file" name="customThemeFile" aria-label="选择自定义主题 JSON 文件" accept="application/json,.json" onChange={(event) => void loadThemeFile(event.target.files?.[0])} />
        <div className="theme-import-actions">
          <span>支持 schemaVersion 1；低对比文字会自动修正，非法主题不会覆盖当前设置。</span>
          <button className="secondary-button" type="button" onClick={() => themeFileRef.current?.click()}>{customTheme ? "替换主题文件" : "选择 JSON 文件"}</button>
          {customTheme && <button className="text-button danger-text" type="button" onClick={() => { removeCustomTheme(); setThemeStatus(null); }}>移除自定义主题</button>}
        </div>
        {themeStatus && <Notice tone={themeStatus.tone} title={themeStatus.title}>{themeStatus.message}</Notice>}
        <div className="settings-inline-note">当前实际主题：<strong>{mode === "custom" && customTheme ? customTheme.name : resolvedTheme === "dark" ? "深色" : "明亮"}</strong>。主题设置仅保存在本机，不影响项目数据。</div>
      </Panel>

      <Notice tone="success" title="不可绕过的人工执行边界">
        当前桌面端不注册 SSH、Shell、SFTP、远程文件、进程启动或生产数据库执行能力。命令、SQL、配置 Diff、验证和回滚只能生成与复制，由现场工程师人工执行。
      </Notice>

      <div className="two-column-grid settings-grid">
        <Panel eyebrow="RUNTIME POLICY" title="运行策略">
          <div className="policy-grid compact-policy-grid">
            <div><span>执行模式</span><strong>{policy.executionMode}</strong><Tag>人工执行</Tag></div>
            <div><span>网络假设</span><strong>{policy.networkAssumption}</strong><Tag>本地优先</Tag></div>
            <div><span>SSH / Shell</span><strong>{policy.sshCapability}</strong><Tag>永久关闭</Tag></div>
            <div><span>远程写能力</span><strong>{policy.remoteWriteCapability}</strong><Tag>永久关闭</Tag></div>
            <div><span>知识隔离</span><strong>{policy.knowledgeIsolation}</strong><Tag>内部优先</Tag></div>
            <div><span>数据模式</span><strong>{storage.mode}</strong><Tag>{storage.mode === "sqlite" ? "可持久化" : "只读预览"}</Tag></div>
          </div>
          <p className="settings-detail">{storage.detail}</p>
        </Panel>

        <Panel eyebrow="WORKSPACE ENTRY" title="配置、使用、模板与归档分离">
          <div className="settings-link-cards settings-link-cards-four">
            <Link to="/ai-settings"><span>配置</span><strong>AI 服务配置</strong><p>管理 Provider、Base URL、模型、启用状态和当前会话 API Key。</p></Link>
            <Link to="/ai"><span>使用</span><strong>AI 工作台</strong><p>生成部署方案、分析人工报错、审查 SQL 和整理知识草稿。</p></Link>
            <Link to="/skills"><span>模板</span><strong>Skill 专库</strong><p>管理结构化前置检查、人工执行、验证和回滚模板。</p></Link>
            <Link to="/archive"><span>归档</span><strong>数据与归档</strong><p>执行 SQLite 完整性检查、可校验备份恢复和部署报告导出。</p></Link>
          </div>
        </Panel>
      </div>

      <div className="two-column-grid settings-grid">
        <Panel eyebrow="SECRETS" title="敏感信息策略">
          <ul className="check-list refined-list">
            <li>API Key 只保留在当前应用进程内存，关闭应用后清空。</li>
            <li>Provider 元数据可保存在本机，但不会包含真实密钥。</li>
            <li>发送前自动脱敏内网 IP、连接凭据、Authorization、Token 和私钥块。</li>
            <li>外部 AI 返回内容只能作为草案，不能自动升级为已验证知识。</li>
            <li>工作区备份排除 API Key、凭据库秘密和未脱敏生产密码。</li>
          </ul>
        </Panel>

        <Panel eyebrow="PRODUCTION CHECK" title="生产使用检查">
          <div className="production-check-grid">
            <div className={storage.mode === "sqlite" ? "ready" : "warning"}><span>本地数据库</span><strong>{storage.mode === "sqlite" ? "已就绪" : "未就绪"}</strong></div>
            <div className="ready"><span>人工执行门禁</span><strong>已启用</strong></div>
            <div className="ready"><span>远程执行能力</span><strong>不存在</strong></div>
            <div className="ready"><span>AI 显式调用</span><strong>已启用</strong></div>
            <div className="ready"><span>备份摘要校验</span><strong>SHA-256</strong></div>
            <div className="ready"><span>Skill 验证门禁</span><strong>已启用</strong></div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
