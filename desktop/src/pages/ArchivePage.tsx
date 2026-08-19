import { useEffect, useMemo, useRef, useState } from "react";
import { Notice, Panel, Tag } from "../components/Ui";
import { isDesktopRuntime } from "../lib/repository";
import {
  createWorkspaceBackup,
  generateAndArchiveDeploymentReport,
  getWorkspaceHealth,
  listGeneratedReports,
  listReportableTasks,
  restoreWorkspaceBackup,
  type GeneratedReportRecord,
  type ReportableTask,
  type WorkspaceHealth,
} from "../lib/workspaceRepository";
import {
  WORKSPACE_BACKUP_TABLES,
  downloadTextFile,
  formatBytes,
  parseWorkspaceBackup,
  verifyWorkspaceBackup,
  workspaceBackupFileName,
  type WorkspaceBackup,
} from "../lib/workspaceBackup";

const TABLE_LABELS: Record<(typeof WORKSPACE_BACKUP_TABLES)[number], string> = {
  projects: "项目",
  assets: "资产",
  environment_snapshots: "环境快照",
  deployment_tasks: "部署任务",
  change_plans: "变更计划",
  change_steps: "人工执行步骤",
  approval_records: "审批记录",
  manual_execution_evidence: "执行证据",
  skill_definitions: "Skill",
  knowledge_entries: "知识条目",
  generated_artifacts: "生成物",
  audit_events: "审计事件",
};

type PageStatus = {
  tone: "success" | "danger" | "warning" | "info";
  title: string;
  message: string;
};

