import { useEffect, useMemo, useState } from "react";
import { Notice, Panel, RiskBadge, Tag } from "../components/Ui";
import { isDesktopRuntime } from "../lib/repository";
import {
  buildVerificationMarkdown,
  closeVerificationTask,
  listVerificationTasks,
  loadVerificationWorkspace,
  returnVerificationToManualExecution,
  saveVerificationLayer,
  type VerificationTask,
  type VerificationWorkspace,
} from "../lib/verificationRepository";
import {
  VERIFICATION_CATEGORIES,
  VERIFICATION_CATEGORY_META,
  evaluateVerificationGate,
  verificationCompletion,
  type VerificationCategory,
  type VerificationLayerStatus,
} from "../lib/verificationPolicy";
import { downloadTextFile } from "../lib/workspaceBackup";

type PageStatus = {
  tone: "success" | "danger" | "warning" | "info";
  title: string;
  message: string;
};

const STATUS_OPTIONS: Array<{
  value: VerificationLayerStatus;
  label: string;
}> = [
  { value: "pending", label: "未验证" },
  { value: "passed", label: "验证通过" },
  { value: "failed", label: "验证失败" },
  { value: "human_exempt", label: "人工豁免" },
];

function statusLabel(value: VerificationLayerStatus): string {
  return STATUS_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

export function VerificationPage() {
  const desktop = isDesktopRuntime();
  const [tasks, setTasks] = useState<VerificationTask[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [workspace, setWorkspace] = useState<VerificationWorkspace | null>(null);
  const [operator, setOperator] = useState(
    () => window.localStorage.getItem("agnovexa.opsdesk.operator") ?? "",
  );
  const [closureSummary, setClosureSummary] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [status, setStatus] = useState<PageStatus | null>(null);
  const [busy, setBusy] = useState("");

  const rememberOperator = (value: string) => {
    setOperator(value);
    window.localStorage.setItem("agnovexa.opsdesk.operator", value);
  };

  const loadTasks = async () => {
    if (!desktop) return;
    const rows = await listVerificationTasks();
    setTasks(rows);
    setSelectedId((current) =>
      rows.some((task) => task.id === current) ? current : rows[0]?.id ?? "",
    );
  };

  const loadWorkspace = async (taskId: string) => {
    if (!desktop || !taskId) {
      setWorkspace(null);
      return;
    }
    setBusy("load");
    try {
      setWorkspace(await loadVerificationWorkspace(taskId));
    } catch (error) {
      setStatus({
        tone: "danger",
        title: "验收数据读取失败",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy("");
    }
  };

  useEffect(() => {
    void loadTasks().catch((error) =>
      setStatus({
        tone: "danger",
        title: "验收任务读取失败",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }, []);

  useEffect(() => {
    void loadWorkspace(selectedId);
    setClosureSummary("");
    setReturnReason("");
  }, [selectedId]);

  const gate = useMemo(
    () => (workspace ? evaluateVerificationGate(workspace.layers) : null),
    [workspace],
  );
  const completion = useMemo(
    () => (workspace ? verificationCompletion(workspace.layers) : 0),
    [workspace],
  );
  const closed = workspace
    ? ["verified", "human_exempt", "archived"].includes(workspace.task.status)
    : false;

  const updateLayer = (
    category: VerificationCategory,
    patch: Partial<VerificationWorkspace["layers"][VerificationCategory]>,
  ) => {
    setWorkspace((current) =>
      current
        ? {
            ...current,
            layers: {
              ...current.layers,
              [category]: { ...current.layers[category], ...patch },
            },
          }
        : current,
    );
  };

  const saveLayer = async (category: VerificationCategory) => {
    if (!workspace) return;
    const layer = workspace.layers[category];
    setBusy(`save-${category}`);
    setStatus(null);
    try {
      await saveVerificationLayer({
        taskId: workspace.task.id,
        category,
        status: layer.status,
        evidence: layer.evidence,
        exemptionReason: layer.exemptionReason,
        successCriteria: layer.successCriteria,
        verifier: operator,
      });
      setStatus({
        tone: layer.status === "failed" ? "danger" : "success",
        title: `${VERIFICATION_CATEGORY_META[category].label}已记录`,
        message:
          layer.status === "failed"
            ? "失败证据已保留，任务不能关单；请退回人工执行或补充修复后重新验证。"
            : "已保存脱敏后的人工验证证据。该结果不会触发任何服务器或数据库操作。",
      });
      await Promise.all([loadTasks(), loadWorkspace(workspace.task.id)]);
    } catch (error) {
      setStatus({
        tone: "danger",
        title: "验收证据保存失败",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy("");
    }
  };

  const closeTask = async () => {
    if (!workspace) return;
    setBusy("close");
    setStatus(null);
    try {
      const overallStatus = await closeVerificationTask({
        taskId: workspace.task.id,
        reviewer: operator,
        summary: closureSummary,
      });
      setStatus({
        tone: "success",
        title: "四层验收已关单",
        message:
          overallStatus === "human_exempt"
            ? "任务已进入 KNOWLEDGE，但包含人工豁免；部署报告和知识沉淀必须保留豁免原因。"
            : "四层验收均有证据通过，任务已进入 KNOWLEDGE，可继续整理报告与知识条目。",
      });
      await Promise.all([loadTasks(), loadWorkspace(workspace.task.id)]);
    } catch (error) {
      setStatus({
        tone: "danger",
        title: "无法完成验收关单",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy("");
    }
  };

  const returnTask = async () => {
    if (!workspace) return;
    setBusy("return");
    setStatus(null);
    try {
      await returnVerificationToManualExecution({
        taskId: workspace.task.id,
        reviewer: operator,
        reason: returnReason,
      });
      setStatus({
        tone: "warning",
        title: "任务已退回人工执行",
        message:
          "任务返回 MANUAL_EXECUTE。工程师修复后必须重新回填实际命令、退出码与证据，再次进入四层验收。",
      });
      await Promise.all([loadTasks(), loadWorkspace(workspace.task.id)]);
    } catch (error) {
      setStatus({
        tone: "danger",
        title: "任务退回失败",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy("");
    }
  };

  const exportRecord = () => {
    if (!workspace) return;
    const safeTitle = workspace.task.title
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, "-")
      .slice(0, 60);
    downloadTextFile(
      `${safeTitle || "OpsDesk"}-${workspace.task.id}-verification.md`,
      buildVerificationMarkdown(workspace),
      "text/markdown;charset=utf-8",
    );
  };

  return (
    <div className="page-stack verification-page">
      <Notice tone="info" title="验收中心只记录人工证据">
        文件、服务、网络和业务验证均由现场工程师在目标环境人工完成。本页不连接服务器、数据库、GeoServer 或 Shell，只保存脱敏证据、关单判断与审计事件。
      </Notice>

      {status && (
        <Notice tone={status.tone} title={status.title}>
          {status.message}
        </Notice>
      )}

      {!desktop && (
        <Notice tone="warning" title="浏览器预览不可写入">
          请运行 Windows 桌面版后使用验收中心；浏览器预览不会伪造已保存的验收数据。
        </Notice>
      )}

      <div className="verification-layout">
        <Panel
          eyebrow="VERIFICATION QUEUE"
          title="待验收与历史任务"
          actions={<Tag>{tasks.length} 项</Tag>}
        >
          {tasks.length === 0 ? (
            <div className="empty-state compact">
              <div className="empty-state-mark">V</div>
              <h2>暂无可验收任务</h2>
              <p>人工执行退出码为 0 后，任务才会进入 VERIFY。</p>
            </div>
          ) : (
            <div className="verification-task-list">
              {tasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  className={`verification-task-item${
                    selectedId === task.id ? " active" : ""
                  }`}
                  onClick={() => setSelectedId(task.id)}
                >
                  <div>
                    <strong>{task.title}</strong>
                    <span>
                      {task.projectName} · {task.assetName}
                    </span>
                  </div>
                  <div>
                    <Tag>{task.workflowPhase}</Tag>
                    <small>{task.status}</small>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Panel>

        <div className="verification-main">
          {!workspace ? (
            <Panel eyebrow="FOUR-LAYER ACCEPTANCE" title="选择一个任务">
              <div className="empty-state compact">
                <div className="empty-state-mark">4L</div>
                <h2>{busy === "load" ? "正在读取验收证据…" : "尚未选择任务"}</h2>
              </div>
            </Panel>
          ) : (
            <>
              <Panel
                eyebrow={workspace.task.id}
                title={workspace.task.title}
                actions={
                  <div className="inline-actions">
                    <RiskBadge level={workspace.task.riskLevel as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"} />
                    <Tag>{completion}%</Tag>
                  </div>
                }
              >
                <div className="verification-task-summary">
                  <div>
                    <span>项目</span>
                    <strong>{workspace.task.projectName}</strong>
                  </div>
                  <div>
                    <span>目标资产</span>
                    <strong>{workspace.task.assetName}</strong>
                  </div>
                  <div>
                    <span>环境</span>
                    <strong>{workspace.task.environment}</strong>
                  </div>
                  <div>
                    <span>任务状态</span>
                    <strong>{workspace.task.status}</strong>
                  </div>
                </div>
                <div className="verification-progress">
                  <span style={{ width: `${completion}%` }} />
                </div>
              </Panel>

              <Panel eyebrow="HUMAN VERIFIER" title="统一验证人员">
                <label className="verification-operator">
                  <span>姓名或工号</span>
                  <input
                    className="text-input"
                    name="verificationOperator"
                    value={operator}
                    onChange={(event) => rememberOperator(event.target.value)}
                    placeholder="用于验收证据和关单审计"
                  />
                </label>
              </Panel>

              <div className="verification-layer-grid">
                {VERIFICATION_CATEGORIES.map((category, index) => {
                  const layer = workspace.layers[category];
                  const meta = VERIFICATION_CATEGORY_META[category];
                  return (
                    <article
                      className={`verification-layer-card status-${layer.status}`}
                      key={category}
                    >
                      <header>
                        <span>{index + 1}</span>
                        <div>
                          <h3>{meta.label}</h3>
                          <p>{meta.description}</p>
                        </div>
                        <Tag>{statusLabel(layer.status)}</Tag>
                      </header>

                      <label>
                        <span>验收状态</span>
                        <select
                          className="select-input"
                          name={`verificationStatus-${category}`}
                          value={layer.status}
                          disabled={closed || busy !== ""}
                          onChange={(event) =>
                            updateLayer(category, {
                              status: event.target.value as VerificationLayerStatus,
                            })
                          }
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        <span>成功标准</span>
                        <textarea
                          className="evidence-input small"
                          name={`verificationCriteria-${category}`}
                          value={layer.successCriteria}
                          disabled={closed || busy !== ""}
                          onChange={(event) =>
                            updateLayer(category, {
                              successCriteria: event.target.value,
                            })
                          }
                        />
                      </label>

                      <label>
                        <span>人工验证证据</span>
                        <textarea
                          className="evidence-input medium"
                          name={`verificationEvidence-${category}`}
                          value={layer.evidence}
                          disabled={closed || busy !== ""}
                          onChange={(event) =>
                            updateLayer(category, {
                              evidence: event.target.value,
                            })
                          }
                          placeholder="粘贴脱敏后的版本、状态、日志、接口返回或人工验收结论。"
                        />
                      </label>

                      {layer.status === "human_exempt" && (
                        <label>
                          <span>人工豁免原因与责任说明</span>
                          <textarea
                            className="evidence-input small"
                            name={`verificationExemption-${category}`}
                            value={layer.exemptionReason}
                            disabled={closed || busy !== ""}
                            onChange={(event) =>
                              updateLayer(category, {
                                exemptionReason: event.target.value,
                              })
                            }
                          />
                        </label>
                      )}

                      <footer>
                        <small>
                          {layer.recordedAt
                            ? `${layer.verifier} · ${layer.recordedAt}`
                            : "尚未保存"}
                        </small>
                        <button
                          className="secondary-button"
                          type="button"
                          disabled={closed || busy !== ""}
                          onClick={() => void saveLayer(category)}
                        >
                          {busy === `save-${category}` ? "正在保存…" : "保存本层证据"}
                        </button>
                      </footer>
                    </article>
                  );
                })}
              </div>

              <Panel
                eyebrow="CLOSURE GATE"
                title="验收关单"
                actions={
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={exportRecord}
                  >
                    导出验收记录
                  </button>
                }
              >
                <div className="verification-gate-grid">
                  <div className={`verification-gate-state ${gate?.canClose ? "ready" : "blocked"}`}>
                    <span>{gate?.canClose ? "READY" : "BLOCKED"}</span>
                    <strong>
                      {gate?.canClose ? "满足关单条件" : "仍有验收阻断项"}
                    </strong>
                    <p>
                      {gate?.issues.length
                        ? gate.issues.join("；")
                        : `综合状态：${gate?.overallStatus ?? "pending"}`}
                    </p>
                  </div>

                  <label>
                    <span>关单结论</span>
                    <textarea
                      className="evidence-input small"
                      name="verificationClosureSummary"
                      value={closureSummary}
                      disabled={closed || busy !== ""}
                      onChange={(event) => setClosureSummary(event.target.value)}
                      placeholder="概述四层验收结果、剩余限制和后续知识沉淀要求。"
                    />
                  </label>

                  <div className="verification-close-actions">
                    <button
                      className="primary-button"
                      type="button"
                      disabled={closed || !gate?.canClose || busy !== ""}
                      onClick={() => void closeTask()}
                    >
                      {busy === "close" ? "正在关单…" : "人工审核并完成关单"}
                    </button>
                  </div>
                </div>

                <details className="verification-return-box">
                  <summary>验收失败，退回人工执行</summary>
                  <label>
                    <span>退回原因、失败证据与下一步要求</span>
                    <textarea
                      className="evidence-input small"
                      name="verificationReturnReason"
                      value={returnReason}
                      disabled={busy !== ""}
                      onChange={(event) => setReturnReason(event.target.value)}
                    />
                  </label>
                  <button
                    className="danger-button"
                    type="button"
                    disabled={busy !== ""}
                    onClick={() => void returnTask()}
                  >
                    {busy === "return" ? "正在退回…" : "退回 MANUAL_EXECUTE"}
                  </button>
                </details>

                {workspace.closure && (
                  <Notice
                    tone={workspace.closure.overallStatus === "failed" ? "warning" : "success"}
                    title={workspace.closure.overallStatus === "failed" ? "已有退回修订记录" : "已有历史关单记录"}
                  >
                    {workspace.closure.decidedAt}｜{workspace.closure.reviewer}｜
                    {workspace.closure.overallStatus}｜{workspace.closure.summary}
                  </Notice>
                )}
              </Panel>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
