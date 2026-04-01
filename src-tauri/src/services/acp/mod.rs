mod catchup;
mod payloads;
mod registry;
mod store;
mod writer;

pub use catchup::build_catchup_context;
pub use registry::{AcpRunningSession, AcpSessionRegistry};
pub use store::TauriStore;
pub use writer::TauriMessageWriter;

use std::path::PathBuf;
use std::sync::Arc;

use acp_client::{AcpDriver, AgentDriver, MessageWriter, Store};

use crate::services::sessions::SessionStore;
use crate::types::messages::{MessageContent, MessageRole};

/// Build a composite registry key: `{session_id}__{persona_id}` when a
/// persona is active, or plain `session_id` for backward compatibility.
///
/// This assumes neither component contains `__`.
pub fn make_composite_key(session_id: &str, persona_id: Option<&str>) -> String {
    match persona_id {
        Some(pid) if !pid.is_empty() => format!("{session_id}__{pid}"),
        _ => session_id.to_string(),
    }
}

pub fn split_composite_key(key: &str) -> (&str, Option<&str>) {
    match key.split_once("__") {
        Some((session_id, persona_id)) if !persona_id.is_empty() => (session_id, Some(persona_id)),
        _ => (key, None),
    }
}

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
        persona_id: Option<String>,
        persona_name: Option<String>,
        images: Vec<(String, String)>,
    ) -> Result<(), String> {
        // Ensure the session exists in the SessionStore (create if needed)
        session_store.ensure_session(&session_id, Some(provider_id.clone()));

        // Save the user message to SessionStore, with persona metadata when targeted
        let user_message_id = uuid::Uuid::new_v4().to_string();
        let user_message = crate::types::messages::Message {
            id: user_message_id.clone(),
            role: MessageRole::User,
            created: chrono::Utc::now().timestamp_millis(),
            content: vec![MessageContent::Text {
                text: prompt.clone(),
            }],
            metadata: if persona_id.is_some() {
                Some(crate::types::messages::MessageMetadata {
                    target_persona_id: persona_id.clone(),
                    target_persona_name: persona_name.clone(),
                    ..Default::default()
                })
            } else {
                None
            },
        };
        if let Err(e) = session_store.add_message(&session_id, user_message) {
            eprintln!(
                "Failed to save user message for session {}: {}",
                session_id, e
            );
        }

        // Build catch-up context from intervening messages for this persona
        let catchup_context = if let Some(ref pid) = persona_id {
            let all_messages = session_store.get_messages(&session_id);
            build_catchup_context(&all_messages, pid, &user_message_id)
        } else {
            None
        };

        let driver = AcpDriver::new(&provider_id)?;

        let writer: Arc<dyn MessageWriter> = Arc::new(TauriMessageWriter::new(
            app_handle.clone(),
            session_id.clone(),
            Arc::clone(&session_store),
            persona_id.clone(),
            persona_name.clone(),
        ));
        let registry_key = make_composite_key(&session_id, persona_id.as_deref());
        let tauri_store =
            TauriStore::new(Arc::clone(&session_store), session_id.clone(), persona_id);
        let agent_session_id = tauri_store.get_agent_session_id();
        let store: Arc<dyn Store> = Arc::new(tauri_store);
        let cancel_token = registry.register(&registry_key, &provider_id);

        // Build the effective prompt, including persona instructions and
        // catch-up context when available.  When there is no extra context we
        // pass the raw prompt for backward compatibility.
        let has_system = system_prompt.as_ref().is_some_and(|s| !s.is_empty());
        let has_catchup = catchup_context.is_some();
        let effective_prompt = if has_system || has_catchup {
            let mut parts = Vec::new();
            if let Some(ref sp) = system_prompt {
                if !sp.is_empty() {
                    parts.push(format!(
                        "<persona-instructions>\n{sp}\n</persona-instructions>"
                    ));
                }
            }
            if let Some(ref ctx) = catchup_context {
                parts.push(format!(
                    "<conversation-context>\n{ctx}\n</conversation-context>"
                ));
            }
            parts.push(format!("<user-message>\n{prompt}\n</user-message>"));
            parts.join("\n\n")
        } else {
            prompt.clone()
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
                        &images,
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
        registry_inner.deregister(&registry_key);

        join_result.map_err(|e| format!("ACP task panicked: {e}"))?
    }
}
