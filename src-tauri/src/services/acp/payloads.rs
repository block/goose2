use serde::Serialize;

/// Payload for the `acp:text` event.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct TextPayload {
    pub session_id: String,
    pub text: String,
}

/// Payload for the `acp:done` event.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct DonePayload {
    pub session_id: String,
}

/// Payload for the `acp:tool_call` event.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct ToolCallPayload {
    pub session_id: String,
    pub tool_call_id: String,
    pub title: String,
}

/// Payload for the `acp:tool_title` event.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct ToolTitlePayload {
    pub session_id: String,
    pub tool_call_id: String,
    pub title: String,
}

/// Payload for the `acp:tool_result` event.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct ToolResultPayload {
    pub session_id: String,
    pub content: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct SessionInfoPayload {
    pub session_id: String,
    pub title: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct ModelStatePayload {
    pub session_id: String,
    pub current_model_id: String,
    pub current_model_name: Option<String>,
}
