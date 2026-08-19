import { useEffect, useMemo, useState, type ReactNode, type SVGProps } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { probeStorage, type StorageProbe } from "../lib/database";
import { loadRuntimePolicy } from "../lib/runtimePolicy";
import { useTheme, type ThemeMode } from "../lib/theme";
import type { RuntimePolicy } from "../types";

type IconName =
  | "dashboard"
  | "projects"
  | "assets"
  | "diagnostics"
  | "deploy"
  | "changes"
  | "ai"
  | "knowledge"
  | "archive"
  | "providers"
  | "settings"
  | "menu"
  | "sun"
  | "moon"
  | "system"
  | "palette"
  | "plus";

function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  const paths: Record<IconName, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    projects: <><path d="M3 6h7l2 2h9v11H3z" /><path d="M3 9h18" /></>,
    assets: <><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></>,
    diagnostics: <><path d="M4 5h16v11H4z" /><path d="m7 9 2 2 3-4M8 20h8M12 16v4" /></>,
    deploy: <><path d="M12 3v12" /><path d="m7 8 5-5 5 5" /><path d="M5 13v7h14v-7" /></>,
    changes: <><path d="M7 3h10l2 2v16H5V5z" /><path d="M9 9h6M9 13h6M9 17h4" /></>,
    ai: <><path d="M8 3h8l2 3v12l-3 3H9l-3-3V6z" /><path d="M9 10h.01M15 10h.01M9 15c2 1.3 4 1.3 6 0" /><path d="M12 3V1" /></>,
    knowledge: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5A2.5 2.5 0 0 1 20 21.5z" /></>,
    archive: <><path d="M4 7h16v13H4z" /><path d="M3 3h18v4H3zM9 11h6" /></>,
    providers: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5L9 6.1a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.5 3.1h5l.5-3.1a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5a7 7 0 0 0 .1-1Z" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    moon: <path d="M20 15.2A8 8 0 0 1 8.8 4 8 8 0 1 0 20 15.2Z" />,
    system: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
    palette: <><path d="M12 3a9 9 0 0 0 0 18h1.4a1.6 1.6 0 0 0 1.1-2.7 1.6 1.6 0 0 1 1.1-2.7H18A3 3 0 0 0 21 12a9 9 0 0 0-9-9Z" /><circle cx="7.5" cy="10" r=".7" fill="currentColor" stroke="none" /><circle cx="10" cy="6.5" r=".7" fill="currentColor" stroke="none" /><circle cx="15" cy="7.5" r=".7" fill="currentColor" stroke="none" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
  };

  return <svg {...common} {...props}>{paths[name]}</svg>;
}

const navGroups = [
  {
    label: "现场运维",
    items: [
      { to: "/", label: "工作台", icon: "dashboard" as const },
      { to: "/projects", label: "项目中心", icon: "projects" as const },
      { to: "/assets", label: "服务器资产", icon: "assets" as const },
      { to: "/diagnostics", label: "现场诊断", icon: "diagnostics" as const },
      { to: "/deployments", label: "部署中心", icon: "deploy" as const },
      { to: "/changes", label: "变更中心", icon: "changes" as const },
    ],
  },
  {
    label: "智能与知识",
    items: [
      { to: "/ai", label: "AI 工作台", icon: "ai" as const },
      { to: "/skills", label: "Skill 专库", icon: "knowledge" as const },
      { to: "/knowledge", label: "双知识库", icon: "knowledge" as const },
    ],
  },
  {
    label: "系统",
    items: [
      { to: "/archive", label: "数据与归档", icon: "archive" as const },
      { to: "/ai-settings", label: "AI 服务配置", icon: "providers" as const },
      { to: "/settings", label: "偏好与安全", icon: "settings" as const },
    ],
  },
];

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "现场工作台", subtitle: "事实、计划、人工执行、验证与知识沉淀" },
  "/projects": { title: "项目中心", subtitle: "统一维护项目范围、系统架构、技术栈与现场约束" },
  "/assets": { title: "服务器资产", subtitle: "维护项目、环境事实与版本化快照" },
  "/diagnostics": { title: "现场诊断", subtitle: "生成只读采集包，人工执行并回传证据" },
  "/deployments": { title: "部署中心", subtitle: "离线模板、前置检查、验收与回滚" },
  "/changes": { title: "变更中心", subtitle: "命令与 SQL 只供审阅、复制和人工执行" },
  "/ai": { title: "AI 工作台", subtitle: "调用已配置服务，生成方案、排错、SQL 审查与知识草稿" },
  "/skills": { title: "Skill 专库", subtitle: "结构化模板、人工验证、版本和回滚策略" },
  "/knowledge": { title: "双知识库", subtitle: "内部优先、外部待审、验证后再沉淀" },
  "/archive": { title: "数据与归档", subtitle: "SQLite 完整性、可校验备份恢复与部署报告" },
  "/ai-settings": { title: "AI 服务配置", subtitle: "独立管理 Provider、模型、接口与会话密钥" },
  "/settings": { title: "偏好与安全", subtitle: "主题、存储状态和不可绕过的人工执行边界" },
};

