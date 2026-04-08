// Types and format-parsing for session export/import.
//
// Internal row types mirror the SQLite schema (not serialized to wire).
// Wire types (`Exported*`) use the OG-goose-compatible format.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub(crate) struct SessionRow {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub user_set_name: Option<bool>,
    pub session_type: Option<String>,
    pub working_dir: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub extension_data: Option<String>,
    pub total_tokens: Option<i64>,
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub accumulated_total_tokens: Option<i64>,
    pub accumulated_input_tokens: Option<i64>,
    pub accumulated_output_tokens: Option<i64>,
    pub schedule_id: Option<String>,
    pub recipe_json: Option<String>,
    pub user_recipe_values_json: Option<String>,
    pub provider_name: Option<String>,
    pub model_config_json: Option<String>,
    pub project_id: Option<String>,
    pub goose_mode: Option<String>,
    pub thread_id: Option<String>,
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub(crate) struct MessageRow {
    pub id: i64,
    pub message_id: Option<String>,
    pub session_id: String,
    pub role: Option<String>,
    pub content_json: Option<String>,
    pub created_timestamp: Option<i64>,
    pub timestamp: Option<String>,
    pub tokens: Option<i64>,
    pub metadata_json: Option<String>,
}

/// The exported session format, compatible with OG goose.
/// The `conversation` field (not `messages`) holds the list of messages.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct ExportedSession {
    pub id: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub working_dir: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
    #[serde(default)]
    pub extension_data: Option<serde_json::Value>,
    #[serde(default)]
    pub total_tokens: Option<i64>,
    #[serde(default)]
    pub input_tokens: Option<i64>,
    #[serde(default)]
    pub output_tokens: Option<i64>,
    #[serde(default)]
    pub provider_name: Option<String>,
    #[serde(default)]
    pub model_config: Option<serde_json::Value>,
    #[serde(default)]
    pub goose_mode: Option<String>,
    /// Messages in the session. Named `conversation` for OG goose compat.
    pub conversation: Vec<ExportedMessage>,
}

/// A single message in the exported format.
/// `content` is parsed JSON (not a raw string).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct ExportedMessage {
    #[serde(default)]
    pub message_id: Option<String>,
    #[serde(default)]
    pub role: Option<String>,
    /// Parsed JSON content (not a raw string).
    pub content: serde_json::Value,
    #[serde(default)]
    pub created_timestamp: Option<i64>,
    #[serde(default)]
    pub tokens: Option<i64>,
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,
}

/// Parse a JSON string, returning `None` on error or if the input is `None`.
pub(crate) fn parse_json_opt(raw: &Option<String>) -> Option<serde_json::Value> {
    raw.as_ref().and_then(|s| serde_json::from_str(s).ok())
}

/// Convert internal row types to the OG-goose-compatible wire format.
pub fn to_exported_session(row: &SessionRow, messages: &[MessageRow]) -> ExportedSession {
    let conversation: Vec<ExportedMessage> = messages
        .iter()
        .map(|m| {
            let content = m
                .content_json
                .as_ref()
                .and_then(|s| serde_json::from_str(s).ok())
                .unwrap_or(serde_json::Value::Null);

            ExportedMessage {
                message_id: m.message_id.clone(),
                role: m.role.clone(),
                content,
                created_timestamp: m.created_timestamp,
                tokens: m.tokens,
                metadata: parse_json_opt(&m.metadata_json),
            }
        })
        .collect();

    ExportedSession {
        id: row.id.clone(),
        name: row.name.clone(),
        description: row.description.clone(),
        working_dir: row.working_dir.clone(),
        created_at: row.created_at.clone(),
        updated_at: row.updated_at.clone(),
        extension_data: parse_json_opt(&row.extension_data),
        total_tokens: row.total_tokens,
        input_tokens: row.input_tokens,
        output_tokens: row.output_tokens,
        provider_name: row.provider_name.clone(),
        model_config: parse_json_opt(&row.model_config_json),
        goose_mode: row.goose_mode.clone(),
        conversation,
    }
}

