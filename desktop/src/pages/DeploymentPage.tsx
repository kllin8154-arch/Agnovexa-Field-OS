import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { deploymentTemplates } from "../data/mock";
import { Notice, Panel } from "../components/Ui";
import { buildDeploymentExecutionDraft } from "../lib/deploymentDraft";
import {
  createDeploymentTask,
  isDesktopRuntime,
  listAssets,
  listDeploymentTasks,
  type AssetRecord,
  type DeploymentTaskRecord,
} from "../lib/repository";

const riskOptions = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export function DeploymentPage() {
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [tasks, setTasks] = useState<DeploymentTaskRecord[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [title, setTitle] = useState("");
  const [riskLevel, setRiskLevel] = useState<(typeof riskOptions)[number]>("MEDIUM");
  const [media, setMedia] = useState("");
  const [targetDirectories, setTargetDirectories] = useState("");
  const [acceptance, setAcceptance] = useState("");
  const [rollback, setRollback] = useState("");
  const [loading, setLoading] = useState(isDesktopRuntime());
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ tone: "success" | "danger" | "info"; title: string; message: string } | null>(null);

  const selectedTemplate = useMemo(() => deploymentTemplates.find((template) => template.id === selectedTemplateId), [selectedTemplateId]);
  const selectedAsset = assets.find((asset) => asset.id === assetId);

  const load = async () => {
    if (!isDesktopRuntime()) return;
    setLoading(true);
    try {
      const [nextAssets, nextTasks] = await Promise.all([listAssets(), listDeploymentTasks(8)]);
      setAssets(nextAssets);
      setTasks(nextTasks);
      setAssetId((current) => current || nextAssets[0]?.id || "");
    } catch (error) {
      setStatus({ tone: "danger", title: "任务资料读取失败", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const chooseTemplate = (templateId: string) => {
    const template = deploymentTemplates.find((item) => item.id === templateId);
    if (!template) return;
    setSelectedTemplateId(template.id);
    setTitle(template.name);
    setRiskLevel(template.risk);
  };

  const createTask = async () => {
    if (!selectedTemplate || !selectedAsset) return;
    setSaving(true);
    setStatus(null);
    try {
      const acceptanceCriteria = acceptance.split("\n").map((item) => item.trim()).filter(Boolean);
      const executionDraft = buildDeploymentExecutionDraft({
        templateId: selectedTemplate.id,
        asset: selectedAsset,
        offlineMedia: media,
        targetDirectories,
        acceptanceCriteria,
        rollbackRequirements: rollback,
        requiredInputs: selectedTemplate.requiredInputs,
      });
      await createDeploymentTask({
        projectId: selectedAsset.projectId,
        assetId: selectedAsset.id,
        title,
        taskType: selectedTemplate.id,
        environment: selectedAsset.environment,
        riskLevel,
        targetDefinition: {
          templateId: selectedTemplate.id,
          templateName: selectedTemplate.name,
          offlineMedia: media.trim(),
          targetDirectories: targetDirectories.trim(),
          requiredInputs: selectedTemplate.requiredInputs,
        },
        acceptanceCriteria,
        rollbackRequirements: rollback,
        executionDraft,
      });
      setStatus({ tone: "success", title: "任务和执行草案已创建", message: "现在进入“执行与变更”即可看到这项任务，核对命令、验证和回滚后再人工执行。" });
      setSelectedTemplateId("");
      setTitle("");
      setMedia("");
      setTargetDirectories("");
      setAcceptance("");
      setRollback("");
      await load();
    } catch (error) {
      setStatus({ tone: "danger", title: "没有创建成功", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="page-stack"><Panel title="正在准备"><div className="loading-state">正在读取项目和服务器…</div></Panel></div>;
  }

  return (
    <div className="page-stack deployment-page simple-deployment-page">
      {status && <Notice tone={status.tone} title={status.title}>{status.message}{status.tone === "success" && <div className="notice-next-action"><Link to="/changes">查看执行与变更 →</Link></div>}</Notice>}

      {assets.length === 0 ? (
        <Panel title="开始前需要完成两项准备">
          <div className="simple-onboarding-list">
            <div><span>1</span><div><strong>创建项目</strong><p>填写项目名称，其他资料可以以后再补。</p></div><Link className="secondary-button" to="/projects">去创建</Link></div>
            <div><span>2</span><div><strong>登记服务器</strong><p>填写服务器名称和地址。</p></div><Link className="primary-button" to="/assets">去登记</Link></div>
          </div>
        </Panel>
      ) : (
        <Panel title="创建部署任务" className="quick-deployment-panel">
          <div className="simple-form-intro"><strong>选择服务器和要做的事情</strong><p>系统会创建任务资料，但不会自动运行命令或连接服务器。</p></div>

          <section className="quick-deployment-section">
            <header><span>1</span><div><strong>选择服务器</strong><small>项目资料会自动带入，不用重复填写</small></div></header>
            <select className="select-input deployment-asset-select" value={assetId} onChange={(event) => setAssetId(event.target.value)} aria-label="选择服务器">
              <option value="">请选择服务器</option>
              {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.projectName} / {asset.name} / {asset.environmentLabel}</option>)}
            </select>
            {selectedAsset && <p className="auto-context-note">已自动使用“{selectedAsset.projectName}”的项目环境和技术栈。</p>}
          </section>

          <section className="quick-deployment-section">
            <header><span>2</span><div><strong>这次要做什么？</strong><small>选择最接近的工作内容</small></div></header>
            <div className="simple-template-grid">
              {deploymentTemplates.map((template) => (
                <button key={template.id} type="button" className={selectedTemplateId === template.id ? "active" : ""} onClick={() => chooseTemplate(template.id)}>
                  <span>{template.category}</span><strong>{template.name}</strong><p>{template.description}</p><small>{template.risk === "HIGH" || template.risk === "CRITICAL" ? "需要重点检查" : "常规检查"}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="quick-deployment-section">
            <header><span>3</span><div><strong>确认任务名称</strong><small>可以直接使用自动生成的名称</small></div></header>
            <label className="deployment-title-field"><span>任务名称</span><input className="text-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="选择上面的工作内容后自动填写" /></label>
          </section>

          <details className="optional-settings deployment-options">
            <summary><div><strong>安装介质、验收和回滚要求</strong><small>可选，熟悉后再填写</small></div><span>展开</span></summary>
            <div className="optional-settings-body simple-form-grid">
              <label><span>风险等级</span><select className="select-input" value={riskLevel} onChange={(event) => setRiskLevel(event.target.value as typeof riskLevel)}>{riskOptions.map((risk) => <option key={risk} value={risk}>{risk}</option>)}</select></label>
              <label><span>离线安装介质</span><textarea className="evidence-input small" value={media} onChange={(event) => setMedia(event.target.value)} placeholder="包名、版本和介质路径；不要填写密码" /></label>
              <label><span>目标目录与端口</span><textarea className="evidence-input small" value={targetDirectories} onChange={(event) => setTargetDirectories(event.target.value)} /></label>
              <label><span>验收标准（每行一项）</span><textarea className="evidence-input small" value={acceptance} onChange={(event) => setAcceptance(event.target.value)} placeholder="例如：服务正常运行" /></label>
              <label className="wide-field"><span>回滚要求</span><textarea className="evidence-input small" value={rollback} onChange={(event) => setRollback(event.target.value)} placeholder="备份位置、触发条件和允许中断时间" /></label>
            </div>
          </details>

          <footer className="simple-form-actions deployment-create-actions">
            <span>创建后仍需人工检查并执行。</span>
            <button className="primary-button" type="button" disabled={!isDesktopRuntime() || saving || !assetId || !selectedTemplateId || title.trim().length < 4} onClick={() => void createTask()}>{saving ? "正在创建…" : "创建任务"}</button>
          </footer>
        </Panel>
      )}

      {tasks.length > 0 && (
        <details className="recent-tasks-disclosure">
          <summary>最近任务（{tasks.length}）</summary>
          <div>{tasks.map((task) => <Link to="/changes" key={task.id}><div><strong>{task.title}</strong><span>{task.projectName} · {task.assetName}</span></div><small>查看 →</small></Link>)}</div>
        </details>
      )}
    </div>
  );
}
