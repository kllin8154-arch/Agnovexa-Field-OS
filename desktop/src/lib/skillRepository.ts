import {
  clipProductionText,
  getProductionDatabase,
  writeProductionAudit,
} from "./productionCore";

export type SkillStatus = "draft" | "reviewed" | "verified" | "deprecated";
export type SkillRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface SkillRecord {
  id: string;
  name: string;
  version: string;
  status: SkillStatus;
  owner: string;
  riskLevel: SkillRisk;
  sourceScope: "inner" | "public";
  metadataYaml: string;
  promptMarkdown: string;
  precheckTemplate: string;
  actionTemplate: string;
  verificationTemplate: string;
  rollbackTemplate: string;
  requiresHumanApproval: boolean;
  lastVerifiedAt?: string;
  updatedAt: string;
}

interface SkillRow {
  id: string;
  name: string;
  version: string;
  status: SkillStatus;
  owner: string;
  risk_level: SkillRisk;
  source_scope: "inner" | "public";
  metadata_yaml: string;
  prompt_markdown: string;
  precheck_template: string;
  action_template: string;
  verification_template: string;
  rollback_template: string;
  requires_human_approval: number;
  last_verified_at: string | null;
  updated_at: string;
}

const BUILT_IN_GEOSERVER_SKILL = {
  id: "geoserver.postgis.publish-layer",
  name: "GeoServer 发布 PostGIS 矢量图层",
  version: "1.0.0",
  status: "reviewed" as const,
  owner: "Agnovexa GIS",
  riskLevel: "MEDIUM" as const,
  sourceScope: "inner" as const,
  metadataYaml: `id: geoserver.postgis.publish-layer
name: GeoServer 发布 PostGIS 矢量图层
version: 1.0.0
status: reviewed
risk_level: medium
required_inputs:
  - workspace
  - store_name
  - db_host
  - db_port
  - db_name
  - db_schema
  - db_user
  - table_name
  - geometry_column
  - primary_key
  - srid
  - layer_name
sensitive_inputs:
  - db_password
  - geoserver_admin_password
execution_policy:
  sql_requires_confirmation: true
  geoserver_publish_requires_confirmation: true
  auto_rollback: false`,
  promptMarkdown: `你正在生成 GeoServer 发布 PostGIS 图层的人工执行方案。

必须先检查 PostgreSQL/PostGIS 版本、表、主键、几何列、SRID、空几何、数据范围和空间索引。数据库密码与 GeoServer 管理密码只能使用占位符；任何 SQL、授权和发布动作均等待人工确认。输出必须包含前置检查、最小权限、发布步骤、WMS/WFS 验证、停止条件和回滚。`,
  precheckTemplate: `-- 标识符必须先经过字母、数字、下划线白名单校验
SELECT n.nspname AS schema_name, c.relname AS table_name, c.relkind AS relation_type
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = '<SCHEMA_NAME>'
  AND c.relname = '<TABLE_NAME>';

SELECT f_table_schema, f_table_name, f_geometry_column,
       coord_dimension, srid, type
FROM geometry_columns
WHERE f_table_schema = '<SCHEMA_NAME>'
  AND f_table_name = '<TABLE_NAME>'
  AND f_geometry_column = '<GEOMETRY_COLUMN>';

SELECT COUNT(*) AS total_rows,
       COUNT(*) FILTER (WHERE "<GEOMETRY_COLUMN>" IS NULL) AS null_geometry_rows,
       COUNT(DISTINCT ST_SRID("<GEOMETRY_COLUMN>")) AS srid_count
FROM "<SCHEMA_NAME>"."<TABLE_NAME>";

SELECT COUNT(*) AS total_rows,
       COUNT(DISTINCT "<PRIMARY_KEY>") AS distinct_key_count,
       COUNT(*) FILTER (WHERE "<PRIMARY_KEY>" IS NULL) AS null_key_count
FROM "<SCHEMA_NAME>"."<TABLE_NAME>";

SELECT extname, extversion FROM pg_extension WHERE extname = 'postgis';`,
  actionTemplate: `-- 以下 SQL 仅生成草案，必须由数据库管理员人工审核执行
GRANT USAGE ON SCHEMA "<SCHEMA_NAME>" TO "<GEOSERVER_READONLY_ROLE>";
GRANT SELECT ON TABLE "<SCHEMA_NAME>"."<TABLE_NAME>" TO "<GEOSERVER_READONLY_ROLE>";

CREATE INDEX IF NOT EXISTS "<TABLE_NAME>_<GEOMETRY_COLUMN>_gist"
ON "<SCHEMA_NAME>"."<TABLE_NAME>"
USING GIST ("<GEOMETRY_COLUMN>");

ANALYZE "<SCHEMA_NAME>"."<TABLE_NAME>";

-- GeoServer 人工发布计划
-- 1. 创建或复用 Workspace
-- 2. 创建 PostGIS Store，并使用运行时凭据填写连接参数
-- 3. 选择表并发布 Layer
-- 4. 设置声明坐标系与边界
-- 5. 绑定经过审核的 SLD
-- 6. 保存后进入独立验证`,
  verificationTemplate: `-- 数据库侧验证
SELECT COUNT(*) AS feature_count,
       ST_SRID("<GEOMETRY_COLUMN>") AS srid,
       GeometryType("<GEOMETRY_COLUMN>") AS geometry_type
FROM "<SCHEMA_NAME>"."<TABLE_NAME>"
WHERE "<GEOMETRY_COLUMN>" IS NOT NULL
GROUP BY ST_SRID("<GEOMETRY_COLUMN>"), GeometryType("<GEOMETRY_COLUMN>");

-- GeoServer 侧由人工验证
-- WMS GetCapabilities 包含目标图层
-- WMS GetMap 正常返回地图
-- 如项目需要，再验证 WFS GetFeature
-- 核对样式、坐标系、边界、权限与日志`,
  rollbackTemplate: `-- 回滚前必须再次人工确认
REVOKE SELECT ON TABLE "<SCHEMA_NAME>"."<TABLE_NAME>" FROM "<GEOSERVER_READONLY_ROLE>";
REVOKE USAGE ON SCHEMA "<SCHEMA_NAME>" FROM "<GEOSERVER_READONLY_ROLE>";
DROP INDEX IF EXISTS "<SCHEMA_NAME>"."<TABLE_NAME>_<GEOMETRY_COLUMN>_gist";

-- GeoServer 控制台中取消发布 Layer；仅在确认无其他图层依赖时删除 Store/Workspace。
-- 不自动删除底层业务表、数据或 PostGIS 扩展。`,
};

