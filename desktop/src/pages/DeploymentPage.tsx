import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
type WizardStep = 1 | 2 | 3 | 4;

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
  const [step, setStep] = useState<WizardStep>(1);
  const [loading, setLoading] = useState(isDesktopRuntime());
  const [status, setStatus] = useState<{ tone: "success" | "danger" | "info"; title: string; message: string } | null>(null);

  const selectedTemplate = useMemo(
    () => deploymentTemplates.find((template) => template.id === selectedTemplateId) ?? deploymentTemplates[0],
    [selectedTemplateId],
  );
  const selectedAsset = assets.find((asset) => asset.id === assetId);

  const load = async () => {
    if (!isDesktopRuntime()) return;
    setLoading(true);
    try {
      const [nextAssets, nextTasks] = await Promise.all([listAssets(), listDeploymentTasks(20)]);
      setAssets(nextAssets);
      setTasks(nextTasks);
      setAssetId((current) => current || nextAssets[0]?.id || "");
    } catch (error) {
      setStatus({ tone: "danger", title: "任务数据读取失败", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
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
      setStep(1);
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

      <nav className="deployment-steps" aria-label="部署任务创建步骤">
        {[
          [1, "选择项目资产", "确定任务归属"],
          [2, "选择模板", "匹配操作场景"],
          [3, "补充要求", "填写验收与回滚"],
          [4, "核对保存", "生成任务定义"],
        ].map(([value, label, hint]) => {
          const itemStep = value as WizardStep;
          const disabled = (itemStep > 1 && !assetId) || (itemStep > 2 && !selectedTemplate) || (itemStep === 4 && !title.trim());
          return (
            <button key={value} type="button" className={`${step === itemStep ? "active" : ""}${step > itemStep ? " complete" : ""}`} disabled={disabled} onClick={() => setStep(itemStep)}>
              <span>{value}</span><div><strong>{label}</strong><small>{hint}</small></div>
            </button>
          );
        })}
      </nav>

      {loading ? (
        <Panel eyebrow="LOADING CONTEXT" title="正在读取项目资产">
          <div className="loading-state">正在加载项目、服务器资产与最近任务…</div>
        </Panel>
      ) : assets.length === 0 ? (
        <Panel eyebrow="START HERE" title="开始第一个部署任务" className="deployment-onboarding">
          <div className="onboarding-flow">
            <div><span>1</span><strong>建立项目档案</strong><p>记录项目范围、国产化环境、技术栈和现场约束。</p><Link className="secondary-button" to="/projects">前往项目中心</Link></div>
            <div><span>2</span><strong>登记服务器资产</strong><p>把服务器归入项目，登记环境、地址和版本事实。</p><Link className="secondary-button" to="/assets">前往服务器资产</Link></div>
            <div><span>3</span><strong>返回创建任务</strong><p>选择资产和离线模板，补充验收、回滚要求后保存。</p><button className="secondary-button" type="button" disabled>等待资产登记</button></div>
          </div>
          <Notice tone="info" title="当前缺少目标资产">部署任务必须归属于已登记的项目资产，因此暂不展示后续大表单。完成前两步后返回本页即可继续。</Notice>
        </Panel>
      ) : (
        <Panel eyebrow={`STEP 0${step}`} title={["选择任务所属项目与资产", "选择部署与配置模板", "补充任务边界与验收要求", "核对并保存任务定义"][step - 1]} className="deployment-wizard-panel">
          {!isDesktopRuntime() && <Notice tone="info" title="浏览器预览不保存任务">Windows 桌面版将任务写入本地 SQLite。</Notice>}

          {step === 1 && (
            <div className="wizard-step-body asset-selection-step">
              <div className="wizard-intro"><strong>从已登记资产开始</strong><p>项目上下文会随资产自动带入，不需要再次填写操作系统、技术栈或现场约束。</p></div>
              <label className="wizard-primary-field"><span>项目 / 目标资产</span><select className="select-input" value={assetId} onChange={(event) => setAssetId(event.target.value)}><option value="">请选择资产</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.projectName} / {asset.name}</option>)}</select></label>
              {selectedAsset && <div className="selected-context-card"><span>已带入项目上下文</span><strong>{selectedAsset.projectName}</strong><p>{selectedAsset.name} · {selectedAsset.environmentLabel} · {selectedAsset.host || "地址待补充"}</p></div>}
              <div className="wizard-actions"><Link className="text-button" to="/assets">管理资产</Link><button className="primary-button" type="button" disabled={!assetId} onClick={() => setStep(2)}>下一步：选择模板</button></div>
            </div>
          )}

          {step === 2 && (
            <div className="wizard-step-body">
              <div className="wizard-intro"><strong>这次要完成什么工作？</strong><p>模板只生成供人工审阅的步骤、检查项和回滚框架，不会连接或操作目标服务器。</p></div>
              <div className="template-selector-list wizard-template-grid">
                {deploymentTemplates.map((template) => (
                  <button key={template.id} type="button" className={`template-selector${selectedTemplateId === template.id ? " active" : ""}`} onClick={() => { setSelectedTemplateId(template.id); setTitle(template.name); setRiskLevel(template.risk); }}>
                    <div><span className="template-category">{template.category}</span><RiskBadge level={template.risk} /></div>
                    <strong>{template.name}</strong><p>{template.description}</p>
                    <div className="tag-row"><StatusBadge status={template.verifiedStatus} />{template.offlineReady && <Tag>完全离线</Tag>}</div>
                  </button>
                ))}
              </div>
              <div className="wizard-actions"><button className="secondary-button" type="button" onClick={() => setStep(1)}>上一步</button><button className="primary-button" type="button" disabled={!selectedTemplate} onClick={() => setStep(3)}>下一步：补充要求</button></div>
            </div>
          )}

          {step === 3 && (
            <div className="wizard-step-body">
              <div className="entity-form deployment-task-form wizard-task-form">
                <label><span>任务标题</span><input className="text-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="明确说明组件、版本和操作类型" /></label>
                <label><span>风险等级</span><select className="select-input" value={riskLevel} onChange={(event) => setRiskLevel(event.target.value as typeof riskLevel)}>{riskOptions.map((risk) => <option key={risk} value={risk}>{risk}</option>)}</select></label>
                <label><span>离线安装介质</span><textarea className="evidence-input small" value={media} onChange={(event) => setMedia(event.target.value)} placeholder="包名、版本、介质路径、哈希和来源；不要填写密码。" /></label>
                <label><span>目标目录与端口</span><textarea className="evidence-input small" value={targetDirectories} onChange={(event) => setTargetDirectories(event.target.value)} placeholder="安装、配置、数据、日志、备份目录和端口。" /></label>
                <label><span>验收标准（每行一项）</span><textarea className="evidence-input medium" value={acceptance} onChange={(event) => setAcceptance(event.target.value)} placeholder="服务 active\n端口监听正确\n健康检查通过" /></label>
                <label><span>回滚要求</span><textarea className="evidence-input medium" value={rollback} onChange={(event) => setRollback(event.target.value)} placeholder="备份、回滚触发条件和允许中断时间。" /></label>
              </div>
              {selectedTemplate && <div className="template-input-summary"><strong>模板要求的事实</strong><div className="tag-row">{selectedTemplate.requiredInputs.map((input) => <Tag key={input}>{input}</Tag>)}</div></div>}
              <div className="wizard-actions"><button className="secondary-button" type="button" onClick={() => setStep(2)}>上一步</button><button className="primary-button" type="button" disabled={!title.trim()} onClick={() => setStep(4)}>下一步：核对任务</button></div>
            </div>
          )}

          {step === 4 && selectedAsset && selectedTemplate && (
            <div className="wizard-step-body">
              <div className="deployment-review-grid">
                <div><span>项目</span><strong>{selectedAsset.projectName}</strong></div>
                <div><span>目标资产</span><strong>{selectedAsset.name}</strong></div>
                <div><span>任务模板</span><strong>{selectedTemplate.name}</strong></div>
                <div><span>风险等级</span><RiskBadge level={riskLevel} /></div>
                <div className="wide"><span>任务标题</span><strong>{title}</strong></div>
                <div><span>验收项</span><strong>{acceptance.split("\n").filter((item) => item.trim()).length || "待后续补充"}</strong></div>
                <div><span>回滚要求</span><strong>{rollback.trim() ? "已填写" : "待后续补充"}</strong></div>
              </div>
              <Notice tone="warning" title="保存不等于执行">系统只创建本地任务定义，不会运行命令、SQL、SSH 或远程操作。实际执行前仍需完成人工审阅。</Notice>
              <div className="wizard-actions"><button className="secondary-button" type="button" onClick={() => setStep(3)}>返回修改</button><button className="primary-button" type="button" disabled={!isDesktopRuntime()} onClick={() => void createTask()}>保存任务定义</button></div>
            </div>
          )}
        </Panel>
      )}

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
