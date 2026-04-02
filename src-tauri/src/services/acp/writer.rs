use std::sync::Arc;

use async_trait::async_trait;
use tauri::Emitter;

use acp_client::{MessageWriter, SessionInfoUpdate, SessionModelState};

use crate::services::sessions::SessionStore;
use crate::types::messages::{
    Message, MessageCompletionStatus, MessageContent, MessageMetadata, MessageRole, ToolCallStatus,
};

use super::payloads::{
    DonePayload, MessageCreatedPayload, ModelStatePayload, SessionInfoPayload, TextPayload,
    ToolCallPayload, ToolResultPayload, ToolTitlePayload,
};

/// A [`MessageWriter`] implementation that streams ACP output to the frontend
/// via Tauri events, and saves the final assistant message to the
/// [`SessionStore`] on finalization.
pub struct TauriMessageWriter {
    app_handle: tauri::AppHandle,
    session_id: String,
    session_store: Arc<SessionStore>,
    assistant_message_id: String,
    /// Accumulated structured content (text + tool calls/results) for persistence.
    accumulated_content: std::sync::Mutex<Vec<MessageContent>>,
}

impl TauriMessageWriter {
    /// Create a new writer that emits events for the given session.
    pub fn new(
        app_handle: tauri::AppHandle,
        session_id: String,
        session_store: Arc<SessionStore>,
        persona_id: Option<String>,
        persona_name: Option<String>,
    ) -> Self {
        let assistant_message_id = uuid::Uuid::new_v4().to_string();
        let message = Message {
            id: assistant_message_id.clone(),
            role: MessageRole::Assistant,
            created: chrono::Utc::now().timestamp_millis(),
            content: Vec::new(),
            metadata: Some(MessageMetadata {
                user_visible: Some(true),
                agent_visible: Some(true),
                persona_id: persona_id.clone(),
                persona_name: persona_name.clone(),
                completion_status: Some(MessageCompletionStatus::InProgress),
                ..Default::default()
            }),
        };

        if let Err(error) = session_store.add_message(&session_id, message) {
            eprintln!(
                "Failed to create streaming assistant message for session {}: {}",
                session_id, error
            );
        }

        let _ = app_handle.emit(
            "acp:message_created",
            MessageCreatedPayload {
                session_id: session_id.clone(),
                message_id: assistant_message_id.clone(),
                persona_id: persona_id.clone(),
                persona_name: persona_name.clone(),
            },
        );

        Self {
            app_handle,
            session_id,
            session_store,
            assistant_message_id,
            accumulated_content: std::sync::Mutex::new(Vec::new()),
        }
    }

    pub fn assistant_message_id(&self) -> &str {
        &self.assistant_message_id
    }

    fn persist_snapshot(&self, completion_status: Option<MessageCompletionStatus>) {
        let content = self
            .accumulated_content
            .lock()
            .expect("accumulated_content lock")
            .clone();

        if let Err(error) = self.session_store.update_message(
            &self.session_id,
            &self.assistant_message_id,
            |message| {
                message.content = content.clone();
                if let Some(status) = completion_status.clone() {
                    let metadata = message
                        .metadata
                        .get_or_insert_with(MessageMetadata::default);
                    let current = metadata.completion_status.clone();
                    let should_replace = !matches!(
                        current,
                        Some(MessageCompletionStatus::Stopped)
                            | Some(MessageCompletionStatus::Error)
                    ) || matches!(
                        status,
                        MessageCompletionStatus::Stopped | MessageCompletionStatus::Error
                    );
                    if should_replace {
                        metadata.completion_status = Some(status);
                    }
                }
            },
        ) {
            eprintln!(
                "Failed to update assistant message {} for session {}: {}",
                self.assistant_message_id, self.session_id, error
            );
        }
    }
}

fn append_text_block(content: &mut Vec<MessageContent>, text: &str) {
    if text.is_empty() {
        return;
    }

    match content.last_mut() {
        Some(MessageContent::Text { text: existing }) => existing.push_str(text),
        _ => content.push(MessageContent::Text {
            text: text.to_string(),
        }),
    }
}

fn find_latest_unpaired_tool_request(
    content: &[MessageContent],
) -> Option<(usize, String, String)> {
    for index in (0..content.len()).rev() {
        let MessageContent::ToolRequest { id, name, .. } = &content[index] else {
            continue;
        };

        let already_has_response = content.iter().any(
            |candidate| matches!(candidate, MessageContent::ToolResponse { id: response_id, .. } if response_id == id),
        );
        if !already_has_response {
            return Some((index, id.clone(), name.clone()));
        }
    }

    None
}

