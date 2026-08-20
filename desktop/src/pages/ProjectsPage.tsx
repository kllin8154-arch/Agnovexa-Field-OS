import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Notice, Pagination, Panel } from "../components/Ui";
import { TECHNOLOGY_PRESETS, TechnologyMark } from "../components/TechnologyMark";
import {
  createProject,
  isDesktopRuntime,
  listProjects,
  updateProject,
  type ProjectProfile,
  type ProjectRecord,
} from "../lib/repository";

interface ProjectDraft {
  id: string;
  name: string;
  code: string;
  description: string;
  status: "active" | "paused";
  operatingSystems: string;
  architectures: string;
  deploymentMode: ProjectProfile["deploymentMode"];
  constraints: string;
  technologies: string[];
}

const EMPTY_DRAFT: ProjectDraft = {
  id: "",
  name: "",
  code: "",
  description: "",
  status: "active",
  operatingSystems: "",
  architectures: "",
  deploymentMode: "offline",
  constraints: "",
  technologies: [],
};

const PROJECT_PAGE_SIZE = 8;

function toDraft(project: ProjectRecord): ProjectDraft {
  return {
    id: project.id,
    name: project.name,
    code: project.code,
    description: project.description,
    status: project.status === "paused" ? "paused" : "active",
    operatingSystems: project.profile.operatingSystems.join("，"),
    architectures: project.profile.architectures.join("，"),
    deploymentMode: project.profile.deploymentMode,
    constraints: project.profile.constraints,
    technologies: project.technologies,
  };
}

function splitList(value: string): string[] {
  return Array.from(new Set(value.split(/[,，;；\n]+/).map((item) => item.trim()).filter(Boolean)));
}

