use std::path::PathBuf;
use std::sync::Arc;

use acp_client::Store;

use super::make_composite_key;
use crate::services::sessions::SessionStore;
use crate::types::messages::{Message, MessageContent, MessageRole};

/// A [`Store`] implementation that persists ACP session mappings to disk
/// under `~/.goose/acp_sessions/` and reads conversation history from the
/// [`SessionStore`].
///
/// When `persona_id` is set, the store uses a composite key
/// (`{sessionId}__{personaId}`) for both file-based session persistence and
/// message filtering, so each persona maintains an independent ACP agent
/// session and sees only its own conversation slice.
pub struct TauriStore {
    sessions_dir: PathBuf,
    session_store: Arc<SessionStore>,
    /// The raw Goose session ID (without persona suffix).
    session_id: String,
    /// Optional persona scoping.  When `Some`, the effective key used for
    /// on-disk persistence becomes `{session_id}__{persona_id}`.
    persona_id: Option<String>,
}

impl TauriStore {
    /// Create a new store, ensuring the backing directory exists.
    ///
    /// * `session_store` – shared session store for reading messages.
    /// * `session_id` – the Goose chat session ID.
    /// * `persona_id` – when `Some`, enables per-persona composite keying.
    ///   Pass `None` to preserve single-persona behaviour.
    pub fn new(
        session_store: Arc<SessionStore>,
        session_id: String,
        persona_id: Option<String>,
    ) -> Self {
        let sessions_dir = dirs::home_dir()
            .expect("home dir")
            .join(".goose")
            .join("acp_sessions");
        let _ = std::fs::create_dir_all(&sessions_dir);
        Self {
            sessions_dir,
            session_store,
            session_id,
            persona_id,
        }
    }

    // -- composite-key helpers ------------------------------------------------

    /// Build the effective key used for on-disk session files.
    /// Returns `"{session_id}__{persona_id}"` when a persona is set,
    /// otherwise plain `"{session_id}"`.
    fn effective_key(&self) -> String {
        make_composite_key(&self.session_id, self.persona_id.as_deref())
    }

    /// Look up a previously stored agent session ID, or `None` for new sessions.
    pub fn get_agent_session_id(&self) -> Option<String> {
        let key = self.effective_key();
        let path = self.sessions_dir.join(format!("{key}.json"));
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

    // -- persona-filtered message helpers -------------------------------------

    /// Returns `true` if `msg` should be visible to the persona identified by
    /// `persona_id`.
    ///
    /// Rules:
    /// * **User messages** are included when the message's
    ///   `metadata.target_persona_id` equals `persona_id`, **or** when the
    ///   message's `metadata.persona_id` equals `persona_id`.
    /// * **Assistant/System messages** are included when
    ///   `metadata.persona_id` equals `persona_id`.
    /// * Messages with **no metadata** or no matching persona fields are
    ///   excluded.
    fn message_matches_persona(msg: &Message, persona_id: &str) -> bool {
        let meta = match &msg.metadata {
            Some(m) => m,
            None => return false,
        };

        match msg.role {
            MessageRole::User => {
                let target_match = meta
                    .target_persona_id
                    .as_deref()
                    .map_or(false, |id| id == persona_id);
                let persona_match = meta
                    .persona_id
                    .as_deref()
                    .map_or(false, |id| id == persona_id);
                target_match || persona_match
            }
            MessageRole::Assistant | MessageRole::System => meta
                .persona_id
                .as_deref()
                .map_or(false, |id| id == persona_id),
        }
    }

    /// Convert a [`Message`] into the `(role, text)` pair expected by the
    /// ACP `Store` trait.
    fn message_to_pair(msg: &Message) -> Option<(String, String)> {
        let role = match msg.role {
            MessageRole::User => "user",
            MessageRole::Assistant => "assistant",
            MessageRole::System => "system",
        }
        .to_string();

        let text_parts: Vec<String> = msg
            .content
            .iter()
            .filter_map(|c| match c {
                MessageContent::Text { text } => Some(text.clone()),
                _ => None,
            })
            .collect();

        if text_parts.is_empty() {
            None
        } else {
            Some((role, text_parts.join("\n")))
        }
    }
}

impl Store for TauriStore {
    fn set_agent_session_id(&self, _session_id: &str, agent_session_id: &str) -> Result<(), String> {
        let key = self.effective_key();
        let path = self.sessions_dir.join(format!("{key}.json"));
        let payload = serde_json::json!({
            "session_id": self.session_id,
            "persona_id": self.persona_id,
            "agent_session_id": agent_session_id,
        });
        let json = serde_json::to_string_pretty(&payload)
            .map_err(|e| format!("Failed to serialize agent session mapping: {e}"))?;
        std::fs::write(&path, json)
            .map_err(|e| format!("Failed to write agent session file: {e}"))?;
        Ok(())
    }

    fn get_session_messages(&self, _session_id: &str) -> Result<Vec<(String, String)>, String> {
        let messages = self.session_store.get_messages(&self.session_id);

        let pairs: Vec<(String, String)> = match &self.persona_id {
            Some(pid) => {
                // Persona mode: only return messages relevant to this persona.
                messages
                    .iter()
                    .filter(|m| Self::message_matches_persona(m, pid))
                    .filter_map(|m| Self::message_to_pair(m))
                    .collect()
            }
            None => {
                // Single-persona / backward-compat mode: return all messages.
                messages
                    .iter()
                    .filter_map(|m| Self::message_to_pair(m))
                    .collect()
            }
        };

        Ok(pairs)
    }
}
