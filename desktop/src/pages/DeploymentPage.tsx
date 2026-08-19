import { useEffect, useMemo, useState } from "react";
import { deploymentTemplates } from "../data/mock";
import { Notice, Panel, RiskBadge, StatusBadge, Tag } from "../components/Ui";
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
  const [selectedTemplateId, setSelectedTemplateId] = useState(deploymentTemplates[0]?.id ?? "");
  const [assetId, setAssetId] = useState("");
  const [title, setTitle] = useState("");
  const [riskLevel, setRiskLevel] = useState<(typeof riskOptions)[number]>("MEDIUM");
  const [media, setMedia] = useState("");
  const [targetDirectories, setTargetDirectories] = useState("");
  const [acceptance, setAcceptance] = useState("");
  const [rollback, setRollback] = useState("");
  const [status, setStatus] = useState<{ tone: "success" | "danger" | "info"; title: string; message: string } | null>(null);

  const selectedTemplate = useMemo(
    () => deploymentTemplates.find((template) => template.id === selectedTemplateId) ?? deploymentTemplates[0],
    [selectedTemplateId],
  );
  const selectedAsset = assets.find((asset) => asset.id === assetId);

  const load = async () => {
    if (!isDesktopRuntime()) return;
    try {
      const [nextAssets, nextTasks] = await Promise.all([listAssets(), listDeploymentTasks(20)]);
      setAssets(nextAssets);
      setTasks(nextTasks);
      setAssetId((current) => current || nextAssets[0]?.id || "");
    } catch (error) {
      setStatus({ tone: "danger", title: "任务数据读取失败", message: error instanceof Error ? error.message : String(error) });
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selectedTemplate) return;
    setTitle((current) => current || selectedTemplate.name);
    setRiskLevel(selectedTemplate.risk);
  }, [selectedTemplate?.id]);

  const createTask = async () => {
    if (!selectedTemplate || !selectedAsset) {
      setStatus({ tone: "danger", title: "无法创建任务", message: "请先登记服务器资产并选择部署模板。" });
      return;
    }
    try {
      const taskId = await createDeploymentTask({
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
        acceptanceCriteria: acceptance.split("\n").map((item) => item.trim()).filter(Boolean),
        rollbackRequirements: rollback,
      });
      setStatus({ tone: "success", title: "部署任务已创建", message: `任务 ${taskId} 已进入 DEFINE 阶段。下一步补充事实并生成待人工执行计划。` });
      setTitle(selectedTemplate.name);
      setMedia("");
      setTargetDirectories("");
      setAcceptance("");
      setRollback("");
      await load();
    } catch (error) {
      setStatus({ tone: "danger", title: "任务创建失败", message: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <div className="page-stack deployment-page">
      <Notice tone="warning" title="离线环境假设已固化">
        模板不会默认生成 yum、apt、pip、npm、mvn、Docker Hub 或 GitHub 下载命令；缺少安装介质时只列出人工准备项。
      </Notice>
      {status && <Notice tone={status.tone} title={status.title}>{status.message}</Notice>}

      <div className="deployment-builder-grid">
        <Panel eyebrow="OFFLINE TEMPLATE CATALOG" title="部署与配置模板" className="template-catalog-panel">
          <div className="template-selector-list">
            {deploymentTemplates.map((template) => (
              <button key={template.id} type="button" className={`template-selector${selectedTemplateId === template.id ? " active" : ""}`} onClick={() => setSelectedTemplateId(template.id)}>
                <div><span className="template-category">{template.category}</span><RiskBadge level={template.risk} /></div>
                <strong>{template.name}</strong>
                <p>{template.description}</p>
                <div className="tag-row"><StatusBadge status={template.verifiedStatus} />{template.offlineReady && <Tag>完全离线</Tag>}</div>
              </button>
            ))}
          </div>
        </Panel>

        <Panel eyebrow="TASK DEFINITION" title="创建部署任务">
          {!isDesktopRuntime() && <Notice tone="info" title="浏览器预览不保存任务">Windows 桌面版将任务写入本地 SQLite。</Notice>}
          <div className="entity-form deployment-task-form">
            <label className="wide-field"><span>任务标题</span><input className="text-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="明确说明组件、版本和操作类型" /></label>
            <label><span>目标资产</span><select className="select-input" value={assetId} onChange={(event) => setAssetId(event.target.value)}><option value="">请选择资产</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.projectName} / {asset.name}</option>)}</select></label>
            <label><span>风险等级</span><select className="select-input" value={riskLevel} onChange={(event) => setRiskLevel(event.target.value as typeof riskLevel)}>{riskOptions.map((risk) => <option key={risk} value={risk}>{risk}</option>)}</select></label>
            <label className="wide-field"><span>离线安装介质</span><textarea className="evidence-input small" value={media} onChange={(event) => setMedia(event.target.value)} placeholder="包名、版本、介质路径、哈希和来源；不要填写密码。" /></label>
            <label className="wide-field"><span>目标目录与端口</span><textarea className="evidence-input small" value={targetDirectories} onChange={(event) => setTargetDirectories(event.target.value)} placeholder="安装、配置、数据、日志、备份目录和端口。" /></label>
            <label><span>验收标准（每行一项）</span><textarea className="evidence-input medium" value={acceptance} onChange={(event) => setAcceptance(event.target.value)} placeholder="服务 active\n端口监听正确\n健康检查通过" /></label>
            <label><span>回滚要求</span><textarea className="evidence-input medium" value={rollback} onChange={(event) => setRollback(event.target.value)} placeholder="备份、回滚触发条件和允许中断时间。" /></label>
          </div>

          {selectedTemplate && (
            <div className="template-input-summary">
              <strong>模板要求的事实</strong>
              <div className="tag-row">{selectedTemplate.requiredInputs.map((input) => <Tag key={input}>{input}</Tag>)}</div>
            </div>
          )}

          <div className="form-actions"><span>创建任务不会执行任何命令、SQL 或远程操作。</span><button className="primary-button" type="button" disabled={!isDesktopRuntime() || !assetId} onClick={() => void createTask()}>保存任务定义</button></div>
        </Panel>
      </div>

      <Panel eyebrow="LOCAL TASK REGISTER" title="最近部署任务">
        {tasks.length === 0 ? (
          <div className="empty-state compact"><div className="empty-state-mark">TS</div><h2>还没有任务记录</h2><p>通过上方表单建立第一个部署任务。</p></div>
        ) : (
          <div className="table-list">
            {tasks.map((task) => (
              <div className="table-row deployment-task-row" key={task.id}>
                <div><strong>{task.title}</strong><span>{task.projectName} · {task.assetName}</span></div>
                <div><Tag>{task.riskLevel}</Tag></div>
                <div><span className="badge status-reviewed">{task.workflowPhase}</span></div>
                <div className="task-status-cell">{task.status}</div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
