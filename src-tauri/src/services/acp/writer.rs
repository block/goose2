use std::sync::Arc;

use async_trait::async_trait;
use tauri::Emitter;

use acp_client::{MessageWriter, SessionInfoUpdate, SessionModelState};

use crate::services::sessions::SessionStore;
use crate::types::messages::{MessageContent, MessageRole};

use super::payloads::{
    DonePayload, ModelStatePayload, SessionInfoPayload, TextPayload, ToolCallPayload,
    ToolResultPayload, ToolTitlePayload,
};

/// A [`MessageWriter`] implementation that streams ACP output to the frontend
/// via Tauri events, and saves the final assistant message to the
/// [`SessionStore`] on finalization.
pub struct TauriMessageWriter {
    app_handle: tauri::AppHandle,
    session_id: String,
    session_store: Arc<SessionStore>,
    /// Accumulated response text across all `append_text` calls.
    accumulated_text: std::sync::Mutex<String>,
    /// Persona identity to stamp on the finalized assistant message.
    persona_id: Option<String>,
    persona_name: Option<String>,
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
        Self {
            app_handle,
            session_id,
            session_store,
            accumulated_text: std::sync::Mutex::new(String::new()),
            persona_id,
            persona_name,
        }
    }
}

#[async_trait]
impl MessageWriter for TauriMessageWriter {
    async fn append_text(&self, text: &str) {
        // Accumulate the text for later persistence
        {
            let mut acc = self.accumulated_text.lock().expect("accumulated_text lock");
            acc.push_str(text);
        }

        let _ = self.app_handle.emit(
            "acp:text",
            TextPayload {
                session_id: self.session_id.clone(),
                text: text.to_string(),
            },
        );
    }

    async fn finalize(&self) {
        // Save the accumulated assistant message to the SessionStore
        let text = {
            let acc = self.accumulated_text.lock().expect("accumulated_text lock");
            acc.clone()
        };

        if !text.is_empty() {
            let message = crate::types::messages::Message {
                id: uuid::Uuid::new_v4().to_string(),
                role: MessageRole::Assistant,
                created: chrono::Utc::now().timestamp(),
                content: vec![MessageContent::Text { text }],
                metadata: if self.persona_id.is_some() || self.persona_name.is_some() {
                    Some(crate::types::messages::MessageMetadata {
                        persona_id: self.persona_id.clone(),
                        persona_name: self.persona_name.clone(),
                        ..Default::default()
                    })
                } else {
                    None
                },
            };

            if let Err(e) = self.session_store.add_message(&self.session_id, message) {
                eprintln!(
                    "Failed to save assistant message for session {}: {}",
                    self.session_id, e
                );
            }
        }

        let _ = self.app_handle.emit(
            "acp:done",
            DonePayload {
                session_id: self.session_id.clone(),
            },
        );
    }

    async fn record_tool_call(&self, tool_call_id: &str, title: &str) {
        let _ = self.app_handle.emit(
            "acp:tool_call",
            ToolCallPayload {
                session_id: self.session_id.clone(),
                tool_call_id: tool_call_id.to_string(),
                title: title.to_string(),
            },
        );
    }

    async fn update_tool_call_title(&self, tool_call_id: &str, title: &str) {
        let _ = self.app_handle.emit(
            "acp:tool_title",
            ToolTitlePayload {
                session_id: self.session_id.clone(),
                tool_call_id: tool_call_id.to_string(),
                title: title.to_string(),
            },
        );
    }

    async fn record_tool_result(&self, content: &str) {
        let _ = self.app_handle.emit(
            "acp:tool_result",
            ToolResultPayload {
                session_id: self.session_id.clone(),
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
