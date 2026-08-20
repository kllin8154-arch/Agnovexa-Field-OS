import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createAgnovexaMcpServer } from "./server.js";
import { withWorkspace } from "./workspace.js";

const databasePath = process.env.AGNOVEXA_OPSDESK_DB;

if (process.argv.includes("--self-test")) {
  try {
    const output = withWorkspace(databasePath, (reader) => ({
      ok: true,
      server: "agnovexa-opsdesk",
      overview: reader.workspaceOverview(),
      workflow: reader.diagnoseWorkflow(),
    }));
    process.stdout.write(`${JSON.stringify(output)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "MCP 自检失败。";
    process.stdout.write(`${JSON.stringify({ ok: false, message })}\n`);
    process.exitCode = 1;
  }
} else {
  serveStdio(() => createAgnovexaMcpServer(databasePath));
  console.error("Agnovexa OpsDesk MCP 已启动（stdio，只读）。");
}
