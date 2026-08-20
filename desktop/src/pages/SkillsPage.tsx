import { useEffect, useMemo, useState } from "react";
import { CodeBlock, Notice, Pagination, Panel, RiskBadge, StatusBadge, Tag } from "../components/Ui";
import { isDesktopRuntime } from "../lib/repository";
import {
  createSkillDefinition,
  ensureBuiltInSkills,
  listSkills,
  verifySkillDefinition,
  type SkillRecord,
  type SkillRisk,
} from "../lib/productionRepository";

const EMPTY_FORM = {
  id: "",
  name: "",
  version: "1.0.0",
  owner: "",
  riskLevel: "MEDIUM" as SkillRisk,
  sourceScope: "inner" as "inner" | "public",
  metadataYaml: "",
  promptMarkdown: "",
  precheckTemplate: "",
  actionTemplate: "",
  verificationTemplate: "",
  rollbackTemplate: "",
};

const SKILL_PAGE_SIZE = 6;

export function SkillsPage() {
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [reviewer, setReviewer] = useState("");
  const [evidence, setEvidence] = useState("");
  const [loading, setLoading] = useState(isDesktopRuntime());
  const [status, setStatus] = useState<{ tone: "success" | "danger" | "warning"; title: string; message: string } | null>(null);

  const selected = useMemo(
    () => skills.find((skill) => skill.id === selectedId) ?? skills[0],
    [skills, selectedId],
  );

  const pageCount = Math.max(1, Math.ceil(skills.length / SKILL_PAGE_SIZE));
  const visibleSkills = useMemo(
    () => skills.slice((page - 1) * SKILL_PAGE_SIZE, page * SKILL_PAGE_SIZE),
    [skills, page],
  );

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const load = async () => {
    if (!isDesktopRuntime()) return;
    setLoading(true);
    try {
      await ensureBuiltInSkills();
      const rows = await listSkills(query);
      setSkills(rows);
      if (!selectedId && rows[0]) setSelectedId(rows[0].id);
      if (selectedId && !rows.some((skill) => skill.id === selectedId)) {
        setSelectedId(rows[0]?.id ?? "");
      }
    } catch (error) {
      setStatus({ tone: "danger", title: "Skill 专库读取失败", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 140);
    return () => window.clearTimeout(timer);
  }, [query]);

  const create = async () => {
    try {
      await createSkillDefinition(form);
      setForm(EMPTY_FORM);
      setShowCreate(false);
      setStatus({ tone: "success", title: "Skill 草稿已保存", message: "新 Skill 默认处于 draft，必须经过人工审核、现场验证和证据登记后才能升级为 verified。" });
      await load();
    } catch (error) {
      setStatus({ tone: "danger", title: "Skill 保存失败", message: error instanceof Error ? error.message : String(error) });
    }
  };

  const verify = async () => {
    if (!selected) return;
    try {
      await verifySkillDefinition({ id: selected.id, reviewer, evidence });
      setReviewer("");
      setEvidence("");
      setStatus({ tone: "success", title: "Skill 已完成验证登记", message: "该 Skill 已升级为 verified；后续仍需按适用版本和环境复核。" });
      await load();
    } catch (error) {
      setStatus({ tone: "danger", title: "Skill 验证失败", message: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <div className="page-stack skills-page">
      <Notice tone="info" title="Skill 是受控模板，不是自动执行插件">
        Skill 只保存结构化元数据、提示词、命令或 SQL 模板、验证和回滚策略。程序不会连接服务器、数据库或 GeoServer，也不会执行其中任何内容。
      </Notice>

      <Panel eyebrow="RETRIEVAL ORDER" title="知识与 Skill 检索优先级">
        <div className="priority-ladder">
          {["已验证 Skill", "内部生产知识", "内部通用知识", "已审核公开资料", "外部待验证建议"].map((item, index) => (
            <div key={item}><span>{index + 1}</span><strong>{item}</strong></div>
          ))}
        </div>
      </Panel>

      {status && <Notice tone={status.tone} title={status.title}>{status.message}</Notice>}

      {showCreate && (
        <Panel eyebrow="NEW CONTROLLED SKILL" title="建立 Skill 草稿" className="skill-create-panel" actions={<button className="secondary-button" type="button" onClick={() => setShowCreate(false)}>关闭</button>}>
          <div className="entity-form skill-form">
            <label><span>Skill ID</span><input className="text-input" value={form.id} onChange={(event) => setForm((current) => ({ ...current, id: event.target.value }))} placeholder="例如 nginx.offline.install" /></label>
            <label><span>版本</span><input className="text-input" value={form.version} onChange={(event) => setForm((current) => ({ ...current, version: event.target.value }))} /></label>
            <label className="wide-field"><span>名称</span><input className="text-input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
            <label><span>维护人</span><input className="text-input" value={form.owner} onChange={(event) => setForm((current) => ({ ...current, owner: event.target.value }))} /></label>
            <label><span>风险等级</span><select className="select-input" value={form.riskLevel} onChange={(event) => setForm((current) => ({ ...current, riskLevel: event.target.value as SkillRisk }))}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></label>
            <label><span>来源范围</span><select className="select-input" value={form.sourceScope} onChange={(event) => setForm((current) => ({ ...current, sourceScope: event.target.value as "inner" | "public" }))}><option value="inner">内部</option><option value="public">外部待审</option></select></label>
            <label className="wide-field"><span>skill.yaml / 元数据</span><textarea className="evidence-input small" value={form.metadataYaml} onChange={(event) => setForm((current) => ({ ...current, metadataYaml: event.target.value }))} /></label>
            <label className="wide-field"><span>提示词</span><textarea className="evidence-input" value={form.promptMarkdown} onChange={(event) => setForm((current) => ({ ...current, promptMarkdown: event.target.value }))} /></label>
            <label className="wide-field"><span>前置检查模板</span><textarea className="evidence-input" value={form.precheckTemplate} onChange={(event) => setForm((current) => ({ ...current, precheckTemplate: event.target.value }))} /></label>
            <label className="wide-field"><span>操作模板</span><textarea className="evidence-input" value={form.actionTemplate} onChange={(event) => setForm((current) => ({ ...current, actionTemplate: event.target.value }))} /></label>
            <label className="wide-field"><span>验证模板</span><textarea className="evidence-input" value={form.verificationTemplate} onChange={(event) => setForm((current) => ({ ...current, verificationTemplate: event.target.value }))} /></label>
            <label className="wide-field"><span>回滚模板</span><textarea className="evidence-input" value={form.rollbackTemplate} onChange={(event) => setForm((current) => ({ ...current, rollbackTemplate: event.target.value }))} /></label>
            <div className="form-actions wide-field"><span>保存后状态为 draft，不能直接用于生产。</span><button className="primary-button" type="button" onClick={() => void create()}>保存 Skill 草稿</button></div>
          </div>
        </Panel>
      )}

      <div className="skills-layout">
        <Panel eyebrow="SKILL REGISTRY" title="Skill 专库" className="skill-registry-panel">
          <div className="registry-toolbar skill-registry-toolbar">
            <input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 Skill ID、名称或组件" />
            <button className="primary-button" type="button" disabled={!isDesktopRuntime()} onClick={() => setShowCreate(true)}>新建 Skill</button>
          </div>

          {loading ? (
            <div className="loading-state">正在读取 Skill 专库…</div>
          ) : skills.length === 0 ? (
            <div className="empty-state compact"><div className="empty-state-mark">SK</div><h2>没有匹配 Skill</h2><p>先创建受控模板，或清空搜索条件。</p></div>
          ) : (
            <div className="skill-list">
              {visibleSkills.map((skill) => (
                <button key={skill.id} type="button" className={`skill-list-item${selected?.id === skill.id ? " active" : ""}`} onClick={() => setSelectedId(skill.id)}>
                  <div><strong>{skill.name}</strong><span>{skill.id} · v{skill.version}</span></div>
                  <div className="inline-actions"><StatusBadge status={skill.status} /><RiskBadge level={skill.riskLevel} /></div>
                </button>
              ))}
            </div>
          )}
          <Pagination page={page} pageCount={pageCount} onChange={setPage} label="Skill 列表分页" />
        </Panel>

        <Panel eyebrow="CONTROLLED SKILL" title={selected?.name ?? "选择一个 Skill"} actions={selected && <Tag>{selected.sourceScope === "inner" ? "KB-INNER" : "KB-PUBLIC"}</Tag>}>
          {!selected ? (
            <div className="empty-state compact"><div className="empty-state-mark">SK</div><h2>尚未选择 Skill</h2></div>
          ) : (
            <div className="skill-detail">
              <div className="skill-summary-grid">
                <div><span>ID</span><strong>{selected.id}</strong></div>
                <div><span>版本</span><strong>{selected.version}</strong></div>
                <div><span>维护人</span><strong>{selected.owner || "待指定"}</strong></div>
                <div><span>人工确认</span><strong>{selected.requiresHumanApproval ? "必须" : "否"}</strong></div>
                <div><span>状态</span><StatusBadge status={selected.status} /></div>
                <div><span>最近验证</span><strong>{selected.lastVerifiedAt ?? "未完成现场验证"}</strong></div>
              </div>

              <details open><summary>结构化元数据</summary><CodeBlock value={selected.metadataYaml || "# 暂无元数据"} label="skill.yaml" /></details>
              <details><summary>系统提示词</summary><CodeBlock value={selected.promptMarkdown} label="prompt.md" /></details>
              <details><summary>前置检查</summary><CodeBlock value={selected.precheckTemplate || "# 暂无前置检查模板"} label="precheck" /></details>
              <details><summary>待人工执行模板</summary><CodeBlock value={selected.actionTemplate || "# 暂无操作模板"} label="action · 人工执行" /></details>
              <details><summary>验证模板</summary><CodeBlock value={selected.verificationTemplate} label="verify" /></details>
              <details><summary>回滚模板</summary><CodeBlock value={selected.rollbackTemplate} label="rollback · 人工确认" /></details>

              {selected.status !== "verified" && selected.sourceScope === "inner" && (
                <div className="verification-form">
                  <h3>登记现场验证</h3>
                  <p>只有已在适用环境中完成测试、保存证据并由人工审核后，才可升级为 verified。</p>
                  <label><span>验证人员</span><input className="text-input" value={reviewer} onChange={(event) => setReviewer(event.target.value)} /></label>
                  <label><span>验证证据与适用版本</span><textarea className="evidence-input small" value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="记录实际环境、执行结果、成功标准、异常与回滚验证；不要填写秘密。" /></label>
                  <button className="primary-button" type="button" onClick={() => void verify()}>审核并标记 verified</button>
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
