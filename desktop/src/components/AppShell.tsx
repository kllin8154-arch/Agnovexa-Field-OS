import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { probeStorage, type StorageProbe } from "../lib/database";
import { loadRuntimePolicy } from "../lib/runtimePolicy";
import type { RuntimePolicy } from "../types";

const navItems = [
  { to: "/", label: "工作台", mark: "工" },
  { to: "/assets", label: "服务器资产", mark: "资" },
  { to: "/diagnostics", label: "现场诊断", mark: "诊" },
  { to: "/deployments", label: "部署中心", mark: "部" },
  { to: "/changes", label: "变更中心", mark: "变" },
  { to: "/ai", label: "AI 助手", mark: "AI" },
  { to: "/knowledge", label: "知识库", mark: "知" },
  { to: "/settings", label: "设置", mark: "设" },
];

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "现场工作台", subtitle: "从事实采集到知识沉淀，全程由人工掌控" },
  "/assets": { title: "服务器资产", subtitle: "记录资产事实、环境快照和项目归属" },
  "/diagnostics": { title: "现场诊断", subtitle: "生成只读采集包，人工执行并回传证据" },
  "/deployments": { title: "部署中心", subtitle: "离线模板、前置检查、验证与回滚" },
  "/changes": { title: "变更中心", subtitle: "审阅命令与 Diff，不连接、不代替人工执行" },
  "/ai": { title: "多 Provider AI 助手", subtitle: "脱敏后调用，生成草案，命令与 SQL 始终由人工执行" },
  "/knowledge": { title: "双知识库", subtitle: "内部优先、外部待审、验证后再沉淀" },
  "/settings": { title: "安全与运行策略", subtitle: "禁止服务器连接和自动执行，仅允许显式 AI 接口调用" },
};

export function AppShell() {
  const location = useLocation();
  const current = pageTitles[location.pathname] ?? pageTitles["/"];
  const [storage, setStorage] = useState<StorageProbe>({
    mode: "browser-preview",
    detail: "正在检测本地存储…",
  });
  const [policy, setPolicy] = useState<RuntimePolicy | null>(null);

  useEffect(() => {
    void probeStorage().then(setStorage);
    void loadRuntimePolicy().then(setPolicy);
  }, []);

  const modeLabel = useMemo(
    () => (storage.mode === "sqlite" ? "本地 SQLite" : "浏览器预览"),
    [storage.mode],
  );

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-symbol">AX</div>
          <div>
            <strong>Agnovexa</strong>
            <span>OpsDesk</span>
          </div>
        </div>

        <div className="policy-chip">
          <span className="status-dot" />
          本地优先 · 人工执行
        </div>

        <nav className="nav-list" aria-label="主导航">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
            >
              <span className="nav-mark">{item.mark}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-kicker">运行边界</div>
          <strong>{policy?.executionMode === "manual-only" ? "手工执行模式" : "受限模式"}</strong>
          <span>SSH / Shell：未启用</span>
          <span>SQL 自动执行：未启用</span>
          <span>AI：仅显式 Provider 请求</span>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div>
            <div className="breadcrumb">OPS DESK / {current.title}</div>
            <h1>{current.title}</h1>
            <p>{current.subtitle}</p>
          </div>
          <div className="topbar-actions">
            <div className="runtime-card" title={storage.detail}>
              <span className="status-dot" />
              <div>
                <small>数据模式</small>
                <strong>{modeLabel}</strong>
              </div>
            </div>
            <button className="primary-button" type="button">
              ＋ 新建部署任务
            </button>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
