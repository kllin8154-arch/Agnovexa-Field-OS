import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import { MetricCard, Notice, Panel, Tag } from "../components/Ui";
import {
  getDashboardSummary,
  isDesktopRuntime,
  listAssets,
  listDeploymentTasks,
  type AssetRecord,
  type DashboardSummary,
  type DeploymentTaskRecord,
} from "../lib/repository";

const EMPTY_SUMMARY: DashboardSummary = {
  projects: 0,
  assets: 0,
  pendingManual: 0,
  failedTasks: 0,
  verifiedKnowledge: 0,
  publicDrafts: 0,
};

const phaseLabels: Record<string, string> = {
  DISCOVER: "环境采集",
  DEFINE: "任务定义",
  RETRIEVE: "知识检索",
  PLAN: "计划审阅",
  APPROVE: "人工确认",
  MANUAL_EXECUTE: "等待人工执行",
  VERIFY: "独立验证",
  KNOWLEDGE: "知识沉淀",
};

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [tasks, setTasks] = useState<DeploymentTaskRecord[]>([]);
  const [loading, setLoading] = useState(isDesktopRuntime());
  const [error, setError] = useState("");

  const load = async () => {
    if (!isDesktopRuntime()) return;
    setLoading(true);
    setError("");
    try {
      const [nextSummary, nextAssets, nextTasks] = await Promise.all([
        getDashboardSummary(),
        listAssets(),
        listDeploymentTasks(6),
      ]);
      setSummary(nextSummary);
      setAssets(nextAssets.slice(0, 5));
      setTasks(nextTasks.slice(0, 5));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="page-stack dashboard-page">
      {!isDesktopRuntime() && (
        <Notice tone="info" title="当前为浏览器预览">
          预览模式不会写入 SQLite，也不会展示虚构的生产资产。安装 Windows 桌面版后可创建真实项目、资产、任务和知识条目。
        </Notice>
      )}
      {error && <Notice tone="danger" title="工作区读取失败">{error}</Notice>}

      <div className="metrics-grid">
        <MetricCard label="项目工作区" value={summary.projects} detail="本地隔离项目" tone="neutral" />
        <MetricCard label="服务器资产" value={summary.assets} detail="仅记录事实，不建立远程连接" tone="good" />
        <MetricCard label="待人工执行" value={summary.pendingManual} detail="命令与 SQL 等待工程师执行" tone="warn" />
        <MetricCard label="执行失败" value={summary.failedTasks} detail="需回传日志继续排查" tone={summary.failedTasks > 0 ? "danger" : "neutral"} />
      </div>

      <div className="two-column-grid dashboard-primary-grid">
        <Panel
          eyebrow="RECENT TASKS"
          title="最近任务"
          actions={<Link className="text-button" to="/deployments">新建任务</Link>}
        >
          {loading ? (
            <div className="loading-state">正在读取本地任务…</div>
          ) : tasks.length === 0 ? (
            <div className="empty-state compact">
              <div className="empty-state-mark">01</div>
              <h2>还没有部署任务</h2>
              <p>先建立项目与服务器资产，再创建离线部署或变更任务。</p>
              <Link className="primary-button" to="/deployments">创建第一个任务</Link>
            </div>
          ) : (
            <div className="table-list">
              {tasks.map((task) => (
                <div className="table-row task-table-row" key={task.id}>
                  <div>
                    <strong>{task.title}</strong>
                    <span>{task.projectName} · {task.assetName}</span>
                  </div>
                  <div><Tag>{task.riskLevel}</Tag></div>
                  <div><span className="badge status-reviewed">{phaseLabels[task.workflowPhase] ?? task.workflowPhase}</span></div>
                  <Link className="secondary-button" to="/changes">查看</Link>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel eyebrow="KNOWLEDGE HEALTH" title="知识与审核状态">
          <div className="knowledge-health-grid">
            <div><span>内部已验证</span><strong>{summary.verifiedKnowledge}</strong><small>可作为方案依据</small></div>
            <div><span>外部待审核</span><strong>{summary.publicDrafts}</strong><small>不可直接用于生产</small></div>
          </div>
          <div className="dashboard-callout">
            <strong>内部优先，外部待审</strong>
            <p>公开资料只有经过脱敏、人工审核和现场验证后，才能转为内部已验证知识。</p>
          </div>
          <Link className="secondary-button wide" to="/knowledge">打开双知识库</Link>
        </Panel>
      </div>

      <Panel
        eyebrow="RECENT ASSETS"
        title="最近服务器资产"
        actions={<Link className="text-button" to="/assets">管理资产</Link>}
      >
        {loading ? (
          <div className="loading-state">正在读取本地资产…</div>
        ) : assets.length === 0 ? (
          <div className="empty-state compact horizontal-empty">
            <div className="empty-state-mark" aria-hidden="true"><BrandMark className="brand-mark" /></div>
            <div><h2>尚未登记服务器资产</h2><p>资产只作为本地台账和环境快照目标，不会被程序自动连接。</p></div>
            <Link className="primary-button" to="/assets">登记资产</Link>
          </div>
        ) : (
          <div className="asset-summary-grid">
            {assets.map((asset) => (
              <article className="asset-summary-card" key={asset.id}>
                <div><span className={`environment environment-${asset.environmentLabel}`}>{asset.environmentLabel}</span><strong>{asset.name}</strong></div>
                <p>{asset.projectName}</p>
                <code>{asset.host}:{asset.port}</code>
                <small>{asset.operatingSystem || "系统待采集"} · {asset.architecture}</small>
              </article>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
