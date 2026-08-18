import { useMemo, useState } from "react";
import { knowledgeEntries } from "../data/mock";
import { Notice, Panel, RiskBadge, StatusBadge, Tag } from "../components/Ui";

export function KnowledgePage() {
  const [scope, setScope] = useState<"inner" | "public">("inner");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return knowledgeEntries.filter((entry) => {
      if (entry.sourceScope !== scope) return false;
      if (!keyword) return true;
      return [entry.title, entry.summary, ...entry.tags, ...entry.applicableVersions]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [scope, query]);

  return (
    <div className="page-stack">
      <div className="kb-switcher" role="tablist" aria-label="知识库范围">
        <button
          type="button"
          className={scope === "inner" ? "active" : ""}
          onClick={() => setScope("inner")}
        >
          KB-Inner 内部知识
        </button>
        <button
          type="button"
          className={scope === "public" ? "active" : ""}
          onClick={() => setScope("public")}
        >
          KB-Public 外部资料
        </button>
      </div>

      {scope === "public" && (
        <Notice tone="warning" title="外部资料默认不可直接执行">
          公共缓存与实时检索只能生成待审核草案。经过脱敏、测试验证、人工审核和审计记录后，才可转入内部已验证知识。
        </Notice>
      )}

      <Panel
        eyebrow={scope === "inner" ? "PRIVATE / OFFLINE" : "PUBLIC / REVIEWED CACHE"}
        title={scope === "inner" ? "内部受控知识库" : "外部公开资料库"}
        actions={
          <input
            className="search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索标题、现象、版本或标签"
            aria-label="搜索知识库"
          />
        }
      >
        <div className="knowledge-list">
          {filtered.map((entry) => (
            <article className="knowledge-card" key={entry.id}>
              <div className="knowledge-card-top">
                <div>
                  <span className={`scope scope-${entry.sourceScope}`}>
                    {entry.sourceScope === "inner" ? "KB-INNER" : "KB-PUBLIC"}
                  </span>
                  <h3>{entry.title}</h3>
                </div>
                <div className="inline-actions">
                  <StatusBadge status={entry.verificationStatus} />
                  <RiskBadge level={entry.riskLevel} />
                </div>
              </div>
              <p>{entry.summary}</p>
              <div className="knowledge-meta">
                <span>类型：{entry.sourceType}</span>
                <span>适用：{entry.environmentScope}</span>
                <span>版本：{entry.applicableVersions.join("、")}</span>
                <span>最后验证：{entry.lastVerifiedAt ?? "未验证"}</span>
              </div>
              <div className="tag-row">
                {entry.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}
              </div>
              <div className="card-actions">
                <button className="secondary-button" type="button">查看条目</button>
                <button className="text-button" type="button" disabled={entry.verificationStatus !== "verified"}>
                  生成变更草案
                </button>
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}
