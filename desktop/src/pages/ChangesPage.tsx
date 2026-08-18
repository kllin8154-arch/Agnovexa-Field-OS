import { useMemo, useState } from "react";
import { changePlan } from "../data/mock";
import { redactSensitiveText } from "../lib/redaction";
import { canTransition, phaseLabels } from "../lib/workflow";
import type { WorkflowPhase } from "../types";
import { CodeBlock, Notice, Panel, RiskBadge } from "../components/Ui";

export function ChangesPage() {
  const [phase, setPhase] = useState<WorkflowPhase>(changePlan.phase);
  const [reviewed, setReviewed] = useState(false);
  const [exitCode, setExitCode] = useState("");
  const [evidence, setEvidence] = useState("");
  const [humanResolution, setHumanResolution] = useState("");

  const step = changePlan.steps[0];
  const canSubmitEvidence = useMemo(
    () => phase === "MANUAL_EXECUTE" && exitCode.trim() !== "" && evidence.trim().length >= 10,
    [phase, exitCode, evidence],
  );
  const redactedEvidence = useMemo(
    () => redactSensitiveText(`${evidence}\n${humanResolution}`),
    [evidence, humanResolution],
  );

  const transition = (target: WorkflowPhase) => {
    if (canTransition(phase, target)) setPhase(target);
  };

  return (
    <div className="page-stack">
      <Notice tone="danger" title="工作台不会执行下面的命令">
        本页只负责展示事实、风险、备份、Diff、验证和回滚。命令由现场工程师复制到目标服务器手工执行，随后回传证据。
      </Notice>

      <Panel
        eyebrow={changePlan.id}
        title={changePlan.title}
        actions={
          <div className="inline-actions">
            <RiskBadge level={changePlan.risk} />
            <span className="badge status-reviewed">{phaseLabels[phase]}</span>
          </div>
        }
      >
        <div className="change-header-grid">
          <div><span>项目</span><strong>{changePlan.project}</strong></div>
          <div><span>目标资产</span><strong>{changePlan.asset}</strong></div>
          <div><span>备份路径</span><strong className="mono-cell">{changePlan.backupPath}</strong></div>
          <div><span>执行方式</span><strong>人工复制执行</strong></div>
        </div>
      </Panel>

      <div className="two-column-grid">
        <Panel eyebrow="CONFIRMED FACTS" title="已确认事实">
          <ul className="check-list">
            {changePlan.facts.map((fact) => <li key={fact}>{fact}</li>)}
          </ul>
        </Panel>
        <Panel eyebrow="MISSING FACTS" title="缺失信息">
          <ul className="warning-list">
            {changePlan.missingFacts.map((fact) => <li key={fact}>{fact}</li>)}
          </ul>
        </Panel>
      </div>

      <Panel eyebrow="CONFIG DIFF" title="配置差异">
        <CodeBlock value={changePlan.diff} label="UNIFIED DIFF · 只读预览" />
      </Panel>

      <Panel eyebrow={step.id} title={step.objective}>
        <div className="step-meta-grid">
          <div>
            <span>前置条件</span>
            <ul>{step.prerequisites.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <div>
            <span>执行后必须回传</span>
            <ul>{step.evidenceRequired.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </div>
        <CodeBlock value={step.commands} label="待人工执行命令包" />
        <div className="two-column-grid compact-grid">
          <CodeBlock value={step.verificationCommands} label="独立验证命令" />
          <CodeBlock value={step.rollbackCommands} label="人工确认后的回滚命令" />
        </div>
      </Panel>

      <Panel eyebrow="APPROVAL GATE" title="人工审阅与执行证据">
        {phase === "PLAN" && (
          <div className="approval-box">
            <label className="approval-check">
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(event) => setReviewed(event.target.checked)}
              />
              <span>
                我已核对目标主机、命令、配置 Diff、备份路径、验证方式和回滚条件。
              </span>
            </label>
            <button
              className="primary-button"
              type="button"
              disabled={!reviewed}
              onClick={() => transition("APPROVE")}
            >
              记录人工审阅
            </button>
          </div>
        )}

        {phase === "APPROVE" && (
          <div className="approval-box">
            <Notice tone="warning" title="下一步仍不会调用服务器">
              点击后只把工单状态改为“等待人工执行”，便于粘贴现场结果。
            </Notice>
            <div className="inline-actions">
              <button className="secondary-button" type="button" onClick={() => transition("PLAN")}>返回修改</button>
              <button className="primary-button" type="button" onClick={() => transition("MANUAL_EXECUTE")}>进入人工执行等待</button>
            </div>
          </div>
        )}

        {phase === "MANUAL_EXECUTE" && (
          <div className="evidence-form">
            <label className="field-label" htmlFor="exit-code">退出码</label>
            <input
              id="exit-code"
              className="text-input"
              value={exitCode}
              onChange={(event) => setExitCode(event.target.value)}
              placeholder="例如：0 或 1"
            />

            <label className="field-label" htmlFor="execution-evidence">完整 stdout / stderr / 日志</label>
            <textarea
              id="execution-evidence"
              className="evidence-input"
              value={evidence}
              onChange={(event) => setEvidence(event.target.value)}
              placeholder="粘贴完整输出、实际备份路径和验证结果"
            />

            <label className="field-label" htmlFor="human-resolution">人工已做操作（可选）</label>
            <textarea
              id="human-resolution"
              className="evidence-input small"
              value={humanResolution}
              onChange={(event) => setHumanResolution(event.target.value)}
              placeholder="若人工采用了其他有效方案，请填写实际命令、配置差异和结论"
            />

            {redactedEvidence.total > 0 && (
              <Notice tone="warning" title={`检测到 ${redactedEvidence.total} 处敏感信息`}>
                提交时将保存脱敏副本；生产 IP、口令、Token、连接凭据和私钥不会进入证据库。
              </Notice>
            )}

            <div className="inline-actions end">
              <button className="secondary-button" type="button" onClick={() => transition("APPROVE")}>返回审阅</button>
              <button
                className="primary-button"
                type="button"
                disabled={!canSubmitEvidence}
                onClick={() => transition("VERIFY")}
              >
                提交证据并进入验证
              </button>
            </div>
          </div>
        )}

        {phase === "VERIFY" && (
          <div className="verification-board">
            <Notice tone="success" title="证据已收集，尚未宣布部署成功">
              下一步需要分别核对文件/包、服务/进程、网络/端口和业务功能；所有验收项有证据后才能进入知识沉淀。
            </Notice>
            <div className="verification-grid">
              {[
                ["文件与配置", "待核对备份和 hosts 内容"],
                ["解析链路", "待核对 getent 结果"],
                ["网络连通", "待核对 ping 与路由"],
                ["业务功能", "待补充应用健康检查"],
              ].map(([title, detail]) => (
                <div key={title}><span>{title}</span><strong>{detail}</strong></div>
              ))}
            </div>
            <button className="secondary-button" type="button" onClick={() => transition("MANUAL_EXECUTE")}>补充执行证据</button>
          </div>
        )}
      </Panel>
    </div>
  );
}
