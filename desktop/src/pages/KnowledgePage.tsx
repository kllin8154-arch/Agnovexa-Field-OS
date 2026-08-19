import { useEffect, useMemo, useState } from "react";
import { Notice, Panel, RiskBadge, StatusBadge, Tag } from "../components/Ui";
import {
  createKnowledgeEntry,
  isDesktopRuntime,
  listProjects,
  type KnowledgeRecord,
  type ProjectRecord,
} from "../lib/repository";
import {
  promotePublicKnowledge,
  searchKnowledgeAdvanced,
  verifyKnowledgeEntry,
} from "../lib/productionRepository";

const EMPTY_FORM = {
  projectId: "",
  title: "",
  summary: "",
  bodyMarkdown: "",
  tags: "",
  sourceType: "incident" as KnowledgeRecord["sourceType"],
  verificationStatus: "draft" as "draft" | "reviewed",
  environmentScope: "general" as KnowledgeRecord["environmentScope"],
  riskLevel: "LOW" as KnowledgeRecord["riskLevel"],
};

export function KnowledgePage() {
  const [scope, setScope] = useState<"inner" | "public">("inner");
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<KnowledgeRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [actionEntry, setActionEntry] = useState<KnowledgeRecord | null>(null);
  const [reviewer, setReviewer] = useState("");
  const [evidence, setEvidence] = useState("");
  const [targetProjectId, setTargetProjectId] = useState("");
  const [status, setStatus] = useState<{ tone: "success" | "danger" | "warning" | "info"; title: string; message: string } | null>(null);
  const [loading, setLoading] = useState(isDesktopRuntime());

  const load = async () => {
    if (!isDesktopRuntime()) return;
    setLoading(true);
    try {
      const [nextEntries, nextProjects] = await Promise.all([
        searchKnowledgeAdvanced({ scope, query }),
        listProjects(),
      ]);
      setEntries(nextEntries);
      setProjects(nextProjects);
    } catch (error) {
      setStatus({ tone: "danger", title: "知识库读取失败", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
  }, [scope, query]);

  const filteredLabel = useMemo(
    () => scope === "inner" ? "内部受控知识库" : "外部公开资料缓存",
    [scope],
  );

  const submit = async () => {
    try {
      await createKnowledgeEntry({
        projectId: scope === "inner" ? form.projectId || undefined : undefined,
        title: form.title,
        summary: form.summary,
        bodyMarkdown: form.bodyMarkdown,
        tags: form.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
        sourceScope: scope,
        sourceType: scope === "public" && !["official_doc", "web_result"].includes(form.sourceType)
          ? "official_doc"
          : form.sourceType,
        verificationStatus: form.verificationStatus,
        environmentScope: form.environmentScope,
        riskLevel: form.riskLevel,
      });
      setForm(EMPTY_FORM);
      setShowCreate(false);
      setStatus({
        tone: "success",
        title: "知识条目已保存",
        message: scope === "public"
          ? "外部资料仍处于 draft/reviewed，不会被当作已验证生产知识。"
          : "内部知识已保存；只有具备现场验证证据并完成人工审核后才能升级为 verified。",
      });
      await load();
    } catch (error) {
      setStatus({ tone: "danger", title: "知识条目保存失败", message: error instanceof Error ? error.message : String(error) });
    }
  };

  const openAction = (entry: KnowledgeRecord) => {
    setActionEntry(entry);
    setReviewer("");
    setEvidence("");
    setTargetProjectId(entry.projectId ?? "");
  };

  const submitAction = async () => {
    if (!actionEntry) return;
    try {
      if (actionEntry.sourceScope === "inner") {
        await verifyKnowledgeEntry({ id: actionEntry.id, reviewer, evidence });
        setStatus({ tone: "success", title: "内部知识已验证", message: "验证证据、维护人和验证时间已写入本地知识库与审计记录。" });
      } else {
        const newId = await promotePublicKnowledge({
          id: actionEntry.id,
          projectId: targetProjectId || undefined,
          reviewer,
          evidence,
        });
        setStatus({ tone: "success", title: "外部资料已转入内部库", message: `已生成新的内部 verified 条目：${newId}。原外部条目仍保留，便于追溯来源。` });
      }
      setActionEntry(null);
      setReviewer("");
      setEvidence("");
      await load();
    } catch (error) {
      setStatus({ tone: "danger", title: "知识审核失败", message: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <div className="page-stack knowledge-page">
      <Panel eyebrow="TRUSTED RETRIEVAL" title="检索优先级与发布门禁">
        <div className="priority-ladder compact">
          {["已验证 Skill", "内部生产知识", "内部通用知识", "已审核公开资料", "外部待验证建议"].map((item, index) => (
            <div key={item}><span>{index + 1}</span><strong>{item}</strong></div>
          ))}
        </div>
      </Panel>

      <div className="kb-switcher" role="tablist" aria-label="知识库范围">
        <button type="button" className={scope === "inner" ? "active" : ""} onClick={() => { setScope("inner"); setShowCreate(false); setActionEntry(null); }}>KB-Inner 内部知识</button>
        <button type="button" className={scope === "public" ? "active" : ""} onClick={() => { setScope("public"); setShowCreate(false); setActionEntry(null); }}>KB-Public 外部资料</button>
      </div>

      {scope === "public" && (
        <Notice tone="warning" title="外部资料默认不可直接执行">
          公共缓存和联网检索结果只能形成待审核草案。只有先完成人工审核，再在测试或现场环境验证并登记证据，才会复制为新的内部 verified 条目。
        </Notice>
      )}
      {status && <Notice tone={status.tone} title={status.title}>{status.message}</Notice>}

      <Panel
        eyebrow={scope === "inner" ? "PRIVATE / OFFLINE" : "PUBLIC / REVIEWED CACHE"}
        title={filteredLabel}
        actions={
          <div className="inline-actions">
            <input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="FTS 搜索标题、正文、现象、版本或标签" />
            <button className="primary-button" type="button" disabled={!isDesktopRuntime()} onClick={() => setShowCreate((value) => !value)}>新建条目</button>
          </div>
        }
      >
        {showCreate && (
          <div className="entity-form knowledge-entry-form">
            {scope === "inner" && <label><span>项目范围</span><select className="select-input" value={form.projectId} onChange={(event) => setForm((current) => ({ ...current, projectId: event.target.value }))}><option value="">内部通用知识</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>}
            <label><span>来源类型</span><select className="select-input" value={form.sourceType} onChange={(event) => setForm((current) => ({ ...current, sourceType: event.target.value as KnowledgeRecord["sourceType"] }))}>{scope === "inner" ? <><option value="skill">Skill 关联知识</option><option value="sop">SOP</option><option value="incident">故障案例</option></> : <><option value="official_doc">官方文档</option><option value="web_result">外部检索</option></>}</select></label>
            <label className="wide-field"><span>标题</span><input className="text-input" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="包含产品、版本和问题特征" /></label>
            <label className="wide-field"><span>摘要</span><textarea className="evidence-input small" value={form.summary} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} placeholder="说明适用环境、现象和结论。" /></label>
            <label className="wide-field"><span>Markdown 正文</span><textarea className="evidence-input knowledge-editor" value={form.bodyMarkdown} onChange={(event) => setForm((current) => ({ ...current, bodyMarkdown: event.target.value }))} placeholder="# 问题现象\n# 环境与证据\n# 根因\n# 解决步骤\n# 验证\n# 回滚\n# 来源" /></label>
            <label><span>验证状态</span><select className="select-input" value={form.verificationStatus} onChange={(event) => setForm((current) => ({ ...current, verificationStatus: event.target.value as "draft" | "reviewed" }))}><option value="draft">草稿</option><option value="reviewed">已人工审核</option></select></label>
            <label><span>环境范围</span><select className="select-input" value={form.environmentScope} onChange={(event) => setForm((current) => ({ ...current, environmentScope: event.target.value as KnowledgeRecord["environmentScope"] }))}><option value="general">通用</option><option value="development">开发</option><option value="test">测试</option><option value="staging">预生产</option><option value="production">生产</option></select></label>
            <label><span>风险等级</span><select className="select-input" value={form.riskLevel} onChange={(event) => setForm((current) => ({ ...current, riskLevel: event.target.value as KnowledgeRecord["riskLevel"] }))}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></label>
            <label><span>检索标签</span><input className="text-input" value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} placeholder="Kylin, PostgreSQL, 权限, 错误码" /></label>
            <div className="form-actions wide-field"><span>新建接口不允许直接创建 verified 条目。</span><button className="secondary-button" type="button" onClick={() => setShowCreate(false)}>取消</button><button className="primary-button" type="button" onClick={() => void submit()}>保存知识草稿</button></div>
          </div>
        )}

        {actionEntry && (
          <div className="knowledge-review-box">
            <div className="knowledge-review-head">
              <div><span>{actionEntry.sourceScope === "inner" ? "VERIFY INNER KNOWLEDGE" : "PROMOTE PUBLIC KNOWLEDGE"}</span><h3>{actionEntry.title}</h3></div>
              <button className="text-button" type="button" onClick={() => setActionEntry(null)}>关闭</button>
            </div>
            {actionEntry.sourceScope === "public" && actionEntry.verificationStatus !== "reviewed" && (
              <Notice tone="warning" title="外部资料尚未完成审核">请先将外部条目状态调整为 reviewed，并核对官方来源、版本和适用条件。</Notice>
            )}
            {actionEntry.sourceScope === "public" && (
              <label><span>转入项目</span><select className="select-input" value={targetProjectId} onChange={(event) => setTargetProjectId(event.target.value)}><option value="">内部通用知识</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
            )}
            <label><span>审核 / 验证人员</span><input className="text-input" value={reviewer} onChange={(event) => setReviewer(event.target.value)} /></label>
            <label className="wide-field"><span>现场验证证据与适用版本</span><textarea className="evidence-input small" value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="记录环境、版本、实际执行结果、成功标准和回滚验证；不要填写密码或 Token。" /></label>
            <div className="form-actions wide-field"><span>{actionEntry.sourceScope === "inner" ? "证据通过后更新为 verified。" : "生成新的内部 verified 副本，保留原外部条目追溯。"}</span><button className="primary-button" type="button" disabled={actionEntry.sourceScope === "public" && actionEntry.verificationStatus !== "reviewed"} onClick={() => void submitAction()}>{actionEntry.sourceScope === "inner" ? "登记验证结果" : "验证后转入内部库"}</button></div>
          </div>
        )}

        {loading ? (
          <div className="loading-state">正在检索本地知识库…</div>
        ) : entries.length === 0 ? (
          <div className="empty-state compact"><div className="empty-state-mark">KB</div><h2>{query ? "没有匹配知识" : "知识库还是空的"}</h2><p>{scope === "inner" ? "把已验证现场经验整理为可审计知识。" : "仅缓存经过审核的官方资料和公开检索结果。"}</p></div>
        ) : (
          <div className="knowledge-list">
            {entries.map((entry) => (
              <article className="knowledge-card" key={entry.id}>
                <div className="knowledge-card-top">
                  <div><span className={`scope scope-${entry.sourceScope}`}>{entry.sourceScope === "inner" ? "KB-INNER" : "KB-PUBLIC"}</span><h3>{entry.title}</h3></div>
                  <div className="inline-actions"><StatusBadge status={entry.verificationStatus} /><RiskBadge level={entry.riskLevel} /></div>
                </div>
                <p>{entry.summary || "暂无摘要"}</p>
                <div className="knowledge-meta"><span>类型：{entry.sourceType}</span><span>项目：{entry.projectName ?? "通用"}</span><span>适用：{entry.environmentScope}</span><span>最后验证：{entry.lastVerifiedAt ?? "未验证"}</span><span>更新：{entry.updatedAt}</span></div>
                <div className="tag-row">{entry.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</div>
                <details className="knowledge-body-preview"><summary>查看 Markdown 正文</summary><pre>{entry.bodyMarkdown}</pre></details>
                <div className="card-actions">
                  {entry.sourceScope === "inner" && entry.verificationStatus !== "verified" && entry.verificationStatus !== "deprecated" && <button className="secondary-button" type="button" onClick={() => openAction(entry)}>登记现场验证</button>}
                  {entry.sourceScope === "public" && <button className="secondary-button" type="button" onClick={() => openAction(entry)}>{entry.verificationStatus === "reviewed" ? "验证后转入内部库" : "查看转入条件"}</button>}
                  {entry.verificationStatus === "verified" && <Tag>可用于生成受控草案</Tag>}
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
