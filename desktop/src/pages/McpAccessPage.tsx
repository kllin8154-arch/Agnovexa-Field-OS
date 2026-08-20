import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CodeBlock, Notice, Panel, Tag } from "../components/Ui";
import { isDesktopRuntime } from "../lib/repository";

interface McpConnectionInfo {
  databasePath: string;
  serverPath: string;
  databaseExists: boolean;
  serverExists: boolean;
  nodeVersion: string | null;
  ready: boolean;
  readOnly: boolean;
}

interface McpSelfTestResult {
  ok: boolean;
  message: string;
  summary: Record<string, unknown> | null;
}

type ClientType = "codex" | "json";

const MCP_TOOLS = [
  ["workspace_overview", "项目、服务器、任务、计划和证据数量"],
  ["list_projects", "查询项目列表与技术栈摘要"],
  ["get_project_context", "读取一个项目的环境、技术和资产上下文"],
  ["list_assets", "查询脱敏后的服务器资产"],
  ["list_tasks", "按项目、阶段或状态筛选任务"],
  ["get_task_details", "读取任务、计划、步骤和证据闭环"],
  ["diagnose_workflow", "定位缺计划、缺步骤、缺证据等流程断点"],
  ["search_knowledge", "检索已保存的项目知识"],
  ["recent_audit_events", "读取最近的本地审计记录"],
] as const;

function tomlEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildConfig(info: McpConnectionInfo, client: ClientType): string {
  if (client === "codex") {
    return `[mcp_servers.agnovexa_opsdesk]\ncommand = "node"\nargs = ["${tomlEscape(info.serverPath)}"]\nenv = { AGNOVEXA_OPSDESK_DB = "${tomlEscape(info.databasePath)}" }`;
  }
  return JSON.stringify({
    mcpServers: {
      agnovexa_opsdesk: {
        command: "node",
        args: [info.serverPath],
        env: { AGNOVEXA_OPSDESK_DB: info.databasePath },
      },
    },
  }, null, 2);
}

export function McpAccessPage() {
  const desktop = isDesktopRuntime();
  const [info, setInfo] = useState<McpConnectionInfo | null>(null);
  const [client, setClient] = useState<ClientType>("codex");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<McpSelfTestResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const displayInfo = info ?? {
    databasePath: "<桌面端自动定位 opsdesk.db>",
    serverPath: "<桌面端自动定位 agnovexa-mcp.mjs>",
    databaseExists: false,
    serverExists: false,
    nodeVersion: null,
    ready: false,
    readOnly: true,
  };
  const config = useMemo(() => buildConfig(displayInfo, client), [client, displayInfo.databasePath, displayInfo.serverPath]);

  const loadInfo = async () => {
    if (!desktop) return;
    setError("");
    try {
      setInfo(await invoke<McpConnectionInfo>("get_mcp_connection_info"));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  };

  useEffect(() => { void loadInfo(); }, [desktop]);

  const runSelfTest = async () => {
    setChecking(true);
    setResult(null);
    setError("");
    try {
      const nextResult = await invoke<McpSelfTestResult>("test_mcp_connection");
      setResult(nextResult);
      await loadInfo();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setChecking(false);
    }
  };

  const copyConfig = async () => {
    if (!config) return;
    await navigator.clipboard.writeText(config);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_800);
  };

  return (
    <div className="page-stack mcp-page">
      {!desktop && <Notice tone="info" title="当前是浏览器预览">桌面版会自动定位真实数据库和 MCP Server；下面仅展示接入方式，不能执行自检或复制占位配置。</Notice>}
      {error && <Notice tone="danger" title="MCP 状态读取失败">{error}</Notice>}
      {result && <Notice tone={result.ok ? "success" : "warning"} title={result.ok ? "MCP 自检通过" : "MCP 暂不可用"}>{result.message}</Notice>}

      <Panel
        eyebrow="LOCAL READ-ONLY MCP"
        title="让开发工具直接了解当前工作区"
        actions={<Tag>{displayInfo.readOnly ? "只读" : "正在检测"}</Tag>}
        className="mcp-hero-panel"
      >
        <div className="mcp-intro">
          <div>
            <p>连接后，Codex、Claude Desktop、Cursor 等 MCP 客户端可以查询项目、技术栈、服务器、任务和流程断点。所有数据来自本机 SQLite。</p>
            <div className="mcp-safety-line"><span className="status-dot" />不会连接服务器，不会执行 Shell / SQL，不会修改 Agnovexa 数据</div>
          </div>
          <button className="primary-button" type="button" disabled={!desktop || checking || !info} onClick={() => void runSelfTest()}>{checking ? "正在检测…" : "一键检测"}</button>
        </div>

        <div className="mcp-status-grid">
          <div><span>本地数据库</span><strong>{displayInfo.databaseExists ? "已找到" : "等待桌面端"}</strong><small>{displayInfo.databasePath}</small></div>
          <div><span>MCP Server</span><strong>{displayInfo.serverExists ? "已安装" : "等待桌面端"}</strong><small>{displayInfo.serverPath}</small></div>
          <div><span>Node.js</span><strong>{displayInfo.nodeVersion || "尚未检测"}</strong><small>需要 Node.js 22.13 或更高版本</small></div>
          <div><span>当前状态</span><strong>{displayInfo.ready ? "可以接入" : "等待检测"}</strong><small>{displayInfo.ready ? "复制下面配置后重启 MCP 客户端" : "在桌面端点击一键检测"}</small></div>
        </div>
      </Panel>

      <div className="mcp-main-grid">
        <Panel eyebrow="CONNECT" title="复制接入配置" className="mcp-config-panel">
          <div className="mcp-client-tabs" role="tablist" aria-label="MCP 客户端配置格式">
            <button type="button" className={client === "codex" ? "active" : ""} onClick={() => setClient("codex")}>Codex（TOML）</button>
            <button type="button" className={client === "json" ? "active" : ""} onClick={() => setClient("json")}>Claude / Cursor（JSON）</button>
          </div>
          <CodeBlock value={config || "正在生成本机配置…"} label={client === "codex" ? "config.toml" : "MCP JSON 配置"} />
          <div className="mcp-config-actions">
            <span>路径已自动填好；不包含密码、Token 或服务器登录信息。</span>
            <button className="primary-button" type="button" disabled={!desktop || !config} onClick={() => void copyConfig()}>{copied ? "已复制" : "复制配置"}</button>
          </div>
        </Panel>

        <Panel eyebrow="QUICK START" title="三步完成接入" className="mcp-steps-panel">
          <ol className="mcp-steps">
            <li><span>1</span><div><strong>点击“一键检测”</strong><p>确认数据库、Node.js 和内置 MCP Server 可用。</p></div></li>
            <li><span>2</span><div><strong>复制对应配置</strong><p>粘贴到开发工具的 MCP 配置文件中。</p></div></li>
            <li><span>3</span><div><strong>重启开发工具并提问</strong><p>例如：“诊断当前部署流程为什么走不通”。</p></div></li>
          </ol>
        </Panel>
      </div>

      <Panel eyebrow="AVAILABLE TOOLS" title="可查询内容">
        <div className="mcp-tool-list">
          {MCP_TOOLS.map(([name, description]) => <div key={name}><code>{name}</code><span>{description}</span></div>)}
        </div>
      </Panel>
    </div>
  );
}
