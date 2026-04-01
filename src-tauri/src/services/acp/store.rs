use std::path::PathBuf;
use std::sync::Arc;

use acp_client::Store;

use crate::services::sessions::SessionStore;
use crate::types::messages::{MessageContent, MessageRole};

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
