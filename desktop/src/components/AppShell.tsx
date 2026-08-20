import { useEffect, useState, type ReactNode, type SVGProps } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { BrandMark } from "./BrandMark";
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
  | "verification"
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
    verification: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.6 2.6L16.5 9" /></>,
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

const primaryNavigation = [
  { to: "/", label: "开始", icon: "dashboard" as const },
  { to: "/projects", label: "项目", icon: "projects" as const },
  { to: "/deployments", label: "部署", icon: "deploy" as const },
  { to: "/ai", label: "AI 助手", icon: "ai" as const },
];

const toolNavigation = [
  { to: "/assets", label: "服务器", icon: "assets" as const },
  { to: "/diagnostics", label: "现场检查", icon: "diagnostics" as const },
  { to: "/changes", label: "执行与变更", icon: "changes" as const },
  { to: "/verification", label: "验收记录", icon: "verification" as const },
  { to: "/skills", label: "任务模板", icon: "knowledge" as const },
  { to: "/knowledge", label: "知识库", icon: "knowledge" as const },
  { to: "/archive", label: "数据备份", icon: "archive" as const },
  { to: "/ai-settings", label: "AI 设置", icon: "providers" as const },
  { to: "/settings", label: "外观与安全", icon: "settings" as const },
];

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "开始", subtitle: "跟着提示完成准备，然后开始部署或排查问题" },
  "/projects": { title: "项目", subtitle: "项目资料只需维护一次，其他功能会自动使用" },
  "/assets": { title: "服务器", subtitle: "登记项目中的服务器；系统不会自动连接" },
  "/diagnostics": { title: "现场检查", subtitle: "生成检查命令，人工执行后粘贴结果" },
  "/deployments": { title: "部署", subtitle: "选择服务器和工作内容，快速创建任务" },
  "/changes": { title: "执行与变更", subtitle: "查看命令、记录执行结果和回滚信息" },
  "/verification": { title: "验收记录", subtitle: "记录文件、服务、网络和业务检查结果" },
  "/ai": { title: "AI 助手", subtitle: "选择项目后直接提问，已有资料会自动带入" },
  "/skills": { title: "任务模板", subtitle: "维护可重复使用的操作步骤" },
  "/knowledge": { title: "知识库", subtitle: "保存已经核验的处理经验" },
  "/archive": { title: "数据备份", subtitle: "备份或恢复本机数据" },
  "/ai-settings": { title: "AI 设置", subtitle: "配置 AI 服务、模型和临时密钥" },
  "/settings": { title: "外观与安全", subtitle: "切换主题并查看本机运行状态" },
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
  const [storage, setStorage] = useState<StorageProbe>({
    mode: "browser-preview",
    detail: "正在检测本地存储…",
  });
  const [policy, setPolicy] = useState<RuntimePolicy | null>(null);

  useEffect(() => {
    void probeStorage().then(setStorage);
    void loadRuntimePolicy().then(setPolicy);
  }, []);

  return (
    <div className="app-frame simple-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <Link className="brand" to="/" aria-label="Agnovexa OpsDesk，返回工作台">
            <div className="brand-symbol" aria-hidden="true">
              <BrandMark className="brand-mark" />
            </div>
            <div className="brand-copy">
              <strong>Agnovexa</strong>
              <span>OpsDesk</span>
            </div>
          </Link>
        </div>

        <div className="policy-chip" title="所有目标环境操作均由用户人工确认并执行">
          <span className="status-dot" />
          <span>本机使用，不会自动操作服务器</span>
        </div>

        <nav className="nav-list" aria-label="主导航">
          {primaryNavigation.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/"} className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
              <span className="nav-icon"><Icon name={item.icon} /></span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}

          <details className="sidebar-tools" open={toolNavigation.some((item) => item.to === location.pathname) || undefined}>
            <summary><span className="nav-icon"><Icon name="menu" /></span><span>更多功能</span></summary>
            <div className="sidebar-tool-list">
              {toolNavigation.map((item) => (
                <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
                  <span className="nav-icon"><Icon name={item.icon} /></span>
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </details>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-theme" aria-label="主题切换">
            {[...themeButtons, ...(customTheme ? [{ mode: "custom" as const, icon: "palette" as const, label: customTheme.name }] : [])].map((item) => (
              <button key={item.mode} type="button" className={mode === item.mode ? "active" : ""} onClick={() => setMode(item.mode)} title={item.label} aria-label={item.label}><Icon name={item.icon} /></button>
            ))}
          </div>
          <div className="sidebar-footer-head"><span className="status-dot" /><strong>{storage.mode === "sqlite" ? "数据已保存在本机" : "当前为预览模式"}</strong></div>
          <small>{policy?.executionMode === "manual-only" ? "只生成建议，由人工执行" : "正在读取安全设置"}</small>
          <small>v0.4.0 · Build 65</small>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="topbar-copy">
            <h1>{current.title}</h1>
            <p>{current.subtitle}</p>
          </div>
          <span className="topbar-status" title={storage.detail}><span className="status-dot" />{storage.mode === "sqlite" ? "本机数据" : "预览模式"}</span>
        </header>

        <main className="page-content"><Outlet /></main>
      </div>
    </div>
  );
}
