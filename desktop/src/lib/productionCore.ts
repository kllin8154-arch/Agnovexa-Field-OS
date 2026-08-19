import Database from "@tauri-apps/plugin-sql";
import { isDesktopRuntime } from "./repository";

export const PRODUCTION_DATABASE_URL = "sqlite:opsdesk.db";
export const WORKSPACE_FORMAT = "agnovexa-opsdesk-workspace";
export const WORKSPACE_SCHEMA_VERSION = 1;
let databasePromise: Promise<Database> | null = null;

export async function getProductionDatabase(): Promise<Database> {
  if (!isDesktopRuntime()) {
    throw new Error("当前为浏览器预览模式，不能读取或修改生产工作区。");
  }
  databasePromise ??= Database.load(PRODUCTION_DATABASE_URL);
  return databasePromise;
}

export function makeProductionId(prefix: string): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}

export function clipProductionText(value: string, maxLength = 20_000): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}\n…[内容已截断]`;
}

export async function writeProductionAudit(input: {
  actor: string;
  eventType: string;
  entityType: string;
  entityId: string;
  detail: Record<string, unknown>;
}): Promise<void> {
  const db = await getProductionDatabase();
  await db.execute(
    `INSERT INTO audit_events (
       id, actor, event_type, entity_type, entity_id, detail_redacted_json
     ) VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      makeProductionId("audit"),
      input.actor.trim() || "local-user",
      input.eventType,
      input.entityType,
      input.entityId,
      JSON.stringify(input.detail),
    ],
  );
}
