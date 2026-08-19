import { useEffect, useMemo, useState } from "react";
import { Notice, Panel, Tag } from "../components/Ui";
import {
  createAsset,
  createProject,
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

const SNAPSHOT_LABELS: Record<AssetRecord["snapshotStatus"], string> = {
  complete: "完整",
  missing: "缺失",
  conflict: "冲突",
  uncollected: "未采集",
};

export function AssetsPage() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [query, setQuery] = useState("");
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectCode, setProjectCode] = useState("");
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
    } catch (error) {
      setStatus({ tone: "danger", title: "资产台账读取失败", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return assets;
    return assets.filter((asset) =>
      [asset.name, asset.projectName, asset.host, asset.operatingSystem, asset.serverModel, ...asset.tags]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [assets, query]);

  const submitProject = async () => {
    try {
      const project = await createProject({ name: projectName, code: projectCode });
      setProjects((current) => [project, ...current]);
      setAssetForm((current) => ({ ...current, projectId: project.id }));
      setProjectName("");
      setProjectCode("");
      setShowProjectForm(false);
      setStatus({ tone: "success", title: "项目已创建", message: `项目“${project.name}”已写入本地 SQLite。` });
    } catch (error) {
      setStatus({ tone: "danger", title: "项目创建失败", message: error instanceof Error ? error.message : String(error) });
    }
  };

  const submitAsset = async () => {
    try {
      await createAsset({
        ...assetForm,
        port: Number(assetForm.port),
        tags: assetForm.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
      });
      setAssetForm((current) => ({ ...EMPTY_ASSET_FORM, projectId: current.projectId }));
      setShowAssetForm(false);
      setStatus({ tone: "success", title: "服务器资产已登记", message: "资产只进入本地台账，应用不会尝试连接该服务器。" });
      await load();
    } catch (error) {
      setStatus({ tone: "danger", title: "资产登记失败", message: error instanceof Error ? error.message : String(error) });
    }
  };

  const removeAsset = async (asset: AssetRecord) => {
    if (!window.confirm(`确定从本地台账删除“${asset.name}”吗？关联任务存在时数据库会阻止删除。`)) return;
    try {
      await deleteAsset(asset.id);
      setStatus({ tone: "success", title: "资产已删除", message: `“${asset.name}”已从本地台账移除。` });
      await load();
    } catch (error) {
      setStatus({ tone: "danger", title: "资产删除失败", message: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <div className="page-stack assets-page">
      {!isDesktopRuntime() && (
        <Notice tone="info" title="浏览器预览不写入资产数据">
          安装 Windows 桌面版后，项目、资产和环境快照将保存在本机 SQLite；程序仍不会连接服务器。
        </Notice>
      )}
      {status && <Notice tone={status.tone} title={status.title}>{status.message}</Notice>}

      <Panel
        eyebrow="WORKSPACE REGISTER"
        title="项目与资产台账"
        actions={
          <div className="inline-actions">
            <input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索项目、主机、系统或标签" />
            <button className="secondary-button" type="button" disabled={!isDesktopRuntime()} onClick={() => setShowProjectForm((value) => !value)}>新建项目</button>
            <button className="primary-button" type="button" disabled={!isDesktopRuntime() || projects.length === 0} onClick={() => setShowAssetForm((value) => !value)}>登记资产</button>
          </div>
        }
      >
        {showProjectForm && (
          <div className="inline-editor">
            <div><span>项目名称</span><input className="text-input" value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="例如：湖南数字地质" /></div>
            <div><span>项目编码</span><input className="text-input" value={projectCode} onChange={(event) => setProjectCode(event.target.value)} placeholder="可选，例如 HNDZ-2026" /></div>
            <button className="primary-button" type="button" onClick={() => void submitProject()}>保存项目</button>
          </div>
        )}

        {showAssetForm && (
          <div className="entity-form asset-entity-form">
            <label><span>所属项目</span><select className="select-input" value={assetForm.projectId} onChange={(event) => setAssetForm((current) => ({ ...current, projectId: event.target.value }))}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
            <label><span>资产名称</span><input className="text-input" value={assetForm.name} onChange={(event) => setAssetForm((current) => ({ ...current, name: event.target.value }))} placeholder="例如：地图发布节点" /></label>
            <label><span>主机名 / 资产编号 / IP</span><input className="text-input" value={assetForm.host} onChange={(event) => setAssetForm((current) => ({ ...current, host: event.target.value }))} placeholder="只用于台账，不会自动连接" /></label>
            <label><span>参考端口</span><input className="text-input" inputMode="numeric" value={assetForm.port} onChange={(event) => setAssetForm((current) => ({ ...current, port: event.target.value }))} /></label>
            <label><span>环境</span><select className="select-input" value={assetForm.environment} onChange={(event) => setAssetForm((current) => ({ ...current, environment: event.target.value as AssetRecord["environment"] }))}><option value="development">开发</option><option value="test">测试</option><option value="staging">预生产</option><option value="production">生产</option><option value="demo">演示</option></select></label>
            <label><span>架构</span><select className="select-input" value={assetForm.architecture} onChange={(event) => setAssetForm((current) => ({ ...current, architecture: event.target.value as AssetRecord["architecture"] }))}><option value="unknown">待采集</option><option value="x86_64">x86_64</option><option value="aarch64">aarch64</option></select></label>
            <label><span>服务器型号</span><input className="text-input" value={assetForm.serverModel} onChange={(event) => setAssetForm((current) => ({ ...current, serverModel: event.target.value }))} placeholder="可留空，后续采集" /></label>
            <label><span>操作系统</span><input className="text-input" value={assetForm.operatingSystem} onChange={(event) => setAssetForm((current) => ({ ...current, operatingSystem: event.target.value }))} placeholder="可留空，后续采集" /></label>
            <label className="wide-field"><span>标签</span><input className="text-input" value={assetForm.tags} onChange={(event) => setAssetForm((current) => ({ ...current, tags: event.target.value }))} placeholder="GeoServer, PostgreSQL, 业务节点" /></label>
            <label className="wide-field"><span>现场备注</span><textarea className="evidence-input small" value={assetForm.notes} onChange={(event) => setAssetForm((current) => ({ ...current, notes: event.target.value }))} placeholder="记录机房、网络限制、用途等非秘密信息" /></label>
            <div className="form-actions wide-field"><button className="secondary-button" type="button" onClick={() => setShowAssetForm(false)}>取消</button><button className="primary-button" type="button" onClick={() => void submitAsset()}>保存资产</button></div>
          </div>
        )}

        {loading ? (
          <div className="loading-state">正在读取本地资产台账…</div>
        ) : projects.length === 0 ? (
          <div className="empty-state compact"><div className="empty-state-mark">PJ</div><h2>先创建项目工作区</h2><p>项目用于隔离资产、任务、执行证据和私有知识。</p><button className="primary-button" type="button" disabled={!isDesktopRuntime()} onClick={() => setShowProjectForm(true)}>新建项目</button></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state compact"><div className="empty-state-mark">AX</div><h2>{query ? "没有匹配资产" : "还没有服务器资产"}</h2><p>{query ? "调整搜索条件。" : "登记资产后即可保存环境快照和创建人工执行任务。"}</p></div>
        ) : (
          <div className="asset-grid production-asset-grid">
            {filtered.map((asset) => (
              <article className="asset-card" key={asset.id}>
                <div className="asset-card-top">
                  <div><span className={`environment environment-${asset.environmentLabel}`}>{asset.environmentLabel}</span><h3>{asset.name}</h3><p>{asset.projectName}</p></div>
                  <span className={`snapshot snapshot-${SNAPSHOT_LABELS[asset.snapshotStatus]}`}>{SNAPSHOT_LABELS[asset.snapshotStatus]}</span>
                </div>
                <dl className="definition-grid">
                  <div><dt>台账地址</dt><dd className="mono-cell">{asset.host}:{asset.port}</dd></div>
                  <div><dt>系统</dt><dd>{asset.operatingSystem || "待采集"}</dd></div>
                  <div><dt>架构</dt><dd>{asset.architecture}</dd></div>
                  <div><dt>服务器型号</dt><dd>{asset.serverModel || "待采集"}</dd></div>
                  <div><dt>执行策略</dt><dd>人工复制执行</dd></div>
                  <div><dt>最近快照</dt><dd>{asset.lastSnapshotAt ?? "未采集"}</dd></div>
                </dl>
                <div className="tag-row">{asset.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</div>
                <div className="card-actions"><a className="secondary-button" href={`#/diagnostics?asset=${encodeURIComponent(asset.id)}`}>采集快照</a><button className="text-button danger-text" type="button" onClick={() => void removeAsset(asset)}>删除</button></div>
              </article>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
