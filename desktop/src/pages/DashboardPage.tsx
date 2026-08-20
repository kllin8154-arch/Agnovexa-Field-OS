import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Notice, Panel } from "../components/Ui";
import {
  getDashboardSummary,
  isDesktopRuntime,
  listDeploymentTasks,
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
  DISCOVER: "准备资料",
  DEFINE: "完善任务",
  RETRIEVE: "查找资料",
  PLAN: "检查方案",
  APPROVE: "等待确认",
  MANUAL_EXECUTE: "等待执行",
  VERIFY: "等待验收",
  KNOWLEDGE: "已完成",
};

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [tasks, setTasks] = useState<DeploymentTaskRecord[]>([]);
  const [loading, setLoading] = useState(isDesktopRuntime());
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isDesktopRuntime()) return;
    Promise.all([getDashboardSummary(), listDeploymentTasks(4)])
      .then(([nextSummary, nextTasks]) => {
        setSummary(nextSummary);
        setTasks(nextTasks);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : String(loadError)))
      .finally(() => setLoading(false));
  }, []);

  const nextAction = useMemo(() => {
    if (summary.projects === 0) {
      return {
        step: 1,
        title: "先创建一个项目",
        description: "只需填写项目名称。操作系统、技术栈等资料都可以以后再补。",
        label: "创建项目",
        to: "/projects",
      };
    }
    if (summary.assets === 0) {
      return {
        step: 2,
        title: "接下来登记一台服务器",
        description: "填写服务器名称和地址即可。系统只保存资料，不会主动连接。",
        label: "登记服务器",
        to: "/assets",
      };
    }
    return {
      step: 3,
      title: "准备完成，现在可以开始工作",
      description: "选择一台服务器和要做的事情，系统会帮你整理任务与检查项。",
      label: "创建部署任务",
      to: "/deployments",
    };
  }, [summary.assets, summary.projects]);

  return (
    <div className="page-stack simple-home">
      {!isDesktopRuntime() && (
        <Notice tone="info" title="当前是界面预览">
          安装 Windows 桌面版后，项目和服务器资料会保存在本机。
        </Notice>
      )}
      {error && <Notice tone="danger" title="无法读取本机数据">{error}</Notice>}

      <section className="welcome-panel">
        <div className="welcome-copy">
          <span className="welcome-step">当前第 {nextAction.step} 步</span>
          <h2>{loading ? "正在查看准备情况…" : nextAction.title}</h2>
          <p>{nextAction.description}</p>
          <div className="welcome-actions">
            <Link className="primary-button" to={nextAction.to}>{nextAction.label}</Link>
            {nextAction.step === 3 && <Link className="secondary-button" to="/ai">向 AI 助手提问</Link>}
          </div>
        </div>
        <div className="setup-progress" aria-label="开始使用进度">
          <div className={summary.projects > 0 ? "complete" : "active"}>
            <span>{summary.projects > 0 ? "✓" : "1"}</span>
            <div><strong>创建项目</strong><small>{summary.projects > 0 ? `已有 ${summary.projects} 个项目` : "填写一个名称即可"}</small></div>
          </div>
          <div className={summary.assets > 0 ? "complete" : summary.projects > 0 ? "active" : ""}>
            <span>{summary.assets > 0 ? "✓" : "2"}</span>
            <div><strong>登记服务器</strong><small>{summary.assets > 0 ? `已有 ${summary.assets} 台服务器` : "名称和地址"}</small></div>
          </div>
          <div className={summary.assets > 0 ? "active" : ""}>
            <span>3</span>
            <div><strong>开始工作</strong><small>部署、排错或问 AI</small></div>
          </div>
        </div>
      </section>

      {summary.assets > 0 && (
        <section className="quick-start-section">
          <header><h2>你想做什么？</h2><p>选择一项即可开始。</p></header>
          <div className="quick-start-grid">
            <Link to="/deployments"><strong>准备部署</strong><span>选择模板，创建一个人工执行任务</span><b>开始 →</b></Link>
            <Link to="/ai"><strong>询问 AI</strong><span>自动使用当前项目资料，不用重新填写环境</span><b>提问 →</b></Link>
            <Link to="/diagnostics"><strong>检查现场环境</strong><span>生成只读检查命令，再粘贴执行结果</span><b>检查 →</b></Link>
          </div>
        </section>
      )}

      {tasks.length > 0 && (
        <Panel title="最近任务" actions={<Link className="text-button" to="/changes">查看全部</Link>} className="simple-recent-panel">
          <div className="simple-task-list">
            {tasks.map((task) => (
              <Link to="/changes" key={task.id}>
                <div><strong>{task.title}</strong><span>{task.projectName} · {task.assetName}</span></div>
                <span>{phaseLabels[task.workflowPhase] ?? "进行中"}</span>
              </Link>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
