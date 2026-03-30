use std::path::PathBuf;
use std::sync::Arc;

use async_trait::async_trait;
use serde::Serialize;
use tauri::Emitter;
use tokio_util::sync::CancellationToken;

use acp_client::{AcpDriver, AgentDriver, MessageWriter, Store};

// ---------------------------------------------------------------------------
// Event payload types
// ---------------------------------------------------------------------------

/// Payload for the `acp:text` event.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TextPayload {
    session_id: String,
    text: String,
}

/// Payload for the `acp:done` event.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DonePayload {
    session_id: String,
}

/// Payload for the `acp:tool_call` event.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ToolCallPayload {
    session_id: String,
    tool_call_id: String,
    title: String,
}

/// Payload for the `acp:tool_title` event.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ToolTitlePayload {
    session_id: String,
    tool_call_id: String,
    title: String,
}

/// Payload for the `acp:tool_result` event.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ToolResultPayload {
    session_id: String,
    content: String,
}

// ---------------------------------------------------------------------------
// TauriMessageWriter
// ---------------------------------------------------------------------------

/// A [`MessageWriter`] implementation that streams ACP output to the frontend
/// via Tauri events.
pub struct TauriMessageWriter {
    app_handle: tauri::AppHandle,
    session_id: String,
}

impl TauriMessageWriter {
    /// Create a new writer that emits events for the given session.
    pub fn new(app_handle: tauri::AppHandle, session_id: String) -> Self {
        Self {
            app_handle,
            session_id,
        }
    }
}

#[async_trait]
impl MessageWriter for TauriMessageWriter {
    async fn append_text(&self, text: &str) {
        let _ = self.app_handle.emit(
            "acp:text",
            TextPayload {
                session_id: self.session_id.clone(),
                text: text.to_string(),
            },
        );
    }

    async fn finalize(&self) {
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
}

// ---------------------------------------------------------------------------
// TauriStore
// ---------------------------------------------------------------------------

/// A [`Store`] implementation that persists ACP session mappings to disk
/// under `~/.goose/acp_sessions/`.
pub struct TauriStore {
    sessions_dir: PathBuf,
}

impl TauriStore {
    /// Create a new store, ensuring the backing directory exists.
    pub fn new() -> Self {
        let sessions_dir = dirs::home_dir()
            .expect("home dir")
            .join(".goose")
            .join("acp_sessions");
        let _ = std::fs::create_dir_all(&sessions_dir);
        Self { sessions_dir }
    }
}

impl Store for TauriStore {
    fn set_agent_session_id(&self, session_id: &str, agent_session_id: &str) -> Result<(), String> {
        let path = self.sessions_dir.join(format!("{session_id}.json"));
        let payload = serde_json::json!({
            "session_id": session_id,
            "agent_session_id": agent_session_id,
        });
        let json = serde_json::to_string_pretty(&payload)
            .map_err(|e| format!("Failed to serialize agent session mapping: {e}"))?;
        std::fs::write(&path, json)
            .map_err(|e| format!("Failed to write agent session file: {e}"))?;
        Ok(())
    }

    fn get_session_messages(&self, _session_id: &str) -> Result<Vec<(String, String)>, String> {
        // Placeholder — can be enhanced to load persisted messages later.
        Ok(Vec::new())
    }
}

// ---------------------------------------------------------------------------
// AcpService
// ---------------------------------------------------------------------------

/// High-level service for running ACP prompts through an agent driver.
///
/// The actual response content is streamed to the frontend via Tauri events
/// emitted by [`TauriMessageWriter`]; the returned `Result` only signals
/// whether the request was successfully dispatched.
pub struct AcpService;

impl AcpService {
    /// Send a prompt to the given ACP provider and stream the response via
    /// Tauri events.
    pub async fn send_prompt(
        app_handle: tauri::AppHandle,
        session_id: String,
        provider_id: String,
        prompt: String,
        working_dir: PathBuf,
    ) -> Result<(), String> {
        let driver = AcpDriver::new(&provider_id)?;

        let writer: Arc<dyn MessageWriter> =
            Arc::new(TauriMessageWriter::new(app_handle.clone(), session_id.clone()));
        let store: Arc<dyn Store> = Arc::new(TauriStore::new());
        let cancel_token = CancellationToken::new();

        // AcpDriver::run may use !Send futures internally, so we run it on a
        // dedicated thread with a LocalSet.
        let session_id_inner = session_id.clone();
        tokio::task::spawn_blocking(move || {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .map_err(|e| format!("Failed to build tokio runtime: {e}"))?;

            let local = tokio::task::LocalSet::new();
            local.block_on(&rt, async move {
                driver
                    .run(
                        &session_id_inner,
                        &prompt,
                        &[],
                        &working_dir,
                        &store,
                        &writer,
                        &cancel_token,
                        None,
                    )
                    .await
            })
        })
        .await
        .map_err(|e| format!("ACP task panicked: {e}"))??;

        Ok(())
    }
}
