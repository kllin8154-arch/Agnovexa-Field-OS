import { useMemo, useState } from "react";
import { assets } from "../data/mock";
import { Panel, Tag } from "../components/Ui";

export function AssetsPage() {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return assets;
    return assets.filter((asset) =>
      [asset.name, asset.project, asset.host, asset.operatingSystem, ...asset.tags]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [query]);

  return (
    <div className="page-stack">
      <Panel
        eyebrow="ASSET REGISTER"
        title="资产台账"
        actions={
          <input
            className="search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索主机、项目、系统或标签"
            aria-label="搜索资产"
          />
        }
      >
        <div className="asset-grid">
          {filtered.map((asset) => (
            <article className="asset-card" key={asset.id}>
              <div className="asset-card-top">
                <div>
                  <span className={`environment environment-${asset.environment}`}>{asset.environment}</span>
                  <h3>{asset.name}</h3>
                  <p>{asset.project}</p>
                </div>
                <span className={`snapshot snapshot-${asset.snapshotStatus}`}>{asset.snapshotStatus}</span>
              </div>

              <dl className="definition-grid">
                <div><dt>地址</dt><dd className="mono-cell">{asset.host}:{asset.port}</dd></div>
                <div><dt>系统</dt><dd>{asset.operatingSystem}</dd></div>
                <div><dt>架构</dt><dd>{asset.architecture}</dd></div>
                <div><dt>服务器型号</dt><dd>{asset.serverModel}</dd></div>
                <div><dt>连接策略</dt><dd>人工复制执行</dd></div>
                <div><dt>最近快照</dt><dd>{asset.lastSnapshotAt ?? "未采集"}</dd></div>
              </dl>

              <div className="tag-row">
                {asset.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}
              </div>

              <div className="card-actions">
                <button className="secondary-button" type="button">生成采集包</button>
                <button className="text-button" type="button">查看历史</button>
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}