function mapSkill(row: SkillRow): SkillRecord {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    status: row.status,
    owner: row.owner,
    riskLevel: row.risk_level,
    sourceScope: row.source_scope,
    metadataYaml: row.metadata_yaml,
    promptMarkdown: row.prompt_markdown,
    precheckTemplate: row.precheck_template,
    actionTemplate: row.action_template,
    verificationTemplate: row.verification_template,
    rollbackTemplate: row.rollback_template,
    requiresHumanApproval: row.requires_human_approval === 1,
    lastVerifiedAt: row.last_verified_at ?? undefined,
    updatedAt: row.updated_at,
  };
}

export async function ensureBuiltInSkills(): Promise<void> {
  const db = await getProductionDatabase();
  const skill = BUILT_IN_GEOSERVER_SKILL;
  await db.execute(
    `INSERT OR IGNORE INTO skill_definitions (
       id, name, version, status, owner, risk_level, source_scope,
       metadata_yaml, prompt_markdown, precheck_template, action_template,
       verification_template, rollback_template, requires_human_approval
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 1)`,
    [
      skill.id,
      skill.name,
      skill.version,
      skill.status,
      skill.owner,
      skill.riskLevel,
      skill.sourceScope,
      skill.metadataYaml,
      skill.promptMarkdown,
      skill.precheckTemplate,
      skill.actionTemplate,
      skill.verificationTemplate,
      skill.rollbackTemplate,
    ],
  );
}