export function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [draft, setDraft] = useState<ProjectDraft>(EMPTY_DRAFT);
  const [view, setView] = useState<"list" | "editor">("list");
  const [query, setQuery] = useState("");
  const [customTechnology, setCustomTechnology] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(isDesktopRuntime());
  const [status, setStatus] = useState<{ tone: "success" | "danger" | "info"; title: string; message: string } | null>(null);

  const load = async () => {
    if (!isDesktopRuntime()) return;
    setLoading(true);
    try {
      const next = await listProjects();
      setProjects(next);
      if (next.length === 0) setView("editor");
    } catch (error) {
      setStatus({ tone: "danger", title: "项目读取失败", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredProjects = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return projects;
    return projects.filter((project) =>
      [project.name, project.code, project.description, ...project.technologies, ...project.profile.operatingSystems]
        .join(" ").toLowerCase().includes(keyword),
    );
  }, [projects, query]);

  const pageCount = Math.max(1, Math.ceil(filteredProjects.length / PROJECT_PAGE_SIZE));
  const visibleProjects = filteredProjects.slice((page - 1) * PROJECT_PAGE_SIZE, page * PROJECT_PAGE_SIZE);

  useEffect(() => setPage(1), [query]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const addTechnology = (name: string) => {
    const normalized = name.trim().replace(/\s+/g, " ").slice(0, 80);
    if (!normalized || draft.technologies.some((item) => item.toLowerCase() === normalized.toLowerCase())) return;
    if (draft.technologies.length >= 40) {
      setStatus({ tone: "info", title: "技术项太多", message: "单个项目最多保存 40 项技术。" });
      return;
    }
    setDraft((current) => ({ ...current, technologies: [...current.technologies, normalized] }));
    setCustomTechnology("");
  };

  const startCreate = () => {
    setDraft({ ...EMPTY_DRAFT, technologies: [] });
    setStatus(null);
    setView("editor");
  };

  const startEdit = (project: ProjectRecord) => {
    setDraft(toDraft(project));
    setStatus(null);
    setView("editor");
  };

  const save = async () => {
    try {
      const isNew = !draft.id;
      const profile: ProjectProfile = {
        operatingSystems: splitList(draft.operatingSystems),
        architectures: splitList(draft.architectures),
        deploymentMode: draft.deploymentMode,
        constraints: draft.constraints,
      };
      if (draft.id) {
        await updateProject({ ...draft, profile });
      } else {
        await createProject({
          name: draft.name,
          code: draft.code,
          description: draft.description,
          status: draft.status,
          profile,
          technologies: draft.technologies,
        });
      }
      setStatus({
        tone: "success",
        title: isNew ? "项目创建好了" : "项目已保存",
        message: isNew ? "下一步登记一台属于这个项目的服务器。" : "部署和 AI 助手会自动使用最新项目资料。",
      });
      setView("list");
      await load();
    } catch (error) {
      setStatus({ tone: "danger", title: "没有保存成功", message: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <div className="page-stack projects-page simple-projects-page">
      {!isDesktopRuntime() && <Notice tone="info" title="当前是界面预览">桌面版会把项目资料保存在本机。</Notice>}
      {status && <Notice tone={status.tone} title={status.title}>{status.message}{status.tone === "success" && <div className="notice-next-action"><Link to="/assets">登记服务器 →</Link></div>}</Notice>}

      {view === "list" ? (
        <Panel title="我的项目" actions={<button className="primary-button" type="button" disabled={!isDesktopRuntime()} onClick={startCreate}>新建项目</button>} className="project-list-panel">
          {projects.length > 4 && (
            <div className="simple-list-toolbar">
              <input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索项目" aria-label="搜索项目" />
              <span>{filteredProjects.length} 个</span>
            </div>
          )}
          {loading ? <div className="loading-state">正在读取项目…</div> : filteredProjects.length === 0 ? (
            <div className="empty-state compact"><div className="empty-state-mark">1</div><h2>先创建一个项目</h2><p>只需要项目名称，其他资料以后再补。</p><button className="primary-button" type="button" onClick={startCreate}>创建项目</button></div>
          ) : (
            <div className="simple-project-list">
              {visibleProjects.map((project) => (
                <button key={project.id} type="button" onClick={() => startEdit(project)}>
                  <span className="project-list-mark">{project.name.slice(0, 1)}</span>
                  <div><strong>{project.name}</strong><small>{project.profile.operatingSystems.join("、") || "环境资料待补充"}{project.technologies.length > 0 ? ` · ${project.technologies.length} 项技术` : ""}</small></div>
                  <span>{project.status === "paused" ? "已暂停" : "编辑 →"}</span>
                </button>
              ))}
            </div>
          )}
          <Pagination page={page} pageCount={pageCount} onChange={setPage} label="项目列表分页" />
        </Panel>
      ) : (
        <Panel title={draft.id ? "编辑项目" : "创建项目"} actions={projects.length > 0 && <button className="text-button" type="button" onClick={() => setView("list")}>返回项目列表</button>} className="simple-project-editor">
          <div className="simple-form-intro"><strong>{draft.id ? "修改需要更新的内容" : "先填写最基本的信息"}</strong><p>带“可选”的内容都可以稍后再补，不影响创建项目。</p></div>

          <div className="simple-core-form">
            <label><span>项目名称 <b>必填</b></span><input className="text-input" autoFocus name="projectName" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="例如：国产化服务平台" /></label>
            <label><span>项目说明 <small>可选</small></span><textarea className="evidence-input small" name="projectDescription" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="简单说明这个项目要做什么" /></label>
          </div>

          <details className="optional-settings" open={draft.id ? true : undefined}>
            <summary><div><strong>系统、技术栈和现场限制</strong><small>可选，需要时再填写</small></div><span>展开</span></summary>
            <div className="optional-settings-body">
              <div className="simple-form-grid">
                <label><span>操作系统</span><input className="text-input" value={draft.operatingSystems} onChange={(event) => setDraft((current) => ({ ...current, operatingSystems: event.target.value }))} placeholder="如：银河麒麟 V10 SP3 ARM、X86_64" /></label>
                <label><span>CPU 架构</span><input className="text-input" value={draft.architectures} onChange={(event) => setDraft((current) => ({ ...current, architectures: event.target.value }))} placeholder="如：aarch64、x86_64" /></label>
                <label><span>项目编码</span><input className="text-input" value={draft.code} onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value }))} placeholder="可留空" /></label>
                <label><span>网络环境</span><select className="select-input" value={draft.deploymentMode} onChange={(event) => setDraft((current) => ({ ...current, deploymentMode: event.target.value as ProjectProfile["deploymentMode"] }))}><option value="offline">完全离线</option><option value="intranet">内网</option><option value="hybrid">离线 / 内网混合</option></select></label>
                {draft.id && <label><span>项目状态</span><select className="select-input" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as ProjectDraft["status"] }))}><option value="active">进行中</option><option value="paused">已暂停</option></select></label>}
                <label className="wide-field"><span>现场限制</span><textarea className="evidence-input small" value={draft.constraints} onChange={(event) => setDraft((current) => ({ ...current, constraints: event.target.value }))} placeholder="如：完全离线、只能使用指定目录、周末变更；不要填写密码或 Token" /></label>
              </div>

              <section className="simple-technology-editor">
                <header><div><strong>技术栈</strong><small>可输入任意名称和版本，图标会自动识别</small></div></header>
                {draft.technologies.length > 0 && <div className="selected-technologies">{draft.technologies.map((technology) => <span key={technology}><TechnologyMark name={technology} /><strong>{technology}</strong><button type="button" aria-label={`移除 ${technology}`} onClick={() => setDraft((current) => ({ ...current, technologies: current.technologies.filter((item) => item !== technology) }))}>×</button></span>)}</div>}
                <div className="technology-add-row"><input className="text-input" value={customTechnology} onChange={(event) => setCustomTechnology(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTechnology(customTechnology); } }} placeholder="例如：Java 8、Java 17、Kylin V10 SP3" /><button className="secondary-button" type="button" onClick={() => addTechnology(customTechnology)}>添加</button></div>
                <details className="technology-suggestions"><summary>从常用技术中选择</summary><div>{TECHNOLOGY_PRESETS.flatMap((group) => group.items).filter((item) => !draft.technologies.includes(item)).slice(0, 20).map((item) => <button key={item} type="button" onClick={() => addTechnology(item)}><TechnologyMark name={item} /><span>{item}</span></button>)}</div></details>
              </section>
            </div>
          </details>

          <footer className="simple-form-actions">
            {projects.length > 0 && <button className="secondary-button" type="button" onClick={() => setView("list")}>取消</button>}
            <button className="primary-button" type="button" disabled={!isDesktopRuntime() || draft.name.trim().length < 2} onClick={() => void save()}>{draft.id ? "保存修改" : "创建项目"}</button>
          </footer>
        </Panel>
      )}
    </div>
  );
}
