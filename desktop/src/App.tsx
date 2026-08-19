import { HashRouter, Link, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AiProviderSettingsPage } from "./pages/AiProviderSettingsPage";
import { AiWorkspacePage } from "./pages/AiWorkspacePage";
import { ArchivePage } from "./pages/ArchivePage";
import { AssetsPage } from "./pages/AssetsPage";
import { ChangesPage } from "./pages/ChangesPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DeploymentPage } from "./pages/DeploymentPage";
import { DiagnosticsPage } from "./pages/DiagnosticsPage";
import { KnowledgePage } from "./pages/KnowledgePage";
import { SettingsPage } from "./pages/SettingsPage";

function NotFoundPage() {
  return (
    <div className="page-stack">
      <section className="empty-state large">
        <div className="empty-state-mark">404</div>
        <h2>没有找到这个工作区页面</h2>
        <p>页面可能已经调整到新的导航位置，返回工作台继续。</p>
        <Link className="primary-button" to="/">返回工作台</Link>
      </section>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="assets" element={<AssetsPage />} />
          <Route path="diagnostics" element={<DiagnosticsPage />} />
          <Route path="deployments" element={<DeploymentPage />} />
          <Route path="changes" element={<ChangesPage />} />
          <Route path="ai" element={<AiWorkspacePage />} />
          <Route path="ai-settings" element={<AiProviderSettingsPage />} />
          <Route path="knowledge" element={<KnowledgePage />} />
          <Route path="archive" element={<ArchivePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
