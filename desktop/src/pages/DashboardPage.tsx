import { assets, changePlan, knowledgeEntries } from "../data/mock";
import { phaseLabels, phaseOrder } from "../lib/workflow";
import { MetricCard, Panel, RiskBadge, StatusBadge, Tag } from "../components/Ui";

export function DashboardPage() {
  const verifiedKnowledge = knowledgeEntries.filter(
    (entry) => entry.verificationStatus === "verified",
  ).length;

  return (
    <div className="page-stack">
      <div className="metrics-grid">
        <MetricCard label="待人工执行" value="3" detail="均未连接目标服务器" tone="warn" />
        <MetricCard label="环境事实冲突" value="1" detail="地图节点 OS 信息待复核" tone="danger" />
        <MetricCard label="已验证知识" value={verifiedKnowledge} detail="内部库可用于生成计划" tone="good" />
        <MetricCard label="外部待审" value="2" detail="不能进入生产命令包" />
      </div>

      <Panel
        eyebrow="CONTROLLED WORKFLOW"
        title="当前部署闭环"
        actions={<span className="badge status-reviewed">人工门禁已启用</span>}
      >
        <div className="workflow-track">
          {phaseOrder.map((phase, index) => {
            const activeIndex = phaseOrder.indexOf(changePlan.phase);
            const state = index < activeIndex ? "done" : index === activeIndex ? "active" : "future";
            return (
              <div key={phase} className={`workflow-node ${state}`}>
                <span>{index + 1}</span>
                <div>
                  <strong>{phaseLabels[phase]}</strong>
                  <small>{phase}</small>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="two-column-grid">
        <Panel eyebrow="RECENT ASSETS" title="最近服务器">
          <div className="table-list">
            {assets.map((asset) => (
              <div className="table-row" key={asset.id}>
                <div>
                  <strong>{asset.name}</strong>
                  <span>{asset.project} · {asset.environment}</span>
                </div>
                <div className="mono-cell">{asset.host}:{asset.port}</div>
                <div>
                  <span className={`snapshot snapshot-${asset.snapshotStatus}`}>{asset.snapshotStatus}</span>
                </div>
                <button className="secondary-button" type="button">查看快照</button>
              </div>
            ))}
          </div>
        </Panel>

        <Panel eyebrow="PENDING CHANGE" title={changePlan.title}>
          <div className="change-summary">
            <div className="summary-line"><span>变更单</span><strong>{changePlan.id}</strong></div>
            <div className="summary-line"><span>目标资产</span><strong>{changePlan.asset}</strong></div>
            <div className="summary-line"><span>当前阶段</span><strong>{phaseLabels[changePlan.phase]}</strong></div>
            <div className="summary-line"><span>风险等级</span><RiskBadge level={changePlan.risk} /></div>
          </div>
          <div className="tag-row">
            {changePlan.facts.slice(0, 3).map((fact) => <Tag key={fact}>{fact}</Tag>)}
          </div>
          <button className="primary-button wide" type="button">进入变更审阅</button>
        </Panel>
      </div>

      <Panel eyebrow="KNOWLEDGE HEALTH" title="知识可信度概览">
        <div className="knowledge-strip">
          {knowledgeEntries.map((entry) => (
            <article className="knowledge-mini" key={entry.id}>
              <div className="knowledge-mini-top">
                <span className={`scope scope-${entry.sourceScope}`}>
                  {entry.sourceScope === "inner" ? "KB-INNER" : "KB-PUBLIC"}
                </span>
                <StatusBadge status={entry.verificationStatus} />
              </div>
              <strong>{entry.title}</strong>
              <p>{entry.summary}</p>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}
