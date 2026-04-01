use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use async_trait::async_trait;
use serde::Serialize;
use tauri::Emitter;
use tokio_util::sync::CancellationToken;

use acp_client::{
    AcpDriver, AgentDriver, MessageWriter, SessionInfoUpdate, SessionModelState, Store,
};

use crate::services::sessions::SessionStore;
use crate::types::messages::{MessageContent, MessageRole};

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

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionInfoPayload {
    session_id: String,
    title: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ModelStatePayload {
    session_id: String,
    current_model_id: String,
    current_model_name: Option<String>,
}

/// A [`MessageWriter`] implementation that streams ACP output to the frontend
/// via Tauri events, and saves the final assistant message to the
/// [`SessionStore`] on finalization.
pub struct TauriMessageWriter {
    app_handle: tauri::AppHandle,
    session_id: String,
    session_store: Arc<SessionStore>,
    /// Accumulated response text across all `append_text` calls.
    accumulated_text: std::sync::Mutex<String>,
}

impl TauriMessageWriter {
    /// Create a new writer that emits events for the given session.
    pub fn new(
        app_handle: tauri::AppHandle,
        session_id: String,
        session_store: Arc<SessionStore>,
    ) -> Self {
        Self {
            app_handle,
            session_id,
            session_store,
            accumulated_text: std::sync::Mutex::new(String::new()),
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
                metadata: None,
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

// TauriStore

/// A [`Store`] implementation that persists ACP session mappings to disk
/// under `~/.goose/acp_sessions/` and reads conversation history from the
/// [`SessionStore`].
pub struct TauriStore {
    sessions_dir: PathBuf,
    session_store: Arc<SessionStore>,
}

impl TauriStore {
    /// Create a new store, ensuring the backing directory exists.
    pub fn new(session_store: Arc<SessionStore>) -> Self {
        let sessions_dir = dirs::home_dir()
            .expect("home dir")
            .join(".goose")
            .join("acp_sessions");
        let _ = std::fs::create_dir_all(&sessions_dir);
        Self {
            sessions_dir,
            session_store,
        }
    }

    /// Look up a previously stored agent session ID, or `None` for new sessions.
    pub fn get_agent_session_id(&self, session_id: &str) -> Option<String> {
        let path = self.sessions_dir.join(format!("{session_id}.json"));
        let json = std::fs::read_to_string(&path).ok()?;
        let mapping: serde_json::Value = serde_json::from_str(&json).ok()?;
        mapping["agent_session_id"].as_str().map(String::from)
    }

    /// Remove session files that are older than the given duration.
    pub fn cleanup_stale_sessions(max_age: std::time::Duration) {
        let sessions_dir = dirs::home_dir()
            .expect("home dir")
            .join(".goose")
            .join("acp_sessions");

        if let Ok(entries) = std::fs::read_dir(&sessions_dir) {
            let cutoff = std::time::SystemTime::now() - max_age;
            for entry in entries.flatten() {
                if let Ok(metadata) = entry.metadata() {
                    if let Ok(modified) = metadata.modified() {
                        if modified < cutoff {
                            let _ = std::fs::remove_file(entry.path());
                        }
                    }
                }
            }
        }
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

    fn get_session_messages(&self, session_id: &str) -> Result<Vec<(String, String)>, String> {
        let messages = self.session_store.get_messages(session_id);
        let mut pairs = Vec::new();
        for msg in messages {
            let role = match msg.role {
                MessageRole::User => "user",
                MessageRole::Assistant => "assistant",
                MessageRole::System => "system",
            }
            .to_string();

            // Concatenate all text content blocks into a single string
            let text_parts: Vec<String> = msg
                .content
                .iter()
                .filter_map(|c| match c {
                    MessageContent::Text { text } => Some(text.clone()),
                    _ => None,
                })
                .collect();

            if !text_parts.is_empty() {
                pairs.push((role, text_parts.join("\n")));
            }
        }
        Ok(pairs)
    }
}

// AcpSessionRegistry

/// Info about a running ACP session, returned to the frontend.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpRunningSession {
    pub session_id: String,
    pub provider_id: String,
    pub running_for_secs: u64,
}

struct AcpSessionEntry {
    cancel_token: CancellationToken,
    provider_id: String,
    started_at: std::time::Instant,
    /// PID of the process that owns this session (for orphan detection).
    #[allow(dead_code)]
    owner_pid: u32,
}

/// Tracks running ACP sessions for cancellation and cleanup.
///
/// Each running session is registered with a `CancellationToken` so it can
/// be cancelled from the frontend or cleaned up on shutdown.
pub struct AcpSessionRegistry {
    sessions: std::sync::Mutex<HashMap<String, AcpSessionEntry>>,
}

impl AcpSessionRegistry {
    pub fn new() -> Self {
        Self {
            sessions: std::sync::Mutex::new(HashMap::new()),
        }
    }

    /// Register a new session and return its cancellation token.
    pub fn register(&self, session_id: &str, provider_id: &str) -> CancellationToken {
        let token = CancellationToken::new();
        let entry = AcpSessionEntry {
            cancel_token: token.clone(),
            provider_id: provider_id.to_string(),
            started_at: std::time::Instant::now(),
            owner_pid: std::process::id(),
        };
        self.sessions
            .lock()
            .expect("session registry lock")
            .insert(session_id.to_string(), entry);
        token
    }

    /// Deregister a session (called when it completes or errors).
    pub fn deregister(&self, session_id: &str) {
        self.sessions
            .lock()
            .expect("session registry lock")
            .remove(session_id);
    }

    /// Cancel a running session by signalling its cancellation token.
    pub fn cancel(&self, session_id: &str) -> bool {
        let guard = self.sessions.lock().expect("session registry lock");
        if let Some(entry) = guard.get(session_id) {
            entry.cancel_token.cancel();
            true
        } else {
            false
        }
    }

    /// Cancel all running sessions (used during app shutdown).
    pub fn cancel_all(&self) {
        let guard = self.sessions.lock().expect("session registry lock");
        for entry in guard.values() {
            entry.cancel_token.cancel();
        }
    }

    /// Return info about all currently running sessions (for the frontend).
    pub fn list_running(&self) -> Vec<AcpRunningSession> {
        let guard = self.sessions.lock().expect("session registry lock");
        guard
            .iter()
            .map(|(id, entry)| AcpRunningSession {
                session_id: id.clone(),
                provider_id: entry.provider_id.clone(),
                running_for_secs: entry.started_at.elapsed().as_secs(),
            })
            .collect()
    }
}

// AcpService

/// High-level service for running ACP prompts through an agent driver.
///
/// The actual response content is streamed to the frontend via Tauri events
/// emitted by [`TauriMessageWriter`]; the returned `Result` only signals
/// whether the request was successfully dispatched.
pub struct AcpService;

impl AcpService {
    /// Send a prompt to the given ACP provider and stream the response via
    /// Tauri events.
    #[allow(clippy::too_many_arguments)]
    pub async fn send_prompt(
        app_handle: tauri::AppHandle,
        registry: Arc<AcpSessionRegistry>,
        session_store: Arc<SessionStore>,
        session_id: String,
        provider_id: String,
        prompt: String,
        working_dir: PathBuf,
        system_prompt: Option<String>,
    ) -> Result<(), String> {
        // Ensure the session exists in the SessionStore (create if needed)
        session_store.ensure_session(&session_id, Some(provider_id.clone()));

        // Save the user message to SessionStore
        let user_message = crate::types::messages::Message {
            id: uuid::Uuid::new_v4().to_string(),
            role: MessageRole::User,
            created: chrono::Utc::now().timestamp(),
            content: vec![MessageContent::Text {
                text: prompt.clone(),
            }],
            metadata: None,
        };
        if let Err(e) = session_store.add_message(&session_id, user_message) {
            eprintln!(
                "Failed to save user message for session {}: {}",
                session_id, e
            );
        }

        let driver = AcpDriver::new(&provider_id)?;

        let writer: Arc<dyn MessageWriter> = Arc::new(TauriMessageWriter::new(
            app_handle.clone(),
            session_id.clone(),
            Arc::clone(&session_store),
        ));
        let tauri_store = TauriStore::new(Arc::clone(&session_store));
        let agent_session_id = tauri_store.get_agent_session_id(&session_id);
        let store: Arc<dyn Store> = Arc::new(tauri_store);
        let cancel_token = registry.register(&session_id, &provider_id);

        // Prepend the effective system prompt so the agent sees persona and
        // project instructions as context for this turn.
        let effective_prompt = match &system_prompt {
            Some(sp) if !sp.is_empty() => {
                format!("<persona-instructions>\n{sp}\n</persona-instructions>\n\n{prompt}")
            }
            _ => prompt.clone(),
        };

        // AcpDriver::run may use !Send futures internally, so we run it on a
        // dedicated thread with a LocalSet.
        let session_id_inner = session_id.clone();
        let registry_inner = Arc::clone(&registry);
        let join_result = tokio::task::spawn_blocking(move || {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .map_err(|e| format!("Failed to build tokio runtime: {e}"))?;

            let local = tokio::task::LocalSet::new();
            local.block_on(&rt, async move {
                driver
                    .run(
                        &session_id_inner,
                        &effective_prompt,
                        &[],
                        &working_dir,
                        &store,
                        &writer,
                        &cancel_token,
                        agent_session_id.as_deref(),
                    )
                    .await
            })
        })
        .await;

        // Always deregister, even on panic/JoinError
        registry_inner.deregister(&session_id);

        join_result.map_err(|e| format!("ACP task panicked: {e}"))?
    }
}