/// Parse an import JSON string, detecting the format:
/// - OG goose: has `conversation` or `name` field at top level
/// - Goose2 v1: has `version` or (`session` + `messages`)
/// - Otherwise: error
pub fn parse_import_json(json: &str) -> Result<ExportedSession, String> {
    let value: serde_json::Value =
        serde_json::from_str(json).map_err(|e| format!("Invalid JSON: {}", e))?;

    let obj = value
        .as_object()
        .ok_or_else(|| "Expected a JSON object at the top level".to_string())?;

    // OG goose format: has `conversation` or `name` at top level
    if obj.contains_key("conversation") || obj.contains_key("name") {
        let exported: ExportedSession = serde_json::from_value(value)
            .map_err(|e| format!("Failed to parse OG goose format: {}", e))?;
        return Ok(exported);
    }

    // Goose2 v1 format: has `version` or (`session` + `messages`)
    if obj.contains_key("version") || (obj.contains_key("session") && obj.contains_key("messages"))
    {
        return parse_v1_format(obj);
    }

    Err(
        "Unknown import format: expected OG goose (with 'conversation' \
         or 'name') or goose2 v1 (with 'version' or 'session'+'messages')"
            .to_string(),
    )
}

/// Transform goose2 v1 format into ExportedSession.
fn parse_v1_format(
    obj: &serde_json::Map<String, serde_json::Value>,
) -> Result<ExportedSession, String> {
    let session = obj
        .get("session")
        .and_then(|v| v.as_object())
        .ok_or_else(|| "Goose2 v1 format missing 'session' object".to_string())?;

    let messages_val = obj
        .get("messages")
        .and_then(|v| v.as_array())
        .ok_or_else(|| "Goose2 v1 format missing 'messages' array".to_string())?;

    let conversation: Vec<ExportedMessage> = messages_val
        .iter()
        .map(|m| {
            let content = parse_v1_json_field(m, "content_json", "content");
            let metadata = m
                .get("metadata_json")
                .and_then(parse_maybe_string_json)
                .or_else(|| m.get("metadata").cloned());

            ExportedMessage {
                message_id: str_field(m, "message_id").or_else(|| str_field(m, "id")),
                role: str_field(m, "role"),
                content,
                created_timestamp: int_field(m, &["created_timestamp", "created"]),
                tokens: m.get("tokens").and_then(|v| v.as_i64()),
                metadata,
            }
        })
        .collect();

    let extension_data = session
        .get("extension_data")
        .and_then(parse_maybe_string_json);
    let model_config = session
        .get("model_config_json")
        .and_then(parse_maybe_string_json);

    Ok(ExportedSession {
        id: str_field_or(session, "id", "unknown"),
        name: str_field_map_any(session, &["name", "title"]),
        description: str_field_map(session, "description"),
        working_dir: str_field_map_any(session, &["working_dir", "workingDir"]),
        created_at: str_field_map_any(session, &["created_at", "createdAt"]),
        updated_at: str_field_map_any(session, &["updated_at", "updatedAt"]),
        extension_data,
        total_tokens: session.get("total_tokens").and_then(|v| v.as_i64()),
        input_tokens: session.get("input_tokens").and_then(|v| v.as_i64()),
        output_tokens: session.get("output_tokens").and_then(|v| v.as_i64()),
        provider_name: str_field_map(session, "provider_name"),
        model_config,
        goose_mode: str_field_map(session, "goose_mode"),
        conversation,
    })
}

// Small helpers to keep `parse_v1_format` concise.

fn parse_maybe_string_json(v: &serde_json::Value) -> Option<serde_json::Value> {
    if let Some(s) = v.as_str() {
        serde_json::from_str(s).ok()
    } else {
        Some(v.clone())
    }
}

