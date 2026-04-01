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
        let tauri_store = TauriStore::new(
            Arc::clone(&session_store),
            session_id.clone(),
            persona_id,
        );
        let agent_session_id = tauri_store.get_agent_session_id();
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
