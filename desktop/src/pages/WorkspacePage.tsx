import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Notice, Panel, Tag } from "../components/Ui";
import { isDesktopRuntime } from "../lib/repository";
import {
  exportWorkspaceBundle,
  getWorkspaceHealth,
  importWorkspaceBundle,
  validateWorkspaceBundle,
  type WorkspaceBundle,
  type WorkspaceHealth,
} from "../lib/productionRepository";

const LAST_EXPORT_KEY = "agnovexa.opsdesk.lastWorkspaceExport";

function safeFilePart(value: string): string {
  return value.replace(/[:.]/g, "-").replace(/[^a-z0-9_-]/gi, "");
}

function downloadJson(bundle: WorkspaceBundle): void {
  const text = JSON.stringify(bundle, null, 2);
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Agnovexa-OpsDesk-Workspace-${safeFilePart(bundle.exportedAt)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function WorkspacePage() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [health, setHealth] = useState<WorkspaceHealth | null>(null);
  const [bundle, setBundle] = useState<WorkspaceBundle | null>(null);
  const [operator, setOperator] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastExport, setLastExport] = useState(() => window.localStorage.getItem(LAST_EXPORT_KEY) ?? "从未导出");
  const [status, setStatus] = useState<{ tone: "success" | "danger" | "warning" | "info"; title: string; message: string } | null>(null);

  const loadHealth = async () => {
    if (!isDesktopRuntime()) return;
    try {
      setHealth(await getWorkspaceHealth());
    } catch (error) {
      setStatus({ tone: "danger", title: "生产自检失败", message: error instanceof Error ? error.message : String(error) });
    }
  };

  useEffect(() => {
    void loadHealth();
  }, []);

  const totalRows = useMemo(
    () => health ? Object.values(health.rowCounts).reduce((sum, value) => sum + value, 0) : 0,
    [health],
  );

  const exportBundle = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const next = await exportWorkspaceBundle("0.4.0");
      downloadJson(next);
      window.localStorage.setItem(LAST_EXPORT_KEY, next.exportedAt);
      setLastExport(next.exportedAt);
      setStatus({ tone: "success", title: "工作区备份已生成", message: "JSON 备份不包含 API Key，也不包含任何远程执行能力。请将文件保存到受控位置并定期校验。" });
      await loadHealth();
    } catch (error) {
      setStatus({ tone: "danger", title: "工作区备份失败", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  };

  const selectFile = () => inputRef.current?.click();

  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 100 * 1024 * 1024) throw new Error("备份文件超过 100 MB，请先检查文件来源与内容。");
      const parsed = JSON.parse(await file.text()) as unknown;
      const checked = validateWorkspaceBundle(parsed);
      setBundle(checked);
      setConfirmed(false);
      setStatus({ tone: "info", title: "备份文件已通过格式检查", message: "导入采用只增不覆盖的合并模式；同 ID 记录会跳过，不会删除当前工作区数据。" });
    } catch (error) {
      setBundle(null);
      setStatus({ tone: "danger", title: "备份文件无效", message: error instanceof Error ? error.message : String(error) });
    }
  };

  const importBundle = async () => {
    if (!bundle) return;
    setBusy(true);
    setStatus(null);
    try {
      const imported = await importWorkspaceBundle(bundle, operator);
      const count = Object.values(imported).reduce((sum, value) => sum + value, 0);
      setStatus({ tone: "success", title: "工作区合并完成", message: `本次新增 ${count} 条记录；已有同 ID 数据保持不变。请继续核对项目、资产、知识和执行证据。` });
      setBundle(null);
      setConfirmed(false);
      await loadHealth();
    } catch (error) {
      setStatus({ tone: "danger", title: "工作区导入失败", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-stack workspace-page">
      <Notice tone="warning" title="备份用于本地工作区迁移，不替代项目归档制度">
        备份只包含 SQLite 中的脱敏业务记录和模板。API Key 只存在于应用进程内存，永远不会进入备份；导入也不会启用 SSH、Shell 或数据库自动执行。
      </Notice>
      {status && <Notice tone={status.tone} title={status.title}>{status.message}</Notice>}

      <div className="workspace-health-grid">
        <Panel eyebrow="DATABASE" title="SQLite 完整性">
          <div className={`health-value ${health?.integrityOk ? "good" : "danger"}`}>{health ? (health.integrityOk ? "通过" : "异常") : "检测中"}</div>
          <p>{health?.integrityMessage ?? "正在执行 PRAGMA integrity_check…"}</p>
        </Panel>
        <Panel eyebrow="WORKSPACE" title="本地记录">
          <div className="health-value">{totalRows}</div>
          <p>{health?.rowCounts.projects ?? 0} 个项目 · {health?.rowCounts.assets ?? 0} 个资产 · {health?.rowCounts.deployment_tasks ?? 0} 个任务</p>
        </Panel>
        <Panel eyebrow="TRUST" title="已验证知识">
          <div className="health-value">{(health?.verifiedSkills ?? 0) + (health?.verifiedKnowledge ?? 0)}</div>
          <p>{health?.verifiedSkills ?? 0} 个 Skill · {health?.verifiedKnowledge ?? 0} 条内部知识</p>
        </Panel>
        <Panel eyebrow="ATTENTION" title="待处理事项">
          <div className={`health-value ${(health?.failedManualTasks ?? 0) > 0 ? "danger" : "good"}`}>{(health?.publicDrafts ?? 0) + (health?.failedManualTasks ?? 0)}</div>
          <p>{health?.publicDrafts ?? 0} 条外部待审 · {health?.failedManualTasks ?? 0} 个失败任务</p>
        </Panel>
      </div>

      <div className="two-column-grid backup-layout">
        <Panel eyebrow="EXPORT" title="导出工作区备份" actions={<Tag>不含 API Key</Tag>}>
          <div className="backup-copy">
            <h3>生成可审计 JSON 备份</h3>
            <p>导出项目、资产、环境快照、部署任务、变更包、审批、人工执行证据、Skill、知识条目和审计事件。</p>
            <ul className="check-list">
              <li>导出前自动执行 SQLite 完整性检查。</li>
              <li>明确写入 `containsApiKeys: false`。</li>
              <li>明确写入 `remoteExecution: false`。</li>
              <li>生成每张表的记录数量，便于核对。</li>
            </ul>
            <div className="backup-meta"><span>上次导出</span><strong>{lastExport}</strong></div>
            <button className="primary-button wide" type="button" disabled={!isDesktopRuntime() || busy} onClick={() => void exportBundle()}>{busy ? "处理中…" : "生成并下载备份"}</button>
          </div>
        </Panel>

        <Panel eyebrow="IMPORT" title="合并工作区备份" actions={<Tag>只增不覆盖</Tag>}>
          <input ref={inputRef} type="file" accept="application/json,.json" hidden onChange={(event) => void readFile(event)} />
          <div className="backup-copy">
            <h3>导入前先预览与确认</h3>
            <p>当前版本只支持合并导入：同 ID 记录跳过，不覆盖、不删除现有数据，降低误操作风险。</p>
            <button className="secondary-button wide" type="button" disabled={!isDesktopRuntime() || busy} onClick={selectFile}>选择备份 JSON</button>

            {bundle ? (
              <div className="import-preview">
                <div><span>来源版本</span><strong>{bundle.appVersion}</strong></div>
                <div><span>导出时间</span><strong>{bundle.exportedAt}</strong></div>
                <div><span>结构版本</span><strong>{bundle.schemaVersion}</strong></div>
                <div><span>记录总数</span><strong>{Object.values(bundle.rowCounts).reduce((sum, value) => sum + value, 0)}</strong></div>
                <div><span>API Key</span><strong>{bundle.containsApiKeys ? "异常" : "不包含"}</strong></div>
                <div><span>远程执行</span><strong>{bundle.remoteExecution ? "异常" : "关闭"}</strong></div>
              </div>
            ) : (
              <div className="empty-state compact"><div className="empty-state-mark">JSON</div><h2>尚未选择备份</h2><p>只接受 Agnovexa OpsDesk 生成且安全声明完整的 JSON。</p></div>
            )}

            <label><span>导入操作人</span><input className="text-input" value={operator} onChange={(event) => setOperator(event.target.value)} placeholder="用于写入本地审计事件" /></label>
            <label className="approval-check"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>我已核对文件来源、记录数量、安全声明和合并策略。</span></label>
            <button className="primary-button wide" type="button" disabled={!bundle || !confirmed || busy} onClick={() => void importBundle()}>{busy ? "处理中…" : "人工确认后合并导入"}</button>
          </div>
        </Panel>
      </div>

      <Panel eyebrow="PRODUCTION CHECKLIST" title="试生产投入前检查">
        <div className="production-checklist">
          <div className={health?.integrityOk ? "done" : "blocked"}><span>01</span><strong>SQLite 完整性</strong><p>数据库必须通过 integrity_check。</p></div>
          <div className={(health?.verifiedSkills ?? 0) > 0 ? "done" : "pending"}><span>02</span><strong>已验证 Skill</strong><p>至少建立一条与当前业务匹配的 verified Skill。</p></div>
          <div className={lastExport !== "从未导出" ? "done" : "pending"}><span>03</span><strong>备份恢复制度</strong><p>正式项目开始前完成一次导出和合并恢复演练。</p></div>
          <div className="done"><span>04</span><strong>人工执行边界</strong><p>应用不注册 SSH、Shell 或生产数据库执行工具。</p></div>
          <div className="pending"><span>05</span><strong>Windows 代码签名</strong><p>公开或大规模分发前建议配置商业代码签名证书。</p></div>
          <div className="pending"><span>06</span><strong>真实项目验收</strong><p>至少完成一个完整部署任务的采集、计划、执行、验证和知识沉淀。</p></div>
        </div>
      </Panel>
    </div>
  );
}
