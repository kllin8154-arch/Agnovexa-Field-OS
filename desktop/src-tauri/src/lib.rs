use reqwest::{header, Client, Url};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::time::Duration;
use tauri_plugin_sql::{Migration, MigrationKind};

const MAX_PROVIDER_NAME_LEN: usize = 120;
const MAX_BASE_URL_LEN: usize = 2_048;
const MAX_MODEL_LEN: usize = 200;
const MAX_MESSAGE_COUNT: usize = 64;
const MAX_MESSAGE_CONTENT_LEN: usize = 512_000;
const MAX_ERROR_BODY_LEN: usize = 8_000;

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

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AiChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AiChatRequest {
    provider_name: String,
    base_url: String,
    api_key: Option<String>,
    model: String,
    messages: Vec<AiChatMessage>,
    temperature: Option<f64>,
    max_tokens: Option<u32>,
    timeout_seconds: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AiChatResponse {
    provider_name: String,
    model: String,
    content: String,
    reasoning_content: Option<String>,
    request_id: Option<String>,
    prompt_tokens: Option<u64>,
    completion_tokens: Option<u64>,
    total_tokens: Option<u64>,
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

fn normalize_chat_endpoint(base_url: &str) -> Result<Url, String> {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return Err("AI Base URL 不能为空。".to_string());
    }
    if trimmed.len() > MAX_BASE_URL_LEN {
        return Err("AI Base URL 过长。".to_string());
    }

    let mut url = Url::parse(trimmed).map_err(|_| "AI Base URL 格式无效。".to_string())?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("AI Base URL 只允许 http 或 https。".to_string());
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err("AI Base URL 不得包含用户名或密码。".to_string());
    }
    if url.query().is_some() || url.fragment().is_some() {
        return Err("AI Base URL 不得包含查询参数或片段。".to_string());
    }

    let current_path = url.path().trim_end_matches('/');
    if !current_path.ends_with("/chat/completions") {
        let next_path = if current_path.is_empty() {
            "/chat/completions".to_string()
        } else {
            format!("{current_path}/chat/completions")
        };
        url.set_path(&next_path);
    }

    Ok(url)
}

fn validate_chat_request(request: &AiChatRequest) -> Result<(), String> {
    let provider_name = request.provider_name.trim();
    if provider_name.is_empty() || provider_name.len() > MAX_PROVIDER_NAME_LEN {
        return Err("Provider 名称为空或过长。".to_string());
    }

    let model = request.model.trim();
    if model.is_empty() || model.len() > MAX_MODEL_LEN {
        return Err("模型 ID 为空或过长。".to_string());
    }

    if request.messages.is_empty() || request.messages.len() > MAX_MESSAGE_COUNT {
        return Err(format!("消息数量必须为 1 到 {MAX_MESSAGE_COUNT} 条。"));
    }

    for message in &request.messages {
        if !matches!(message.role.as_str(), "system" | "user" | "assistant") {
            return Err("消息角色只允许 system、user 或 assistant。".to_string());
        }
        if message.content.trim().is_empty() {
            return Err("AI 消息内容不能为空。".to_string());
        }
        if message.content.len() > MAX_MESSAGE_CONTENT_LEN {
            return Err("单条 AI 消息内容过长。".to_string());
        }
    }

    if let Some(temperature) = request.temperature {
        if !(0.0..=2.0).contains(&temperature) {
            return Err("温度必须在 0 到 2 之间。".to_string());
        }
    }

    if let Some(max_tokens) = request.max_tokens {
        if max_tokens == 0 || max_tokens > 131_072 {
            return Err("最大输出 Token 必须在 1 到 131072 之间。".to_string());
        }
    }

    Ok(())
}

fn extract_text(value: Option<&Value>) -> Option<String> {
    match value {
        Some(Value::String(text)) if !text.trim().is_empty() => Some(text.clone()),
        Some(Value::Array(parts)) => {
            let mut texts = Vec::new();
            for part in parts {
                match part {
                    Value::String(text) if !text.trim().is_empty() => texts.push(text.clone()),
                    Value::Object(object) => {
                        if let Some(text) = object.get("text").and_then(Value::as_str) {
                            if !text.trim().is_empty() {
                                texts.push(text.to_string());
                            }
                        } else if let Some(text) = object
                            .get("text")
                            .and_then(|item| item.get("value"))
                            .and_then(Value::as_str)
                        {
                            if !text.trim().is_empty() {
                                texts.push(text.to_string());
                            }
                        }
                    }
                    _ => {}
                }
            }
            if texts.is_empty() { None } else { Some(texts.join("\n")) }
        }
        _ => None,
    }
}

fn extract_error_message(payload: &Value, fallback: &str) -> String {
    payload
        .pointer("/error/message")
        .and_then(Value::as_str)
        .or_else(|| payload.get("message").and_then(Value::as_str))
        .or_else(|| payload.pointer("/error/code").and_then(Value::as_str))
        .filter(|message| !message.trim().is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| {
            let clipped: String = fallback.chars().take(MAX_ERROR_BODY_LEN).collect();
            if clipped.trim().is_empty() {
                "Provider 未返回可读错误信息。".to_string()
            } else {
                clipped
            }
        })
}