const themeButtons: Array<{ mode: ThemeMode; icon: IconName; label: string }> = [
  { mode: "light", icon: "sun", label: "明亮主题" },
  { mode: "system", icon: "system", label: "跟随系统" },
  { mode: "dark", icon: "moon", label: "深色主题" },
];

export function AppShell() {
  const location = useLocation();
  const current = pageTitles[location.pathname] ?? pageTitles["/"];
  const { mode, setMode, customTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(
    () => window.localStorage.getItem("agnovexa.opsdesk.sidebar.collapsed") === "1",
  );
  const [storage, setStorage] = useState<StorageProbe>({
    mode: "browser-preview",
    detail: "正在检测本地存储…",
  });
  const [policy, setPolicy] = useState<RuntimePolicy | null>(null);

  useEffect(() => {
    void probeStorage().then(setStorage);
    void loadRuntimePolicy().then(setPolicy);
  }, []);

  const toggleSidebar = () => {
    setCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem("agnovexa.opsdesk.sidebar.collapsed", next ? "1" : "0");
      return next;
    });
  };

  const modeLabel = useMemo(
    () => (storage.mode === "sqlite" ? "本地 SQLite" : "浏览器预览"),
    [storage.mode],
  );

  return (
    <div className={`app-frame${collapsed ? " sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="brand-row">
          <Link className="brand" to="/" aria-label="AX Agnovexa OPSDESK，返回工作台">
            <div className="brand-symbol">AX</div>
            <div className="brand-copy">
              <strong>Agnovexa</strong>
              <span>OpsDesk</span>
            </div>
          </Link>
          <button className="icon-button sidebar-toggle" type="button" onClick={toggleSidebar} aria-label="收起或展开侧栏"><Icon name="menu" /></button>
        </div>

        <div className="policy-chip" title="系统没有 SSH、Shell、SFTP 或数据库自动执行能力">
          <span className="status-dot" />
          <span>人工执行模式</span>
        </div>

        <nav className="nav-list" aria-label="主导航">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-group-label">{group.label}</div>
              {group.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.to === "/"} className={({ isActive }) => `nav-item${isActive ? " active" : ""}`} title={item.label} aria-label={item.label}>
                  <span className="nav-icon"><Icon name={item.icon} /></span>
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-head"><span className="status-dot" /><strong>{storage.mode === "sqlite" ? "本地数据已就绪" : "预览模式"}</strong></div>
          <span>{policy?.executionMode === "manual-only" ? "所有目标环境操作由人工执行" : "正在读取运行策略"}</span>
          <small>v0.4.0 · Windows Desktop</small>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="topbar-copy">
            <div className="breadcrumb">AGNOVEXA / OPSDESK</div>
            <h1>{current.title}</h1>
            <p>{current.subtitle}</p>
          </div>

          <div className="topbar-actions">
            <div className="theme-switch" aria-label="主题切换">
              {[...themeButtons, ...(customTheme ? [{ mode: "custom" as const, icon: "palette" as const, label: customTheme.name }] : [])].map((item) => (
                <button key={item.mode} type="button" className={mode === item.mode ? "active" : ""} onClick={() => setMode(item.mode)} title={item.label} aria-label={item.label}><Icon name={item.icon} /></button>
              ))}
            </div>

            <div className="runtime-card" title={storage.detail}>
              <span className="status-dot" />
              <div><small>数据模式</small><strong>{modeLabel}</strong></div>
            </div>

            <Link className="primary-button topbar-primary" to="/deployments" aria-label="新建任务"><Icon name="plus" /><span>新建任务</span></Link>
          </div>
        </header>

        <main className="page-content"><Outlet /></main>
      </div>
    </div>
  );
}