export function ArchivePage() {
  const desktop = isDesktopRuntime();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [actor, setActor] = useState(() => window.localStorage.getItem("agnovexa.opsdesk.operator") ?? "");
  const [health, setHealth] = useState<WorkspaceHealth | null>(null);
  const [tasks, setTasks] = useState<ReportableTask[]>([]);
  const [reports, setReports] = useState<GeneratedReportRecord[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [reportPreview, setReportPreview] = useState("");
  const [backupPreview, setBackupPreview] = useState<WorkspaceBackup | null>(null);
  const [backupFileName, setBackupFileName] = useState("");
  const [restoreChecked, setRestoreChecked] = useState(false);
  const [restorePhrase, setRestorePhrase] = useState("");
  const [status, setStatus] = useState<PageStatus | null>(null);
  const [busy, setBusy] = useState<"health" | "export" | "import" | "restore" | "report" | "">("");

  const rememberActor = (value: string) => {
    setActor(value);
    window.localStorage.setItem("agnovexa.opsdesk.operator", value);
  };

  const load = async () => {
    if (!desktop) return;
    setBusy("health");
    try {
      const [nextHealth, nextTasks, nextReports] = await Promise.all([
        getWorkspaceHealth(),
        listReportableTasks(),
        listGeneratedReports(),
      ]);
      setHealth(nextHealth);
      setTasks(nextTasks);
      setReports(nextReports);
      setSelectedTaskId((current) => current || nextTasks[0]?.id || "");
    } catch (error) {
      setStatus({ tone: "danger", title: "生产数据检查失败", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy("");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const totalRows = useMemo(
    () => health ? WORKSPACE_BACKUP_TABLES.reduce((sum, name) => sum + health.counts[name], 0) : 0,
    [health],
  );

  const backupRows = useMemo(
    () => backupPreview
      ? WORKSPACE_BACKUP_TABLES.reduce((sum, name) => sum + backupPreview.manifest.tableCounts[name], 0)
      : 0,
    [backupPreview],
  );

  const exportBackup = async () => {
    setStatus(null);
    setBusy("export");
    try {
      const backup = await createWorkspaceBackup(actor);
      const content = `${JSON.stringify(backup, null, 2)}\n`;
      const fileName = workspaceBackupFileName(backup.manifest.exportedAt);
      downloadTextFile(fileName, content);
      downloadTextFile(
        `${fileName}.sha256`,
        `${backup.manifest.payloadSha256}  ${fileName}\n`,
        "text/plain;charset=utf-8",
      );
      setStatus({
        tone: "success",
        title: "工作区备份已导出",
        message: `${fileName}，共 ${Object.values(backup.manifest.tableCounts).reduce((sum, value) => sum + value, 0)} 行；同时生成 SHA-256 校验文件。`,
      });
      await load();
    } catch (error) {
      setStatus({ tone: "danger", title: "备份导出失败", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy("");
    }
  };

  const selectBackupFile = async (file: File | undefined) => {
    if (!file) return;
    setStatus(null);
    setBusy("import");
    setBackupPreview(null);
    setRestoreChecked(false);
    setRestorePhrase("");
    try {
      const raw = await file.text();
      const parsed = parseWorkspaceBackup(raw);
      if (!(await verifyWorkspaceBackup(parsed))) throw new Error("SHA-256 校验不通过，文件可能被修改或截断。");
      setBackupPreview(parsed);
      setBackupFileName(file.name);
      setStatus({
        tone: "success",
        title: "备份文件校验通过",
        message: `来源版本 ${parsed.manifest.appVersion}，导出时间 ${parsed.manifest.exportedAt}，共 ${WORKSPACE_BACKUP_TABLES.reduce((sum, name) => sum + parsed.manifest.tableCounts[name], 0)} 行。尚未写入当前工作区。`,
      });
    } catch (error) {
      setStatus({ tone: "danger", title: "备份文件无效", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const restoreBackup = async () => {
    if (!backupPreview) return;
    if (!restoreChecked || restorePhrase !== "RESTORE") {
      setStatus({ tone: "warning", title: "恢复确认不完整", message: "请勾选覆盖说明，并准确输入 RESTORE。" });
      return;
    }
    setBusy("restore");
    setStatus(null);
    try {
      await restoreWorkspaceBackup(backupPreview, actor);
      setStatus({
        tone: "success",
        title: "工作区恢复完成",
        message: `已从 ${backupFileName} 恢复本地 SQLite。建议立即重新执行完整性检查，并抽查项目、资产、任务和知识条目。`,
      });
      setBackupPreview(null);
      setBackupFileName("");
      setRestoreChecked(false);
      setRestorePhrase("");
      await load();
    } catch (error) {
      setStatus({ tone: "danger", title: "工作区恢复失败", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy("");
    }
  };

  const generateReport = async () => {
    setStatus(null);
    setBusy("report");
    try {
      if (!selectedTaskId) throw new Error("请选择部署任务。");
      const result = await generateAndArchiveDeploymentReport(selectedTaskId, actor);
      downloadTextFile(result.fileName, result.record.bodyMarkdown, "text/markdown;charset=utf-8");
      setReportPreview(result.record.bodyMarkdown);
      setStatus({
        tone: "success",
        title: "部署报告已生成",
        message: "Markdown 报告已下载，并以 draft 状态保存在本地生成物台账；人工复核后再归档。",
      });
      const [nextReports, nextHealth] = await Promise.all([listGeneratedReports(), getWorkspaceHealth()]);
      setReports(nextReports);
      setHealth(nextHealth);
    } catch (error) {
      setStatus({ tone: "danger", title: "部署报告生成失败", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="page-stack archive-page">
      <Notice tone="info" title="本页只管理本机工作区与报告">
        备份、恢复和报告均针对当前 Windows 用户的本地 SQLite，不连接服务器、不执行命令或 SQL，也不会导出 AI API Key、凭据库秘密或未脱敏生产密码。
      </Notice>
      {status && <Notice tone={status.tone} title={status.title}>{status.message}</Notice>}

      <Panel eyebrow="WORKSPACE HEALTH" title="生产工作区完整性">
        {!desktop ? (
          <div className="empty-state compact"><div className="empty-state-mark">DB</div><h2>浏览器预览不读取真实数据库</h2><p>请运行 Windows 桌面版检查 SQLite、备份和报告。</p></div>
        ) : busy === "health" && !health ? (
          <div className="loading-state">正在执行 SQLite integrity_check 与 foreign_key_check…</div>
        ) : health && (
          <>
            <div className="archive-health-grid">
              <div className={health.integrity === "ok" ? "ready" : "danger"}><span>SQLite 完整性</span><strong>{health.integrity}</strong><small>SQLite {health.databaseVersion}</small></div>
              <div className={health.foreignKeyViolations === 0 ? "ready" : "danger"}><span>外键冲突</span><strong>{health.foreignKeyViolations}</strong><small>必须为 0</small></div>
              <div className="ready"><span>受控数据总量</span><strong>{totalRows}</strong><small>不含 FTS 虚拟索引</small></div>
              <div className={health.lastBackupAt ? "ready" : "warning"}><span>最近备份</span><strong>{health.lastBackupAt ?? "尚未备份"}</strong><small>建议每次重大变更前导出</small></div>
            </div>
            <div className="archive-count-grid">
              {WORKSPACE_BACKUP_TABLES.map((name) => <div key={name}><span>{TABLE_LABELS[name]}</span><strong>{health.counts[name]}</strong></div>)}
            </div>
          </>
        )}
      </Panel>

      <div className="two-column-grid archive-grid">
        <Panel eyebrow="SAFE EXPORT" title="导出可校验工作区备份">
          <label className="field-stack"><span>操作人</span><input className="text-input" value={actor} onChange={(event) => rememberActor(event.target.value)} placeholder="现场工程师姓名" /></label>
          <ul className="check-list refined-list archive-rules">
            <li>导出项目、资产、快照、任务、审批、脱敏执行证据、Skill、知识和审计。</li>
            <li>不导出 API Key、凭据库秘密或 credential_references。</li>
            <li>同时生成 SHA-256 文件，恢复前程序会再次校验。</li>
          </ul>
          <button className="primary-button wide" type="button" disabled={!desktop || busy !== "" || actor.trim().length < 2} onClick={() => void exportBackup()}>{busy === "export" ? "正在导出…" : "导出工作区备份"}</button>
        </Panel>

        <Panel eyebrow="CONTROLLED RESTORE" title="校验并恢复备份">
          <input ref={fileInputRef} className="file-input" type="file" accept=".json,.opsdesk.json,application/json" disabled={!desktop || busy !== ""} onChange={(event) => void selectBackupFile(event.target.files?.[0])} />
          {backupPreview ? (
            <div className="backup-preview-card">
              <div><span>文件</span><strong>{backupFileName}</strong></div>
              <div><span>来源版本</span><strong>{backupPreview.manifest.appVersion}</strong></div>
              <div><span>导出人员</span><strong>{backupPreview.manifest.exportedBy}</strong></div>
              <div><span>数据量</span><strong>{backupRows} 行</strong></div>
              <div className="wide-field"><span>SHA-256</span><code>{backupPreview.manifest.payloadSha256}</code></div>
            </div>
          ) : <p className="panel-helper">选择 `.opsdesk.json` 文件后，仅进行结构和摘要校验；不会立即覆盖当前数据。</p>}
          {backupPreview && (
            <div className="restore-confirm-box">
              <label className="approval-check"><input type="checkbox" checked={restoreChecked} onChange={(event) => setRestoreChecked(event.target.checked)} /><span>我已先导出当前工作区备份，确认恢复会覆盖本地项目、资产、任务、知识和审计数据。</span></label>
              <label className="field-stack"><span>输入 RESTORE 确认</span><input className="text-input" value={restorePhrase} onChange={(event) => setRestorePhrase(event.target.value)} /></label>
              <button className="danger-button wide" type="button" disabled={busy !== "" || !restoreChecked || restorePhrase !== "RESTORE" || actor.trim().length < 2} onClick={() => void restoreBackup()}>{busy === "restore" ? "正在恢复并校验…" : "覆盖恢复本地工作区"}</button>
            </div>
          )}
        </Panel>
      </div>

      <Panel eyebrow="DEPLOYMENT REPORT" title="生成可审阅部署报告">
        <div className="report-builder-row">
          <label><span>部署任务</span><select className="select-input" value={selectedTaskId} onChange={(event) => { setSelectedTaskId(event.target.value); setReportPreview(""); }}><option value="">选择任务</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.projectName} / {task.assetName} / {task.title}</option>)}</select></label>
          <label><span>报告生成人</span><input className="text-input" value={actor} onChange={(event) => rememberActor(event.target.value)} /></label>
          <button className="primary-button" type="button" disabled={!desktop || busy !== "" || !selectedTaskId || actor.trim().length < 2} onClick={() => void generateReport()}>{busy === "report" ? "正在汇总证据…" : "生成并下载 Markdown"}</button>
        </div>
        {reportPreview && <details className="report-preview" open><summary>查看本次报告预览</summary><pre>{reportPreview}</pre></details>}
      </Panel>

      <Panel eyebrow="ARCHIVED ARTIFACTS" title="本地报告生成物" actions={<Tag>{reports.length} 份</Tag>}>
        {reports.length === 0 ? (
          <div className="empty-state compact"><div className="empty-state-mark">MD</div><h2>尚无部署报告</h2><p>从上方选择任务，系统会汇总计划、审批、人工证据、验证和回滚。</p></div>
        ) : (
          <div className="report-list">
            {reports.map((report) => (
              <article key={report.id}>
                <div><strong>{report.title}</strong><span>{report.generatedAt} · {report.reviewStatus}</span></div>
                <button className="secondary-button" type="button" onClick={() => downloadTextFile(`${report.title.replace(/[\\/:*?"<>|]/g, "-")}.md`, report.bodyMarkdown, "text/markdown;charset=utf-8")}>重新下载</button>
              </article>
            ))}
          </div>
        )}
      </Panel>

      <Notice tone="warning" title="恢复与报告均需人工复核">
        恢复完成不等于业务数据已验收；部署报告也不等于任务成功。恢复后应抽查关键记录，报告应由实施人员和项目负责人确认后再归档。
      </Notice>
    </div>
  );
}
