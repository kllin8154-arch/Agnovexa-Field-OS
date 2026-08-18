use serde::Serialize;
use tauri_plugin_sql::{Migration, MigrationKind};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimePolicy {
    execution_mode: &'static str,
    network_assumption: &'static str,
    ssh_capability: &'static str,
    remote_write_capability: &'static str,
    local_database: &'static str,
    knowledge_isolation: &'static str,
}

#[tauri::command]
fn get_runtime_policy() -> RuntimePolicy {
    RuntimePolicy {
        execution_mode: "manual-only",
        network_assumption: "offline-first",
        ssh_capability: "disabled",
        remote_write_capability: "disabled",
        local_database: "sqlite",
        knowledge_isolation: "inner-first",
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "initial_opsdesk_schema",
        sql: include_str!("../migrations/0001_initial.sql"),
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:opsdesk.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![get_runtime_policy])
        .run(tauri::generate_context!())
        .expect("failed to run Agnovexa OpsDesk");
}