#[async_trait]
impl MessageWriter for TauriMessageWriter {
    async fn append_text(&self, text: &str) {
        {
            let mut content = self
                .accumulated_content
                .lock()
                .expect("accumulated_content lock");
            append_text_block(&mut content, text);
        }
        self.persist_snapshot(None);

        let _ = self.app_handle.emit(
            "acp:text",
            TextPayload {
                session_id: self.session_id.clone(),
                message_id: self.assistant_message_id.clone(),
                text: text.to_string(),
            },
        );
    }

    async fn finalize(&self) {
        self.persist_snapshot(Some(MessageCompletionStatus::Completed));

        let _ = self.app_handle.emit(
            "acp:done",
            DonePayload {
                session_id: self.session_id.clone(),
                message_id: self.assistant_message_id.clone(),
            },
        );
    }

    async fn record_tool_call(&self, tool_call_id: &str, title: &str) {
        {
            let mut content = self
                .accumulated_content
                .lock()
                .expect("accumulated_content lock");
            content.push(MessageContent::ToolRequest {
                id: tool_call_id.to_string(),
                name: title.to_string(),
                arguments: serde_json::json!({}),
                status: ToolCallStatus::Executing,
            });
        }
        self.persist_snapshot(None);

        let _ = self.app_handle.emit(
            "acp:tool_call",
            ToolCallPayload {
                session_id: self.session_id.clone(),
                message_id: self.assistant_message_id.clone(),
                tool_call_id: tool_call_id.to_string(),
                title: title.to_string(),
            },
        );
    }

    async fn update_tool_call_title(&self, tool_call_id: &str, title: &str) {
        {
            let mut content = self
                .accumulated_content
                .lock()
                .expect("accumulated_content lock");
            for block in content.iter_mut().rev() {
                if let MessageContent::ToolRequest { id, name, .. } = block {
                    if id == tool_call_id {
                        *name = title.to_string();
                        break;
                    }
                }
            }
        }
        self.persist_snapshot(None);

        let _ = self.app_handle.emit(
            "acp:tool_title",
            ToolTitlePayload {
                session_id: self.session_id.clone(),
                message_id: self.assistant_message_id.clone(),
                tool_call_id: tool_call_id.to_string(),
                title: title.to_string(),
            },
        );
    }

    async fn record_tool_result(&self, content: &str) {
        {
            let mut accumulated = self
                .accumulated_content
                .lock()
                .expect("accumulated_content lock");

            let paired_request = find_latest_unpaired_tool_request(&accumulated);

            if let Some((request_index, tool_call_id, tool_name)) = paired_request {
                if let MessageContent::ToolRequest { status, .. } = &mut accumulated[request_index]
                {
                    *status = ToolCallStatus::Completed;
                }

                accumulated.push(MessageContent::ToolResponse {
                    id: tool_call_id,
                    name: tool_name,
                    result: content.to_string(),
                    is_error: false,
                });
            } else {
                accumulated.push(MessageContent::ToolResponse {
                    id: uuid::Uuid::new_v4().to_string(),
                    name: String::new(),
                    result: content.to_string(),
                    is_error: false,
                });
            }
        }
        self.persist_snapshot(None);

        let _ = self.app_handle.emit(
            "acp:tool_result",
            ToolResultPayload {
                session_id: self.session_id.clone(),
                message_id: self.assistant_message_id.clone(),
                content: content.to_string(),
            },
        );
    }

    async fn on_session_info_update(&self, info: &SessionInfoUpdate) {
        let _ = self.app_handle.emit(
            "acp:session_info",
            SessionInfoPayload {
                session_id: self.session_id.clone(),
                title: info.title.value().cloned(),
            },
        );
    }

    async fn on_model_state_update(&self, state: &SessionModelState) {
        let current_model_name = state
            .available_models
            .iter()
            .find(|m| m.model_id == state.current_model_id)
            .map(|m| m.name.clone());
        let _ = self.app_handle.emit(
            "acp:model_state",
            ModelStatePayload {
                session_id: self.session_id.clone(),
                current_model_id: state.current_model_id.to_string(),
                current_model_name,
            },
        );
    }
}
