import {
  clipProductionText,
  getProductionDatabase,
  makeProductionId,
  writeProductionAudit,
} from "./productionCore";
import { listKnowledge, type KnowledgeRecord } from "./repository";

function mapKnowledgeRow(row: Record<string, unknown>): KnowledgeRecord {
  const tags = String(row.tags ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  return {
    id: String(row.id),
    projectId: row.project_id ? String(row.project_id) : undefined,
    projectName: row.project_name ? String(row.project_name) : undefined,
    title: String(row.title ?? ""),
    summary: String(row.summary ?? ""),
    bodyMarkdown: String(row.body_markdown ?? ""),
    tags,
    sourceScope: row.source_scope as KnowledgeRecord["sourceScope"],
    sourceType: row.source_type as KnowledgeRecord["sourceType"],
    verificationStatus: row.verification_status as KnowledgeRecord["verificationStatus"],
    environmentScope: row.environment_scope as KnowledgeRecord["environmentScope"],
    riskLevel: row.risk_level as KnowledgeRecord["riskLevel"],
    lastVerifiedAt: row.last_verified_at ? String(row.last_verified_at) : undefined,
    updatedAt: String(row.updated_at ?? ""),
  };
}

function buildFtsQuery(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/["'*:^()]/g, "").trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((token) => `"${token}"*`)
    .join(" AND ");
}

export async function searchKnowledgeAdvanced(input: {
  scope: "inner" | "public";
  query?: string;
}): Promise<KnowledgeRecord[]> {
  const keyword = input.query?.trim() ?? "";
  if (!keyword) return listKnowledge(input);
  const ftsQuery = buildFtsQuery(keyword);
  if (!ftsQuery) return listKnowledge(input);
  const db = await getProductionDatabase();
  try {
    const rows = await db.select<Array<Record<string, unknown>>>(
      `SELECT k.id, k.project_id, p.name AS project_name, k.title, k.summary,
              k.body_markdown, k.tags, k.source_scope, k.source_type,
              k.verification_status, k.environment_scope, k.risk_level,
              k.last_verified_at, k.updated_at
       FROM knowledge_fts
       JOIN knowledge_entries k ON k.id = knowledge_fts.knowledge_id
       LEFT JOIN projects p ON p.id = k.project_id
       WHERE k.source_scope = $1 AND knowledge_fts MATCH $2
       ORDER BY bm25(knowledge_fts),
                CASE k.verification_status WHEN 'verified' THEN 0 WHEN 'reviewed' THEN 1 ELSE 2 END,
                k.updated_at DESC`,
      [input.scope, ftsQuery],
    );
    return rows.map(mapKnowledgeRow);
  } catch {
    return listKnowledge(input);
  }
}

export async function verifyKnowledgeEntry(input: {
  id: string;
  reviewer: string;
  evidence: string;
}): Promise<void> {
  if (input.reviewer.trim().length < 2) throw new Error("请填写验证人员。");
  if (input.evidence.trim().length < 20) throw new Error("验证证据至少需要 20 个字符。");
  const db = await getProductionDatabase();
  const rows = await db.select<Array<{ source_scope: string; verification_status: string }>>(
    "SELECT source_scope, verification_status FROM knowledge_entries WHERE id = $1",
    [input.id],
  );
  const entry = rows[0];
  if (!entry) throw new Error("未找到知识条目。");
  if (entry.source_scope !== "inner") throw new Error("外部资料必须通过“转入内部库”流程，不能原地标记 verified。");
  if (entry.verification_status === "deprecated") throw new Error("已停用知识不能直接验证。");

  await db.execute(
    `UPDATE knowledge_entries
     SET verification_status = 'verified', validation_evidence_redacted = $1,
         maintainer = $2, last_verified_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
    [clipProductionText(input.evidence.trim()), input.reviewer.trim(), input.id],
  );
  await writeProductionAudit({
    actor: input.reviewer,
    eventType: "knowledge.verified",
    entityType: "knowledge_entry",
    entityId: input.id,
    detail: { evidence: clipProductionText(input.evidence.trim(), 4_000) },
  });
}

export async function promotePublicKnowledge(input: {
  id: string;
  projectId?: string;
  reviewer: string;
  evidence: string;
}): Promise<string> {
  if (input.reviewer.trim().length < 2) throw new Error("请填写审核人员。");
  if (input.evidence.trim().length < 20) throw new Error("现场验证证据至少需要 20 个字符。");
  const db = await getProductionDatabase();
  const rows = await db.select<Array<Record<string, unknown>>>(
    "SELECT * FROM knowledge_entries WHERE id = $1 AND source_scope = 'public'",
    [input.id],
  );
  const source = rows[0];
  if (!source) throw new Error("未找到外部知识条目。");
  if (String(source.verification_status) !== "reviewed") {
    throw new Error("外部资料必须先完成人工审核并处于 reviewed 状态，才能在现场验证后转入内部库。");
  }

  const id = makeProductionId("knowledge");
  const body = `${String(source.body_markdown ?? "")}\n\n## 转入内部库审核\n- 原外部条目：${input.id}\n- 审核人：${input.reviewer.trim()}\n- 现场验证证据：${clipProductionText(input.evidence.trim(), 6_000)}`;
  await db.execute(
    `INSERT INTO knowledge_entries (
       id, project_id, title, summary, body_markdown, tags, source_scope,
       source_type, verification_status, environment_scope, risk_level,
       applicable_versions_json, validation_evidence_redacted, rollback_plan,
       maintainer, last_verified_at, requires_human_approval,
       contains_sensitive_data, web_source_reviewed
     ) VALUES ($1, $2, $3, $4, $5, $6, 'inner', $7, 'verified', $8, $9,
               $10, $11, $12, $13, CURRENT_TIMESTAMP, 1, 0, 1)`,
    [
      id,
      input.projectId || null,
      String(source.title ?? ""),
      String(source.summary ?? ""),
      body,
      String(source.tags ?? ""),
      String(source.source_type ?? "official_doc"),
      String(source.environment_scope ?? "general"),
      String(source.risk_level ?? "LOW"),
      String(source.applicable_versions_json ?? "{}"),
      clipProductionText(input.evidence.trim()),
      String(source.rollback_plan ?? ""),
      input.reviewer.trim(),
    ],
  );
  await writeProductionAudit({
    actor: input.reviewer,
    eventType: "knowledge.promoted_to_inner",
    entityType: "knowledge_entry",
    entityId: id,
    detail: { sourceKnowledgeId: input.id, projectId: input.projectId ?? null },
  });
  return id;
}
