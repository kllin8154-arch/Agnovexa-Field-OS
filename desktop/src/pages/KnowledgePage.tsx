import { useEffect, useMemo, useState } from "react";
import { Notice, Panel, RiskBadge, StatusBadge, Tag } from "../components/Ui";
import {
  createKnowledgeEntry,
  isDesktopRuntime,
  listKnowledge,
  listProjects,
  type KnowledgeRecord,
  type ProjectRecord,
} from "../lib/repository";

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
  const [status, setStatus] = useState<{ tone: "success" | "danger" | "warning"; title: string; message: string } | null>(null);
  const [loading, setLoading] = useState(isDesktopRuntime());

  const load = async () => {
    if (!isDesktopRuntime()) return;
    setLoading(true);
    try {
      const [nextEntries, nextProjects] = await Promise.all([
        listKnowledge({ scope, query }),
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
    const timer = window.setTimeout(() => void load(), 160);
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

  return (
    <div className="page-stack knowledge-page">
      <div className="kb-switcher" role="tablist" aria-label="知识库范围">
        <button type="button" className={scope === "inner" ? "active" : ""} onClick={() => { setScope("inner"); setShowCreate(false); }}>KB-Inner 内部知识</button>
        <button type="button" className={scope === "public" ? "active" : ""} onClick={() => { setScope("public"); setShowCreate(false); }}>KB-Public 外部资料</button>
      </div>

      {scope === "public" && (
        <Notice tone="warning" title="外部资料默认不可直接执行">
          公共缓存和联网检索结果只能形成待审核草案。经过脱敏、测试验证、人工审核和审计记录后，才可转入内部已验证知识。
        </Notice>
      )}
      {status && <Notice tone={status.tone} title={status.title}>{status.message}</Notice>}

      <Panel
        eyebrow={scope === "inner" ? "PRIVATE / OFFLINE" : "PUBLIC / REVIEWED CACHE"}
        title={filteredLabel}
        actions={
          <div className="inline-actions">
            <input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、现象、版本或标签" />
            <button className="primary-button" type="button" disabled={!isDesktopRuntime()} onClick={() => setShowCreate((value) => !value)}>新建条目</button>
          </div>
        }
      >
        {showCreate && (
          <div className="entity-form knowledge-entry-form">
            {scope === "inner" && <label><span>项目范围</span><select className="select-input" value={form.projectId} onChange={(event) => setForm((current) => ({ ...current, projectId: event.target.value }))}><option value="">内部通用知识</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>}
            <label><span>来源类型</span><select className="select-input" value={form.sourceType} onChange={(event) => setForm((current) => ({ ...current, sourceType: event.target.value as KnowledgeRecord["sourceType"] }))}>{scope === "inner" ? <><option value="skill">Skill</option><option value="sop">SOP</option><option value="incident">故障案例</option></> : <><option value="official_doc">官方文档</option><option value="web_result">外部检索</option></>}</select></label>
            <label className="wide-field"><span>标题</span><input className="text-input" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="包含产品、版本和问题特征" /></label>
            <label className="wide-field"><span>摘要</span><textarea className="evidence-input small" value={form.summary} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} placeholder="说明适用环境、现象和结论。" /></label>
            <label className="wide-field"><span>Markdown 正文</span><textarea className="evidence-input knowledge-editor" value={form.bodyMarkdown} onChange={(event) => setForm((current) => ({ ...current, bodyMarkdown: event.target.value }))} placeholder="# 问题现象\n# 环境与证据\n# 根因\n# 解决步骤\n# 验证\n# 回滚" /></label>
            <label><span>验证状态</span><select className="select-input" value={form.verificationStatus} onChange={(event) => setForm((current) => ({ ...current, verificationStatus: event.target.value as "draft" | "reviewed" }))}><option value="draft">草稿</option><option value="reviewed">已人工审核</option></select></label>
            <label><span>环境范围</span><select className="select-input" value={form.environmentScope} onChange={(event) => setForm((current) => ({ ...current, environmentScope: event.target.value as KnowledgeRecord["environmentScope"] }))}><option value="general">通用</option><option value="development">开发</option><option value="test">测试</option><option value="staging">预生产</option><option value="production">生产</option></select></label>
            <label><span>风险等级</span><select className="select-input" value={form.riskLevel} onChange={(event) => setForm((current) => ({ ...current, riskLevel: event.target.value as KnowledgeRecord["riskLevel"] }))}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></label>
            <label><span>检索标签</span><input className="text-input" value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} placeholder="Kylin, PostgreSQL, 权限, 错误码" /></label>
            <div className="form-actions wide-field"><span>新建接口不允许直接创建 verified 条目。</span><button className="secondary-button" type="button" onClick={() => setShowCreate(false)}>取消</button><button className="primary-button" type="button" onClick={() => void submit()}>保存知识草稿</button></div>
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
                <div className="knowledge-meta"><span>类型：{entry.sourceType}</span><span>项目：{entry.projectName ?? "通用"}</span><span>适用：{entry.environmentScope}</span><span>更新：{entry.updatedAt}</span></div>
                <div className="tag-row">{entry.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</div>
                <details className="knowledge-body-preview"><summary>查看 Markdown 正文</summary><pre>{entry.bodyMarkdown}</pre></details>
              </article>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