fn parse_v1_json_field(
    m: &serde_json::Value,
    raw_key: &str,
    fallback_key: &str,
) -> serde_json::Value {
    m.get(raw_key)
        .and_then(parse_maybe_string_json)
        .or_else(|| m.get(fallback_key).cloned())
        .unwrap_or(serde_json::Value::Null)
}

fn str_field(v: &serde_json::Value, key: &str) -> Option<String> {
    v.get(key).and_then(|v| v.as_str()).map(String::from)
}

fn str_field_map(obj: &serde_json::Map<String, serde_json::Value>, key: &str) -> Option<String> {
    obj.get(key).and_then(|v| v.as_str()).map(String::from)
}

fn str_field_map_any(
    obj: &serde_json::Map<String, serde_json::Value>,
    keys: &[&str],
) -> Option<String> {
    keys.iter().find_map(|key| str_field_map(obj, key))
}

fn str_field_or(
    obj: &serde_json::Map<String, serde_json::Value>,
    key: &str,
    default: &str,
) -> String {
    str_field_map(obj, key).unwrap_or_else(|| default.to_string())
}

fn int_field(v: &serde_json::Value, keys: &[&str]) -> Option<i64> {
    keys.iter()
        .find_map(|key| v.get(key).and_then(|value| value.as_i64()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_import_json_og_format() {
        let json = r#"{
            "id": "20260401_1",
            "name": "Test Session",
            "conversation": [
                {
                    "message_id": "msg-1",
                    "role": "user",
                    "content": [{"type": "text", "text": "Hello"}],
                    "created_timestamp": 1700000000,
                    "tokens": 5
                },
                {
                    "message_id": "msg-2",
                    "role": "assistant",
                    "content": [{"type": "text", "text": "Hi there!"}],
                    "created_timestamp": 1700000001,
                    "tokens": 10
                }
            ]
        }"#;

        let result = parse_import_json(json);
        assert!(result.is_ok(), "Should parse OG format: {:?}", result.err());

        let session = result.unwrap();
        assert_eq!(session.id, "20260401_1");
        assert_eq!(session.name.as_deref(), Some("Test Session"));
        assert_eq!(session.conversation.len(), 2);
        assert_eq!(session.conversation[0].role.as_deref(), Some("user"));
        assert_eq!(session.conversation[1].role.as_deref(), Some("assistant"));
        assert!(session.conversation[0].content.is_array());
    }

    #[test]
    fn parse_import_json_v1_format() {
        let json = r#"{
            "version": 1,
            "session": {
                "id": "20260401_2",
                "name": "V1 Session",
                "total_tokens": 100
            },
            "messages": [
                {
                    "message_id": "v1-msg-1",
                    "role": "user",
                    "content_json": "[{\"type\":\"text\",\"text\":\"Hello from v1\"}]",
                    "created_timestamp": 1700000000,
                    "tokens": 5,
                    "metadata_json": "{\"source\":\"test\"}"
                }
            ]
        }"#;

        let result = parse_import_json(json);
        assert!(result.is_ok(), "Should parse v1 format: {:?}", result.err());

        let session = result.unwrap();
        assert_eq!(session.id, "20260401_2");
        assert_eq!(session.name.as_deref(), Some("V1 Session"));
        assert_eq!(session.total_tokens, Some(100));
        assert_eq!(session.conversation.len(), 1);

        let content = &session.conversation[0].content;
        assert!(content.is_array(), "content should be parsed JSON array");
        assert_eq!(content[0]["text"], "Hello from v1");

        let metadata = session.conversation[0].metadata.as_ref().unwrap();
        assert_eq!(metadata["source"], "test");
    }

    #[test]
    fn parse_import_json_v1_frontend_export_shape() {
        let json = r#"{
            "version": 1,
            "session": {
                "title": "Frontend Export",
                "createdAt": "2026-04-07T10:00:00Z",
                "updatedAt": "2026-04-07T11:00:00Z"
            },
            "messages": [
                {
                    "id": "frontend-msg-1",
                    "role": "user",
                    "content": [{"type":"text","text":"Hello from frontend"}],
                    "created": 1700001234,
                    "metadata": {"source":"frontend"}
                }
            ]
        }"#;

        let result = parse_import_json(json);
        assert!(
            result.is_ok(),
            "Should parse frontend v1 format: {:?}",
            result.err()
        );

        let session = result.unwrap();
        assert_eq!(session.name.as_deref(), Some("Frontend Export"));
        assert_eq!(session.created_at.as_deref(), Some("2026-04-07T10:00:00Z"));
        assert_eq!(session.updated_at.as_deref(), Some("2026-04-07T11:00:00Z"));
        assert_eq!(session.conversation.len(), 1);
        assert_eq!(
            session.conversation[0].message_id.as_deref(),
            Some("frontend-msg-1")
        );
        assert_eq!(session.conversation[0].created_timestamp, Some(1700001234));
        assert_eq!(
            session.conversation[0].metadata.as_ref().unwrap()["source"],
            "frontend"
        );
    }

    #[test]
    fn parse_import_json_invalid_format() {
        let json = r#"{"foo": "bar", "baz": 123}"#;
        let result = parse_import_json(json);
        assert!(result.is_err(), "Should reject unknown format");
        let err = result.unwrap_err();
        assert!(
            err.contains("Unknown import format"),
            "Error should mention unknown format, got: {}",
            err
        );
    }

    #[test]
    fn to_exported_session_produces_conversation_field() {
        let row = SessionRow {
            id: "20260401_1".to_string(),
            name: Some("Test".to_string()),
            description: None,
            user_set_name: Some(false),
            session_type: Some("chat".to_string()),
            working_dir: Some("/tmp".to_string()),
            created_at: Some("2026-04-01T00:00:00Z".to_string()),
            updated_at: Some("2026-04-01T00:00:00Z".to_string()),
            extension_data: Some(r#"{"key":"value"}"#.to_string()),
            total_tokens: Some(100),
            input_tokens: Some(50),
            output_tokens: Some(50),
            accumulated_total_tokens: Some(200),
            accumulated_input_tokens: Some(100),
            accumulated_output_tokens: Some(100),
            schedule_id: None,
            recipe_json: None,
            user_recipe_values_json: None,
            provider_name: Some("openai".to_string()),
            model_config_json: Some(r#"{"model":"gpt-4"}"#.to_string()),
            project_id: None,
            goose_mode: Some("auto".to_string()),
            thread_id: None,
        };

        let messages = vec![MessageRow {
            id: 1,
            message_id: Some("msg-1".to_string()),
            session_id: "20260401_1".to_string(),
            role: Some("user".to_string()),
            content_json: Some(r#"[{"type":"text","text":"Hello"}]"#.to_string()),
            created_timestamp: Some(1700000000),
            timestamp: Some("2026-04-01T00:00:00Z".to_string()),
            tokens: Some(5),
            metadata_json: Some(r#"{"source":"test"}"#.to_string()),
        }];

        let exported = to_exported_session(&row, &messages);

        let json_str = serde_json::to_string(&exported).unwrap();
        assert!(
            json_str.contains("\"conversation\""),
            "Wire format must use 'conversation' field, got: {}",
            json_str
        );
        assert!(
            !json_str.contains("\"content_json\""),
            "Wire format must NOT contain 'content_json', got: {}",
            json_str
        );

        assert_eq!(exported.conversation.len(), 1);
        let msg = &exported.conversation[0];
        assert!(
            msg.content.is_array(),
            "content should be parsed JSON array"
        );
        assert_eq!(msg.content[0]["text"], "Hello");

        let ext = exported.extension_data.as_ref().unwrap();
        assert_eq!(ext["key"], "value");

        let mc = exported.model_config.as_ref().unwrap();
        assert_eq!(mc["model"], "gpt-4");

        let meta = msg.metadata.as_ref().unwrap();
        assert_eq!(meta["source"], "test");
    }
}