#[tauri::command]
async fn chat_completion(request: AiChatRequest) -> Result<AiChatResponse, String> {
    validate_chat_request(&request)?;
    let endpoint = normalize_chat_endpoint(&request.base_url)?;
    let timeout_seconds = request.timeout_seconds.unwrap_or(180).clamp(5, 300);

    let client = Client::builder()
        .timeout(Duration::from_secs(timeout_seconds))
        .user_agent("Agnovexa-OpsDesk/0.2.0")
        .build()
        .map_err(|_| "无法初始化 AI HTTP 客户端。".to_string())?;

    let mut payload = Map::new();
    payload.insert("model".to_string(), Value::String(request.model.trim().to_string()));
    payload.insert(
        "messages".to_string(),
        serde_json::to_value(&request.messages)
            .map_err(|_| "无法序列化 AI 消息。".to_string())?,
    );
    payload.insert("stream".to_string(), Value::Bool(false));
    if let Some(temperature) = request.temperature {
        payload.insert("temperature".to_string(), json!(temperature));
    }
    if let Some(max_tokens) = request.max_tokens {
        payload.insert("max_tokens".to_string(), json!(max_tokens));
    }

    let mut builder = client
        .post(endpoint)
        .header(header::ACCEPT, "application/json")
        .header(header::CONTENT_TYPE, "application/json")
        .json(&payload);

    if let Some(api_key) = request.api_key.as_deref().map(str::trim).filter(|key| !key.is_empty()) {
        builder = builder.bearer_auth(api_key);
    }

    let response = builder.send().await.map_err(|error| {
        if error.is_timeout() {
            "AI 请求超时，请检查网络、Base URL 或调大超时时间。".to_string()
        } else if error.is_connect() {
            "无法连接 AI Provider，请检查网络、代理和 Base URL。".to_string()
        } else {
            "AI 请求发送失败。".to_string()
        }
    })?;

    let status = response.status();
    let header_request_id = response
        .headers()
        .get("x-request-id")
        .or_else(|| response.headers().get("request-id"))
        .and_then(|value| value.to_str().ok())
        .map(ToOwned::to_owned);
    let body = response
        .text()
        .await
        .map_err(|_| "无法读取 AI Provider 响应。".to_string())?;
    let parsed: Value = serde_json::from_str(&body).unwrap_or(Value::Null);

    if !status.is_success() {
        let message = extract_error_message(&parsed, &body);
        return Err(format!("AI Provider 返回 HTTP {}：{}", status.as_u16(), message));
    }

    if parsed.is_null() {
        return Err("AI Provider 返回的内容不是有效 JSON。".to_string());
    }

    let content = extract_text(parsed.pointer("/choices/0/message/content"))
        .or_else(|| extract_text(parsed.pointer("/choices/0/text")))
        .ok_or_else(|| "AI Provider 未返回可读的 choices[0] 文本。".to_string())?;
    let reasoning_content = extract_text(parsed.pointer("/choices/0/message/reasoning_content"))
        .or_else(|| extract_text(parsed.pointer("/choices/0/message/reasoning")));
    let request_id = header_request_id.or_else(|| {
        parsed
            .get("id")
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty())
            .map(ToOwned::to_owned)
    });

    Ok(AiChatResponse {
        provider_name: request.provider_name.trim().to_string(),
        model: parsed
            .get("model")
            .and_then(Value::as_str)
            .unwrap_or(request.model.trim())
            .to_string(),
        content,
        reasoning_content,
        request_id,
        prompt_tokens: parsed.pointer("/usage/prompt_tokens").and_then(Value::as_u64),
        completion_tokens: parsed.pointer("/usage/completion_tokens").and_then(Value::as_u64),
        total_tokens: parsed.pointer("/usage/total_tokens").and_then(Value::as_u64),
    })
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
        .invoke_handler(tauri::generate_handler![get_runtime_policy, chat_completion])
        .run(tauri::generate_context!())
        .expect("failed to run Agnovexa OpsDesk");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn appends_chat_completions_to_base_url() {
        let url = normalize_chat_endpoint("https://api.example.com/v1/").unwrap();
        assert_eq!(url.as_str(), "https://api.example.com/v1/chat/completions");
    }

    #[test]
    fn keeps_complete_chat_endpoint() {
        let url = normalize_chat_endpoint("http://127.0.0.1:11434/v1/chat/completions").unwrap();
        assert_eq!(url.as_str(), "http://127.0.0.1:11434/v1/chat/completions");
    }

    #[test]
    fn rejects_credentials_in_url() {
        let error = normalize_chat_endpoint("https://user:secret@example.com/v1").unwrap_err();
        assert!(error.contains("用户名或密码"));
    }

    #[test]
    fn extracts_structured_provider_error() {
        let payload = json!({"error": {"message": "invalid model"}});
        assert_eq!(extract_error_message(&payload, "fallback"), "invalid model");
    }
}
