import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

function createFixture() {
  const directory = mkdtempSync(join(tmpdir(), "agnovexa-mcp-"));
  const path = join(directory, "opsdesk.db");
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT, code TEXT, description TEXT, status TEXT, profile_json TEXT, technologies_json TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE assets (id TEXT PRIMARY KEY, project_id TEXT, name TEXT, host TEXT, port INTEGER, username TEXT, server_model TEXT, operating_system TEXT, architecture TEXT, environment TEXT, tags_json TEXT, notes TEXT);
    CREATE TABLE environment_snapshots (id TEXT PRIMARY KEY, asset_id TEXT, status TEXT, collected_at TEXT);
    CREATE TABLE deployment_tasks (id TEXT PRIMARY KEY, project_id TEXT, asset_id TEXT, title TEXT, task_type TEXT, workflow_phase TEXT, risk_level TEXT, status TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE change_plans (id TEXT PRIMARY KEY, deployment_task_id TEXT, title TEXT, objective TEXT, risk_level TEXT, confirmed_facts_json TEXT, missing_facts_json TEXT, impact_scope TEXT, config_diff TEXT, backup_plan TEXT, verification_plan TEXT, rollback_plan TEXT, approval_required INTEGER, created_at TEXT, updated_at TEXT);
    CREATE TABLE change_steps (id TEXT PRIMARY KEY, change_plan_id TEXT, step_order INTEGER, objective TEXT, prerequisites_json TEXT, risk_level TEXT, command_preview TEXT, expected_result TEXT, evidence_required_json TEXT, validation_commands TEXT, rollback_commands TEXT, network_required INTEGER);
    CREATE TABLE approval_records (id TEXT PRIMARY KEY, change_plan_id TEXT, reviewer TEXT, decision TEXT, comment TEXT, decided_at TEXT);
    CREATE TABLE manual_execution_evidence (id TEXT PRIMARY KEY, deployment_task_id TEXT, executor TEXT, executed_at TEXT, actual_command_redacted TEXT, exit_code INTEGER, stdout_redacted TEXT, stderr_redacted TEXT, related_logs_redacted TEXT, human_actions TEXT, evidence_status TEXT);
    CREATE TABLE knowledge_entries (id TEXT PRIMARY KEY, project_id TEXT, title TEXT, summary TEXT, body_markdown TEXT, tags TEXT, source_scope TEXT, source_type TEXT, verification_status TEXT, environment_scope TEXT, risk_level TEXT, updated_at TEXT);
    CREATE TABLE audit_events (id TEXT PRIMARY KEY, project_id TEXT, deployment_task_id TEXT, actor TEXT, event_type TEXT, entity_type TEXT, entity_id TEXT, detail_redacted_json TEXT, occurred_at TEXT);
    INSERT INTO projects VALUES ('p1','示例项目','DEMO','用于 MCP 验证','active','{"operatingSystems":["Kylin V10"],"apiKey":"sk-test-secret"}','["Java 17","GeoServer"]',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
    INSERT INTO assets VALUES ('a1','p1','GIS 服务','10.20.30.40',22,'ops','','Kylin V10','aarch64','test','["GIS"]','');
    INSERT INTO deployment_tasks VALUES ('t1','p1','a1','GeoServer 发布','template-geoserver','DEFINE','HIGH','in_progress',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  `);
  db.close();
  return { directory, path };
}

test("MCP 能列出工具并诊断断裂任务", async () => {
  const fixture = createFixture();
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve("mcp/dist/agnovexa-mcp.mjs")],
    env: { ...process.env, AGNOVEXA_OPSDESK_DB: fixture.path },
    stderr: "pipe",
  });
  const client = new Client({ name: "agnovexa-mcp-test", version: "1.0.0" });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    assert.ok(tools.tools.some((tool) => tool.name === "diagnose_workflow"));
    assert.ok(tools.tools.every((tool) => tool.annotations?.readOnlyHint === true));
    assert.equal((await client.listResources()).resources[0].uri, "agnovexa://workspace/overview");
    assert.ok((await client.listPrompts()).prompts.some((prompt) => prompt.name === "debug_workflow"));

    const projects = await client.callTool({ name: "list_projects", arguments: {} });
    assert.match(projects.content[0].text, /敏感值已隐藏/);
    assert.doesNotMatch(projects.content[0].text, /sk-test-secret/);

    const response = await client.callTool({ name: "diagnose_workflow", arguments: { projectId: "p1" } });
    assert.equal(response.isError, undefined);
    assert.equal(response.structuredContent.blockedCount, 1);
    assert.match(response.content[0].text, /没有变更计划/);

    const assets = await client.callTool({ name: "list_assets", arguments: { projectId: "p1" } });
    assert.match(assets.content[0].text, /10\.20\.30\.\*\*\*/);
    assert.doesNotMatch(assets.content[0].text, /10\.20\.30\.40/);
  } finally {
    await client.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});
