import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CodeBlock, Notice, Panel, RiskBadge, Tag } from "../components/Ui";
import { redactSensitiveText } from "../lib/redaction";
import {
  approveManualPackage,
  createManualPackage,
  isDesktopRuntime,
  listAssets,
  listManualPackages,
  recordManualExecutionEvidence,
  type AssetRecord,
  type ManualPackageRecord,
} from "../lib/repository";
import type { RiskLevel } from "../types";

const PENDING_ERROR_KEY = "agnovexa.opsdesk.pendingErrorContext";
const RISK_OPTIONS: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const EMPTY_FORM = {
  assetId: "",
  title: "",
  taskType: "command" as "command" | "sql" | "config",
  riskLevel: "MEDIUM" as RiskLevel,
  objective: "",
  commands: "",
  expectedResult: "",
  validationCommands: "",
  rollbackCommands: "",
};

export function ChangesPage() {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [packages, setPackages] = useState<ManualPackageRecord[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [reviewer, setReviewer] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [executor, setExecutor] = useState("");
  const [actualCommand, setActualCommand] = useState("");
  const [exitCode, setExitCode] = useState("");
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [humanActions, setHumanActions] = useState("");
  const [status, setStatus] = useState<{ tone: "success" | "danger" | "warning" | "info"; title: string; message: string } | null>(null);

  const selected = useMemo(
    () => packages.find((item) => item.taskId === selectedTaskId) ?? packages[0],
    [packages, selectedTaskId],
  );
  const selectedAsset = assets.find((asset) => asset.id === form.assetId);
  const evidenceRedacted = useMemo(
    () => redactSensitiveText([actualCommand, stdout, stderr, humanActions].join("\n")),
    [actualCommand, stdout, stderr, humanActions],
  );

  const load = async () => {
    if (!isDesktopRuntime()) return;
    try {
      const [nextAssets, nextPackages] = await Promise.all([listAssets(), listManualPackages()]);
      setAssets(nextAssets);
      setPackages(nextPackages);
      setForm((current) => ({ ...current, assetId: current.assetId || nextAssets[0]?.id || "" }));
      setSelectedTaskId((current) => current || nextPackages[0]?.taskId || "");
    } catch (error) {
      setStatus({ tone: "danger", title: "变更中心读取失败", message: error instanceof Error ? error.message : String(error) });
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selected) return;
    setActualCommand(selected.commands);
    setReviewed(false);
    setExitCode("");
    setStdout("");
    setStderr("");
    setHumanActions("");
  }, [selected?.taskId]);

  const createPackage = async () => {
    if (!selectedAsset) {
      setStatus({ tone: "danger", title: "无法创建执行包", message: "请先选择服务器资产。" });
      return;
    }
    try {
      const created = await createManualPackage({
        projectId: selectedAsset.projectId,
        assetId: selectedAsset.id,
        title: form.title,
        taskType: form.taskType,
        environment: selectedAsset.environment,
        riskLevel: form.riskLevel,
        objective: form.objective,
        commands: form.commands,
        expectedResult: form.expectedResult,
        validationCommands: form.validationCommands,
        rollbackCommands: form.rollbackCommands,
      });
      setForm((current) => ({ ...EMPTY_FORM, assetId: current.assetId }));
      setShowCreate(false);
      setStatus({ tone: "success", title: "人工执行包已创建", message: "执行包处于 PLAN 阶段，必须完成人工审阅后才能记录现场执行证据。" });
      await load();
      setSelectedTaskId(created.taskId);
    } catch (error) {
      setStatus({ tone: "danger", title: "执行包创建失败", message: error instanceof Error ? error.message : String(error) });
    }
  };

  const approve = async () => {
    if (!selected) return;
    if (!reviewed) {
      setStatus({ tone: "warning", title: "尚未完成人工核对", message: "请确认目标、命令/SQL、验证和回滚均已审阅。" });
      return;
    }
    try {
      await approveManualPackage({ taskId: selected.taskId, planId: selected.planId, reviewer });
      setStatus({ tone: "success", title: "人工审阅已记录", message: "任务已进入 MANUAL_EXECUTE。程序仍不会执行任何命令或 SQL。" });
      await load();
      setSelectedTaskId(selected.taskId);
    } catch (error) {
      setStatus({ tone: "danger", title: "审阅记录失败", message: error instanceof Error ? error.message : String(error) });
    }
  };

  const submitEvidence = async () => {
    if (!selected) return;
    const parsedExitCode = Number(exitCode);
    if (!Number.isInteger(parsedExitCode)) {
      setStatus({ tone: "danger", title: "执行证据不完整", message: "退出码必须是整数。" });
      return;
    }
    try {
      await recordManualExecutionEvidence({
        taskId: selected.taskId,
        stepId: selected.stepId,
        executor,
        actualCommandRedacted: redactSensitiveText(actualCommand).text,
        exitCode: parsedExitCode,
        stdoutRedacted: redactSensitiveText(stdout).text,
        stderrRedacted: redactSensitiveText(stderr).text,
        humanActions: redactSensitiveText(humanActions).text,
      });
      setStatus({
        tone: parsedExitCode === 0 ? "success" : "danger",
        title: parsedExitCode === 0 ? "执行证据已记录" : "执行失败已记录",
        message: parsedExitCode === 0
          ? "任务已进入 VERIFY，仍需独立核对文件、服务、端口和业务功能。"
          : "任务保留在 MANUAL_EXECUTE，可将脱敏后的错误上下文交给 AI 继续排查。",
      });
      await load();
      setSelectedTaskId(selected.taskId);
    } catch (error) {
      setStatus({ tone: "danger", title: "证据保存失败", message: error instanceof Error ? error.message : String(error) });
    }
  };

  const sendFailureToAi = () => {
    if (!selected) return;
    window.sessionStorage.setItem(PENDING_ERROR_KEY, JSON.stringify({
      task: `分析人工执行包“${selected.title}”失败原因，并给出下一轮人工排查、修复、验证和回滚建议。`,
      commandOrSql: actualCommand || selected.commands,
      exitCode,
      executionOutput: [stdout, stderr, humanActions].filter(Boolean).join("\n\n"),
      environment: [`项目：${selected.projectName}`, `目标资产：${selected.assetName}`, `风险：${selected.riskLevel}`].join("\n"),
      expectedResult: selected.expectedResult,
    }));
    navigate("/ai");
  };

  const executionFailed = Number.isInteger(Number(exitCode)) && exitCode.trim() !== "" && Number(exitCode) !== 0;

  return (
    <div className="page-stack changes-page">
      <Notice tone="danger" title="变更中心不会执行命令或 SQL">
        本页只生成、审阅、复制和归档人工执行包。现场工程师在目标服务器或数据库客户端手工执行，并回填退出码、stdout、stderr 和验证证据。
      </Notice>
      {status && <Notice tone={status.tone} title={status.title}>{status.message}</Notice>}

      <Panel
        eyebrow="MANUAL EXECUTION REGISTER"
        title="人工执行包"
        actions={<button className="primary-button" type="button" disabled={!isDesktopRuntime() || assets.length === 0} onClick={() => setShowCreate((value) => !value)}>新建命令 / SQL 包</button>}
      >
        {showCreate && (
          <div className="entity-form change-package-form">
            <label><span>目标资产</span><select className="select-input" value={form.assetId} onChange={(event) => setForm((current) => ({ ...current, assetId: event.target.value }))}>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.projectName} / {asset.name}</option>)}</select></label>
            <label><span>执行包类型</span><select className="select-input" value={form.taskType} onChange={(event) => setForm((current) => ({ ...current, taskType: event.target.value as typeof form.taskType }))}><option value="command">Shell 命令</option><option value="sql">SQL</option><option value="config">配置变更</option></select></label>
            <label className="wide-field"><span>标题</span><input className="text-input" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="例如：PostgreSQL 16 离线初始化与验证" /></label>
            <label><span>风险等级</span><select className="select-input" value={form.riskLevel} onChange={(event) => setForm((current) => ({ ...current, riskLevel: event.target.value as RiskLevel }))}>{RISK_OPTIONS.map((risk) => <option key={risk}>{risk}</option>)}</select></label>
            <label><span>目标</span><input className="text-input" value={form.objective} onChange={(event) => setForm((current) => ({ ...current, objective: event.target.value }))} placeholder="本步骤需要达到什么结果" /></label>
            <label className="wide-field"><span>待人工执行命令 / SQL</span><textarea className="evidence-input command-input" value={form.commands} onChange={(event) => setForm((current) => ({ ...current, commands: event.target.value }))} /></label>
            <label className="wide-field"><span>预期结果</span><textarea className="evidence-input small" value={form.expectedResult} onChange={(event) => setForm((current) => ({ ...current, expectedResult: event.target.value }))} /></label>
            <label><span>独立验证命令 / 步骤</span><textarea className="evidence-input medium" value={form.validationCommands} onChange={(event) => setForm((current) => ({ ...current, validationCommands: event.target.value }))} /></label>
            <label><span>回滚命令 / 不可回滚说明</span><textarea className="evidence-input medium" value={form.rollbackCommands} onChange={(event) => setForm((current) => ({ ...current, rollbackCommands: event.target.value }))} /></label>
            <div className="form-actions wide-field"><span>保存后进入 PLAN，不会自动执行。</span><button className="secondary-button" type="button" onClick={() => setShowCreate(false)}>取消</button><button className="primary-button" type="button" onClick={() => void createPackage()}>保存执行包</button></div>
          </div>
        )}

        {packages.length === 0 ? (
          <div className="empty-state compact"><div className="empty-state-mark">EX</div><h2>还没有人工执行包</h2><p>建立命令、SQL 或配置变更包后，系统会强制保留审阅、证据和回滚闭环。</p></div>
        ) : (
          <div className="package-selector-list">
            {packages.map((item) => (
              <button key={item.taskId} type="button" className={`package-selector${selected?.taskId === item.taskId ? " active" : ""}`} onClick={() => setSelectedTaskId(item.taskId)}>
                <div><strong>{item.title}</strong><span>{item.projectName} · {item.assetName}</span></div>
                <Tag>{item.phase}</Tag>
              </button>
            ))}
          </div>
        )}
      </Panel>

      {selected && (
        <>
          <Panel eyebrow={selected.taskId} title={selected.title} actions={<div className="inline-actions"><RiskBadge level={selected.riskLevel as RiskLevel} /><span className="badge status-reviewed">{selected.phase}</span></div>}>
            <div className="change-header-grid"><div><span>项目</span><strong>{selected.projectName}</strong></div><div><span>目标资产</span><strong>{selected.assetName}</strong></div><div><span>目标</span><strong>{selected.objective}</strong></div><div><span>执行方式</span><strong>工程师人工执行</strong></div></div>
          </Panel>

          <Panel eyebrow="COMMAND / SQL PACKAGE" title="待人工执行内容">
            <CodeBlock value={selected.commands} label="待人工执行 · 不会自动运行" />
            <div className="two-column-grid compact-grid"><CodeBlock value={selected.validationCommands} label="独立验证命令 / 步骤" /><CodeBlock value={selected.rollbackCommands} label="回滚命令 / 说明" /></div>
          </Panel>

          <Panel eyebrow="APPROVAL AND EVIDENCE" title="人工审阅与现场证据">
            {selected.phase === "PLAN" ? (
              <div className="approval-box">
                <label><span className="field-label">审阅人员</span><input className="text-input" value={reviewer} onChange={(event) => setReviewer(event.target.value)} placeholder="姓名或工号" /></label>
                <label className="approval-check"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} /><span>我已核对目标资产、命令/SQL、预期结果、验证方式和回滚条件；内容与现场环境事实一致。</span></label>
                <div className="inline-actions end"><button className="primary-button" type="button" disabled={!reviewed || reviewer.trim().length < 2} onClick={() => void approve()}>记录审阅并进入人工执行等待</button></div>
              </div>
            ) : (
              <div className="evidence-form">
                <div className="two-column-grid compact-grid"><label><span className="field-label">执行人员</span><input className="text-input" value={executor} onChange={(event) => setExecutor(event.target.value)} placeholder="姓名或工号" /></label><label><span className="field-label">退出码</span><input className="text-input" value={exitCode} onChange={(event) => setExitCode(event.target.value)} placeholder="0、1、127…" /></label></div>
                <label><span className="field-label">实际执行命令 / SQL</span><textarea className="evidence-input command-input" value={actualCommand} onChange={(event) => setActualCommand(event.target.value)} /></label>
                <div className="two-column-grid compact-grid"><label><span className="field-label">stdout</span><textarea className="evidence-input medium" value={stdout} onChange={(event) => setStdout(event.target.value)} /></label><label><span className="field-label">stderr / 报错</span><textarea className="evidence-input medium" value={stderr} onChange={(event) => setStderr(event.target.value)} /></label></div>
                <label><span className="field-label">人工已做操作</span><textarea className="evidence-input small" value={humanActions} onChange={(event) => setHumanActions(event.target.value)} placeholder="记录绕行方案、额外检查和实际修改。" /></label>
                {evidenceRedacted.total > 0 && <Notice tone="warning" title={`检测到 ${evidenceRedacted.total} 处敏感信息`}>保存和发送给 AI 时使用脱敏副本；当前输入框中的原始文本不会进入知识库。</Notice>}
                {executionFailed && <Notice tone="danger" title="当前执行失败，不能进入验证">保存失败证据后任务仍停留在 MANUAL_EXECUTE，可继续交给 AI 排错，但 AI 仍不会执行修复命令。</Notice>}
                <div className="inline-actions end">{executionFailed && <button className="secondary-button" type="button" onClick={sendFailureToAi}>将报错上下文交给 AI</button>}<button className="primary-button" type="button" disabled={executor.trim().length < 2 || exitCode.trim() === ""} onClick={() => void submitEvidence()}>保存人工执行证据</button></div>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
