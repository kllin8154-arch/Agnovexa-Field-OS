import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Notice, Pagination, Panel, Tag } from "../components/Ui";
import {
  createAsset,
  deleteAsset,
  isDesktopRuntime,
  listAssets,
  listProjects,
  type AssetRecord,
  type ProjectRecord,
} from "../lib/repository";

const EMPTY_ASSET_FORM = {
  projectId: "",
  name: "",
  host: "",
  port: "22",
  username: "",
  serverModel: "",
  operatingSystem: "",
  architecture: "unknown" as AssetRecord["architecture"],
  environment: "production" as AssetRecord["environment"],
  tags: "",
  notes: "",
};

const ASSET_PAGE_SIZE = 8;

export function AssetsPage() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"list" | "form">("list");
  const [page, setPage] = useState(1);
  const [assetForm, setAssetForm] = useState(EMPTY_ASSET_FORM);
  const [status, setStatus] = useState<{ tone: "success" | "danger" | "info"; title: string; message: string } | null>(null);
  const [loading, setLoading] = useState(isDesktopRuntime());

  const load = async () => {
    if (!isDesktopRuntime()) return;
    setLoading(true);
    try {
      const [nextProjects, nextAssets] = await Promise.all([listProjects(), listAssets()]);
      setProjects(nextProjects);
      setAssets(nextAssets);
      setAssetForm((current) => ({ ...current, projectId: current.projectId || nextProjects[0]?.id || "" }));
      if (nextProjects.length > 0 && nextAssets.length === 0) setView("form");
    } catch (error) {
      setStatus({ tone: "danger", title: "服务器资料读取失败", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return assets;
    return assets.filter((asset) => [asset.name, asset.projectName, asset.host, asset.operatingSystem, ...asset.tags].join(" ").toLowerCase().includes(keyword));
  }, [assets, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / ASSET_PAGE_SIZE));
  const visibleAssets = filtered.slice((page - 1) * ASSET_PAGE_SIZE, page * ASSET_PAGE_SIZE);

  useEffect(() => setPage(1), [query]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const startCreate = () => {
    setAssetForm({ ...EMPTY_ASSET_FORM, projectId: projects[0]?.id || "" });
    setStatus(null);
    setView("form");
  };

  const submitAsset = async () => {
    try {
      await createAsset({
        ...assetForm,
        port: Number(assetForm.port),
        tags: assetForm.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
      });
      setStatus({ tone: "success", title: "服务器登记好了", message: "现在可以为这台服务器创建部署任务或进行现场检查。" });
      setView("list");
      await load();
    } catch (error) {
      setStatus({ tone: "danger", title: "没有保存成功", message: error instanceof Error ? error.message : String(error) });
    }
  };

  const removeAsset = async (asset: AssetRecord) => {
    if (!window.confirm(`确定删除“${asset.name}”吗？有关联任务时系统会阻止删除。`)) return;
    try {
      await deleteAsset(asset.id);
      setStatus({ tone: "success", title: "服务器已删除", message: `“${asset.name}”已从本机资料中移除。` });
      await load();
    } catch (error) {
      setStatus({ tone: "danger", title: "删除失败", message: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <div className="page-stack assets-page simple-assets-page">
      {!isDesktopRuntime() && <Notice tone="info" title="当前是界面预览">桌面版会把服务器资料保存在本机，但不会主动连接服务器。</Notice>}
      {status && <Notice tone={status.tone} title={status.title}>{status.message}{status.tone === "success" && <div className="notice-next-action"><Link to="/deployments">创建部署任务 →</Link></div>}</Notice>}

      {projects.length === 0 && !loading ? (
        <Panel title="先创建项目">
          <div className="empty-state compact"><div className="empty-state-mark">1</div><h2>服务器需要属于一个项目</h2><p>先创建项目，再回来登记服务器。</p><Link className="primary-button" to="/projects">创建项目</Link></div>
        </Panel>
      ) : view === "form" ? (
        <Panel title="登记服务器" actions={assets.length > 0 && <button className="text-button" type="button" onClick={() => setView("list")}>返回服务器列表</button>} className="simple-asset-form-panel">
          <div className="simple-form-intro"><strong>填写三项基本信息</strong><p>这些内容只保存在本机，不会用来自动登录服务器。</p></div>
          <div className="simple-core-form asset-core-form">
            <label><span>所属项目 <b>必填</b></span><select className="select-input" value={assetForm.projectId} onChange={(event) => setAssetForm((current) => ({ ...current, projectId: event.target.value }))}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
            <label><span>服务器名称 <b>必填</b></span><input className="text-input" autoFocus value={assetForm.name} onChange={(event) => setAssetForm((current) => ({ ...current, name: event.target.value }))} placeholder="例如：地图发布服务器" /></label>
            <label><span>IP、主机名或资产编号 <b>必填</b></span><input className="text-input" value={assetForm.host} onChange={(event) => setAssetForm((current) => ({ ...current, host: event.target.value }))} placeholder="例如：192.168.10.20" /></label>
          </div>

          <details className="optional-settings">
            <summary><div><strong>端口、系统和其他资料</strong><small>可选，需要时再填写</small></div><span>展开</span></summary>
            <div className="optional-settings-body simple-form-grid">
              <label><span>参考端口</span><input className="text-input" inputMode="numeric" value={assetForm.port} onChange={(event) => setAssetForm((current) => ({ ...current, port: event.target.value }))} /></label>
              <label><span>环境</span><select className="select-input" value={assetForm.environment} onChange={(event) => setAssetForm((current) => ({ ...current, environment: event.target.value as AssetRecord["environment"] }))}><option value="production">生产</option><option value="staging">预生产</option><option value="test">测试</option><option value="development">开发</option><option value="demo">演示</option></select></label>
              <label><span>操作系统</span><input className="text-input" value={assetForm.operatingSystem} onChange={(event) => setAssetForm((current) => ({ ...current, operatingSystem: event.target.value }))} placeholder="如：银河麒麟 V10 SP3" /></label>
              <label><span>CPU 架构</span><select className="select-input" value={assetForm.architecture} onChange={(event) => setAssetForm((current) => ({ ...current, architecture: event.target.value as AssetRecord["architecture"] }))}><option value="unknown">暂不确定</option><option value="x86_64">x86_64</option><option value="aarch64">ARM / aarch64</option></select></label>
              <label><span>服务器型号</span><input className="text-input" value={assetForm.serverModel} onChange={(event) => setAssetForm((current) => ({ ...current, serverModel: event.target.value }))} /></label>
              <label><span>标签</span><input className="text-input" value={assetForm.tags} onChange={(event) => setAssetForm((current) => ({ ...current, tags: event.target.value }))} placeholder="如：Java、Nginx、GeoServer" /></label>
              <label className="wide-field"><span>备注</span><textarea className="evidence-input small" value={assetForm.notes} onChange={(event) => setAssetForm((current) => ({ ...current, notes: event.target.value }))} placeholder="用途或现场限制；不要填写密码" /></label>
            </div>
          </details>

          <footer className="simple-form-actions">
            {assets.length > 0 && <button className="secondary-button" type="button" onClick={() => setView("list")}>取消</button>}
            <button className="primary-button" type="button" disabled={!isDesktopRuntime() || !assetForm.projectId || assetForm.name.trim().length < 2 || !assetForm.host.trim()} onClick={() => void submitAsset()}>保存服务器</button>
          </footer>
        </Panel>
      ) : (
        <Panel title="我的服务器" actions={<button className="primary-button" type="button" onClick={startCreate}>登记服务器</button>} className="simple-asset-list-panel">
          {assets.length > 6 && <div className="simple-list-toolbar"><input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索服务器" aria-label="搜索服务器" /><span>{filtered.length} 台</span></div>}
          {loading ? <div className="loading-state">正在读取服务器资料…</div> : filtered.length === 0 ? (
            <div className="empty-state compact"><div className="empty-state-mark">2</div><h2>登记第一台服务器</h2><p>只需要名称和地址。</p><button className="primary-button" type="button" onClick={startCreate}>登记服务器</button></div>
          ) : <div className="simple-asset-list">{visibleAssets.map((asset) => (
            <article key={asset.id}>
              <div className="simple-asset-heading"><span>{asset.environmentLabel}</span><div><strong>{asset.name}</strong><small>{asset.projectName}</small></div></div>
              <dl><div><dt>地址</dt><dd>{asset.host}:{asset.port}</dd></div><div><dt>环境</dt><dd>{asset.operatingSystem || "待补充"} · {asset.architecture === "unknown" ? "架构待补充" : asset.architecture}</dd></div></dl>
              {asset.tags.length > 0 && <div className="tag-row">{asset.tags.slice(0, 5).map((tag) => <Tag key={tag}>{tag}</Tag>)}</div>}
              <footer><Link className="secondary-button" to={`/diagnostics?asset=${encodeURIComponent(asset.id)}`}>现场检查</Link><button className="text-button danger-text" type="button" onClick={() => void removeAsset(asset)}>删除</button></footer>
            </article>
          ))}</div>}
          <Pagination page={page} pageCount={pageCount} onChange={setPage} label="服务器列表分页" />
        </Panel>
      )}
    </div>
  );
}
