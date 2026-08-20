import { useEffect, useMemo, useState } from "react";
import { Notice, Pagination, Panel } from "../components/Ui";
import { TECHNOLOGY_PRESETS, TechnologyMark } from "../components/TechnologyMark";
import {
  createProject,
  EMPTY_PROJECT_PROFILE,
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

const PROJECT_PAGE_SIZE = 6;

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
  const [query, setQuery] = useState("");
  const [technologyQuery, setTechnologyQuery] = useState("");
  const [customTechnology, setCustomTechnology] = useState("");
  const [showTechnologyPicker, setShowTechnologyPicker] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(isDesktopRuntime());
  const [status, setStatus] = useState<{ tone: "success" | "danger" | "info"; title: string; message: string } | null>(null);

  const load = async (preferredId?: string) => {
    if (!isDesktopRuntime()) return;
    setLoading(true);
    try {
      const next = await listProjects();
      setProjects(next);
      const selected = next.find((project) => project.id === (preferredId || draft.id)) ?? next[0];
      if (selected) setDraft(toDraft(selected));
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
  const visibleProjects = useMemo(
    () => filteredProjects.slice((page - 1) * PROJECT_PAGE_SIZE, page * PROJECT_PAGE_SIZE),
    [filteredProjects, page],
  );

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const availableGroups = useMemo(() => {
    const keyword = technologyQuery.trim().toLowerCase();
    return TECHNOLOGY_PRESETS.map((group) => ({
      ...group,
      items: group.items.filter((item) => !draft.technologies.includes(item) && (!keyword || item.toLowerCase().includes(keyword))),
    })).filter((group) => group.items.length > 0);
  }, [draft.technologies, technologyQuery]);

  const addTechnology = (name: string) => {
    const normalized = name.trim().replace(/\s+/g, " ").slice(0, 80);
    if (!normalized || draft.technologies.some((item) => item.toLowerCase() === normalized.toLowerCase())) return;
    if (draft.technologies.length >= 40) {
      setStatus({ tone: "info", title: "技术项已达上限", message: "单个项目最多保存 40 项技术；可合并同类版本描述后再添加。" });
      return;
    }
    setDraft((current) => ({ ...current, technologies: [...current.technologies, normalized] }));
    setCustomTechnology("");
  };

  const save = async () => {
    try {
      const profile: ProjectProfile = {
        operatingSystems: splitList(draft.operatingSystems),
        architectures: splitList(draft.architectures),
        deploymentMode: draft.deploymentMode,
        constraints: draft.constraints,
      };
      const saved = draft.id
        ? await updateProject({
          id: draft.id,
          name: draft.name,
          code: draft.code,
          description: draft.description,
          status: draft.status,
          profile,
          technologies: draft.technologies,
        })
        : await createProject({
          name: draft.name,
          code: draft.code,
          description: draft.description,
          status: draft.status,
          profile,
          technologies: draft.technologies,
        });
      setStatus({ tone: "success", title: "项目档案已保存", message: "运维、部署和 AI 工作台会读取这份固定项目上下文；后续修改仍统一在项目中心完成。" });
      await load(saved.id);
    } catch (error) {
      setStatus({ tone: "danger", title: "项目保存失败", message: error instanceof Error ? error.message : String(error) });
    }
  };

  const startCreate = () => {
    setDraft({ ...EMPTY_DRAFT, technologies: [], operatingSystems: EMPTY_PROJECT_PROFILE.operatingSystems.join("，") });
    setShowTechnologyPicker(true);
    setStatus(null);
  };

  return (
    <div className="page-stack projects-page">
      {!isDesktopRuntime() && <Notice tone="info" title="浏览器预览不写入项目">Windows 桌面版会将项目档案保存在本机 SQLite，并自动提供给部署、运维和 AI 工作台。</Notice>}
      {status && <Notice tone={status.tone} title={status.title}>{status.message}</Notice>}

      <div className="projects-layout">
        <Panel
          eyebrow="PROJECT REGISTER"
          title="项目列表"
          actions={<button className="primary-button" type="button" disabled={!isDesktopRuntime()} onClick={startCreate}>新建项目</button>}
        >
          <div className="registry-toolbar project-registry-toolbar">
            <input className="search-input project-search" name="projectSearch" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称、系统或技术栈" />
            <span>{filteredProjects.length} 个项目</span>
          </div>
          {loading ? <div className="loading-state">正在读取项目…</div> : filteredProjects.length === 0 ? (
            <div className="empty-state compact"><div className="empty-state-mark">PJ</div><h2>还没有项目</h2><p>先建立项目档案，再登记服务器资产。</p></div>
          ) : (
            <div className="project-list">
              {visibleProjects.map((project) => (
                <button key={project.id} type="button" className={draft.id === project.id ? "active" : ""} onClick={() => { setDraft(toDraft(project)); setShowTechnologyPicker(false); }}>
                  <span className="project-list-mark">{project.name.slice(0, 1)}</span>
                  <div><strong>{project.name}</strong><small>{project.code || "未设置项目编码"} · {project.technologies.length} 项技术</small></div>
                  <span className={project.status === "paused" ? "project-state paused" : "project-state"}>{project.status === "paused" ? "暂停" : "进行中"}</span>
                </button>
              ))}
            </div>
          )}
          <Pagination page={page} pageCount={pageCount} onChange={setPage} label="项目列表分页" />
        </Panel>

        <Panel
          eyebrow={draft.id ? "EDIT PROJECT" : "NEW PROJECT"}
          title={draft.id ? "编辑项目档案" : "建立项目档案"}
          actions={<span className="project-editor-hint">唯一配置入口</span>}
        >
          <section className="project-form-section">
            <header><span>01</span><div><strong>项目基础</strong><p>先明确项目归属、状态和交付范围。</p></div></header>
            <div className="project-editor-grid project-basics-grid">
              <label><span>项目名称</span><input className="text-input" name="projectName" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="例如：国产化服务平台离线部署" /></label>
              <label><span>项目编码</span><input className="text-input" name="projectCode" value={draft.code} onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value }))} placeholder="可选" /></label>
              <label><span>状态</span><select className="select-input" name="projectStatus" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as ProjectDraft["status"] }))}><option value="active">进行中</option><option value="paused">已暂停</option></select></label>
              <label><span>交付网络</span><select className="select-input" name="deploymentMode" value={draft.deploymentMode} onChange={(event) => setDraft((current) => ({ ...current, deploymentMode: event.target.value as ProjectProfile["deploymentMode"] }))}><option value="offline">完全离线</option><option value="intranet">内网交付</option><option value="hybrid">离线 / 内网混合</option></select></label>
              <label className="wide-field"><span>项目说明</span><textarea className="evidence-input small" name="projectDescription" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="说明业务范围、交付目标和非敏感背景。" /></label>
            </div>
          </section>

          <section className="project-form-section">
            <header><span>02</span><div><strong>现场环境</strong><p>这些信息会固定成为部署、运维和 AI 的项目上下文。</p></div></header>
            <div className="project-editor-grid project-environment-grid">
              <label><span>操作系统</span><input className="text-input" name="operatingSystems" value={draft.operatingSystems} onChange={(event) => setDraft((current) => ({ ...current, operatingSystems: event.target.value }))} placeholder="银河麒麟 V10 SP3 ARM，银河麒麟 V10 SP3 X86_64" /></label>
              <label><span>CPU 架构</span><input className="text-input" name="architectures" value={draft.architectures} onChange={(event) => setDraft((current) => ({ ...current, architectures: event.target.value }))} placeholder="ARM/aarch64，X86_64" /></label>
              <label className="wide-field"><span>现场限制与约束</span><textarea className="evidence-input small" name="projectConstraints" value={draft.constraints} onChange={(event) => setDraft((current) => ({ ...current, constraints: event.target.value }))} placeholder="离线介质、网络分区、目录规范、变更窗口、回退要求等；不要填写密码或 Token。" /></label>
            </div>
          </section>

          <section className="technology-editor project-form-section">
            <header>
              <div><span className="eyebrow">TECHNOLOGY SNAPSHOT</span><h3>项目技术栈</h3><p>可选常用项，也可直接填写任意版本；图标会按名称自动识别。</p></div>
              <button className="secondary-button" type="button" onClick={() => setShowTechnologyPicker((value) => !value)}>{showTechnologyPicker ? "收起选择器" : "添加技术"}</button>
            </header>
            {draft.technologies.length === 0 ? <div className="technology-empty">尚未选择技术。Java 8、Java 17 或混合版本都可分别记录。</div> : (
              <div className="selected-technologies">
                {draft.technologies.map((technology) => (
                  <span key={technology}><TechnologyMark name={technology} /><strong>{technology}</strong><button type="button" aria-label={`移除 ${technology}`} onClick={() => setDraft((current) => ({ ...current, technologies: current.technologies.filter((item) => item !== technology) }))}>×</button></span>
                ))}
              </div>
            )}

            {showTechnologyPicker && (
              <div className="technology-picker">
                <div className="technology-picker-toolbar">
                  <input className="search-input" name="technologySearch" value={technologyQuery} onChange={(event) => setTechnologyQuery(event.target.value)} placeholder="筛选常用技术" />
                  <div><input className="text-input" name="customTechnology" value={customTechnology} onChange={(event) => setCustomTechnology(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTechnology(customTechnology); } }} placeholder="自定义：如 Java 1.8.0_301" /><button className="primary-button" type="button" onClick={() => addTechnology(customTechnology)}>添加</button></div>
                </div>
                <div className="technology-preset-groups">
                  {availableGroups.map((group) => (
                    <section key={group.group}><strong>{group.group}</strong><div>{group.items.map((item) => <button key={item} type="button" onClick={() => addTechnology(item)}><TechnologyMark name={item} /><span>{item}</span></button>)}</div></section>
                  ))}
                </div>
              </div>
            )}
          </section>

          <footer className="project-editor-actions">
            <span>保存后立即成为部署、运维和 AI 的项目上下文，不在其他页面临时修改。</span>
            <button className="primary-button" type="button" disabled={!isDesktopRuntime()} onClick={() => void save()}>{draft.id ? "保存项目修改" : "创建项目"}</button>
          </footer>
        </Panel>
      </div>
    </div>
  );
}
