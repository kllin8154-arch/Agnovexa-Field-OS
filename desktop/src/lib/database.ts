import Database from "@tauri-apps/plugin-sql";

export interface StorageProbe {
  mode: "sqlite" | "browser-preview";
  detail: string;
}

const DATABASE_URL = "sqlite:opsdesk.db";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function probeStorage(): Promise<StorageProbe> {
  if (!isTauriRuntime()) {
    return {
      mode: "browser-preview",
      detail: "浏览器预览模式：当前页面使用演示数据，不写入真实 SQLite。",
    };
  }

  try {
    const database = await Database.load(DATABASE_URL);
    const rows = await database.select<Array<{ version: string }>>(
      "SELECT sqlite_version() AS version",
    );
    return {
      mode: "sqlite",
      detail: `本地 SQLite 已就绪（${rows[0]?.version ?? "version unknown"}）。`,
    };
  } catch (error) {
    return {
      mode: "browser-preview",
      detail: `SQLite 初始化失败，已降级为只读演示：${String(error)}`,
    };
  }
}
