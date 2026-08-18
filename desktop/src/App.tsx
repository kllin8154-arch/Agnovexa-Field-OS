import { HashRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AiWorkspacePage } from "./pages/AiWorkspacePage";
import { AssetsPage } from "./pages/AssetsPage";
import { ChangesPage } from "./pages/ChangesPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DeploymentPage } from "./pages/DeploymentPage";
import { DiagnosticsPage } from "./pages/DiagnosticsPage";
import { KnowledgePage } from "./pages/KnowledgePage";
import { SettingsPage } from "./pages/SettingsPage";

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
          <Route path="knowledge" element={<KnowledgePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
