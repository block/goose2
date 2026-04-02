use serde::Serialize;

/// Payload for the `acp:message_created` event.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct MessageCreatedPayload {
    pub session_id: String,
    pub message_id: String,
    pub persona_id: Option<String>,
    pub persona_name: Option<String>,
}

/// Payload for the `acp:text` event.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct TextPayload {
    pub session_id: String,
    pub message_id: String,
    pub text: String,
}

/// Payload for the `acp:done` event.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct DonePayload {
    pub session_id: String,
    pub message_id: String,
}

/// Payload for the `acp:tool_call` event.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct ToolCallPayload {
    pub session_id: String,
    pub message_id: String,
    pub tool_call_id: String,
    pub title: String,
}

/// Payload for the `acp:tool_title` event.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct ToolTitlePayload {
    pub session_id: String,
    pub message_id: String,
    pub tool_call_id: String,
    pub title: String,
}

/// Payload for the `acp:tool_result` event.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct ToolResultPayload {
    pub session_id: String,
    pub message_id: String,
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
pub(crate) struct AvailableModelPayload {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ModelStatePayload {
    pub session_id: String,
    pub source: String,
    pub config_id: Option<String>,
    pub current_model_id: String,
    pub current_model_name: Option<String>,
    pub available_models: Vec<AvailableModelPayload>,
}