export async function listSkills(query = ""): Promise<SkillRecord[]> {
  const db = await getProductionDatabase();
  const keyword = query.trim();
  const rows = await db.select<SkillRow[]>(
    `SELECT id, name, version, status, owner, risk_level, source_scope,
            metadata_yaml, prompt_markdown, precheck_template, action_template,
            verification_template, rollback_template, requires_human_approval,
            last_verified_at, updated_at
     FROM skill_definitions
     WHERE $1 = ''
        OR id LIKE '%' || $1 || '%'
        OR name LIKE '%' || $1 || '%'
        OR metadata_yaml LIKE '%' || $1 || '%'
     ORDER BY CASE status WHEN 'verified' THEN 0 WHEN 'reviewed' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END,
              updated_at DESC, name COLLATE NOCASE`,
    [keyword],
  );
  return rows.map(mapSkill);
}

export async function createSkillDefinition(input: {
  id: string;
  name: string;
  version: string;
  owner: string;
  riskLevel: SkillRisk;
  sourceScope: "inner" | "public";
  metadataYaml: string;
  promptMarkdown: string;
  precheckTemplate: string;
  actionTemplate: string;
  verificationTemplate: string;
  rollbackTemplate: string;
}): Promise<void> {
  const identifier = input.id.trim();
  if (!/^[a-z0-9][a-z0-9._-]{2,119}$/i.test(identifier)) {
    throw new Error("Skill ID 只能包含字母、数字、点、下划线和短横线，长度 3 到 120。");
  }
  if (input.name.trim().length < 4) throw new Error("Skill 名称至少需要 4 个字符。");
  if (!/^\d+\.\d+\.\d+(?:[-+][a-z0-9.-]+)?$/i.test(input.version.trim())) {
    throw new Error("Skill 版本请使用语义化版本，例如 1.0.0。");
  }
  if (input.promptMarkdown.trim().length < 20) throw new Error("Skill 提示词至少需要 20 个字符。");
  if (!input.verificationTemplate.trim()) throw new Error("必须填写验证模板。");
  if (!input.rollbackTemplate.trim()) throw new Error("必须填写回滚模板或不可回滚说明。");

  const db = await getProductionDatabase();
  await db.execute(
    `INSERT INTO skill_definitions (
       id, name, version, status, owner, risk_level, source_scope,
       metadata_yaml, prompt_markdown, precheck_template, action_template,
       verification_template, rollback_template, requires_human_approval
     ) VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, $8, $9, $10, $11, $12, 1)`,
    [
      identifier,
      input.name.trim(),
      input.version.trim(),
      input.owner.trim(),
      input.riskLevel,
      input.sourceScope,
      input.metadataYaml.trim(),
      input.promptMarkdown.trim(),
      input.precheckTemplate.trim(),
      input.actionTemplate.trim(),
      input.verificationTemplate.trim(),
      input.rollbackTemplate.trim(),
    ],
  );
  await writeProductionAudit({
    actor: input.owner,
    eventType: "skill.created",
    entityType: "skill_definition",
    entityId: identifier,
    detail: { version: input.version.trim(), status: "draft", sourceScope: input.sourceScope },
  });
}

export async function verifySkillDefinition(input: {
  id: string;
  reviewer: string;
  evidence: string;
}): Promise<void> {
  if (input.reviewer.trim().length < 2) throw new Error("请填写验证人员。");
  if (input.evidence.trim().length < 20) throw new Error("验证证据至少需要 20 个字符。");
  const db = await getProductionDatabase();
  const rows = await db.select<Array<{ source_scope: string; status: SkillStatus }>>(
    "SELECT source_scope, status FROM skill_definitions WHERE id = $1",
    [input.id],
  );
  const record = rows[0];
  if (!record) throw new Error("未找到 Skill。");
  if (record.source_scope !== "inner") throw new Error("外部 Skill 不能直接升级为内部已验证 Skill。");
  if (record.status === "deprecated") throw new Error("已停用 Skill 不能直接恢复为 verified。");

  await db.execute(
    `UPDATE skill_definitions
     SET status = 'verified', owner = $1, last_verified_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [input.reviewer.trim(), input.id],
  );
  await writeProductionAudit({
    actor: input.reviewer,
    eventType: "skill.verified",
    entityType: "skill_definition",
    entityId: input.id,
    detail: { evidence: clipProductionText(input.evidence.trim(), 4_000) },
  });
}
