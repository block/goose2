use crate::types::agents::{Session, SessionUpdate};
use crate::types::messages::Message;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct SessionStore {
    /// Session metadata indexed by session ID. Messages are loaded lazily from disk.
    sessions: Mutex<HashMap<String, Session>>,
    sessions_dir: PathBuf,
}

impl SessionStore {
    fn message_preview(message: &Message) -> Option<String> {
        for content in &message.content {
            if let crate::types::messages::MessageContent::Text { text } = content {
                let cutoff = text.char_indices().nth(100).map(|(index, _)| index);
                return Some(match cutoff {
                    Some(index) => format!("{}...", &text[..index]),
                    None => text.clone(),
                });
            }
        }

        None
    }

    fn refresh_session_message_metadata(session: &mut Session, messages: &[Message]) {
        session.message_count = messages.len() as u32;
        session.last_message_preview = messages.iter().rev().find_map(Self::message_preview);
        session.updated_at = chrono::Utc::now().to_rfc3339();
    }

    pub fn new() -> Self {
        let sessions_dir = dirs::home_dir()
            .expect("home dir")
            .join(".goose")
            .join("sessions");
        let _ = std::fs::create_dir_all(&sessions_dir);

        let metadata_file = sessions_dir.join("metadata.json");
        let sessions: HashMap<String, Session> = std::fs::read_to_string(&metadata_file)
            .ok()
            .and_then(|json| serde_json::from_str(&json).ok())
            .unwrap_or_default();

        Self {
            sessions: Mutex::new(sessions),
            sessions_dir,
        }
    }

    /// Persist the full metadata map to a single file.
    fn save_metadata(&self, sessions: &HashMap<String, Session>) {
        let metadata_file = self.sessions_dir.join("metadata.json");
        match serde_json::to_string_pretty(sessions) {
            Ok(json) => {
                if let Err(e) = std::fs::write(&metadata_file, json) {
                    eprintln!(
                        "Failed to write session metadata to {}: {}",
                        metadata_file.display(),
                        e
                    );
                }
            }
            Err(e) => {
                eprintln!("Failed to serialize session metadata: {}", e);
            }
        }
    }

    /// Persist messages for a single session to its directory.
    fn save_messages(&self, session_id: &str, messages: &[Message]) {
        let dir = self.sessions_dir.join(session_id);
        if let Err(e) = std::fs::create_dir_all(&dir) {
            eprintln!(
                "Failed to create session directory {}: {}",
                dir.display(),
                e
            );
            return;
        }
        match serde_json::to_string_pretty(messages) {
            Ok(json) => {
                let path = dir.join("messages.json");
                if let Err(e) = std::fs::write(&path, &json) {
                    eprintln!("Failed to write messages for session {}: {}", session_id, e);
                }
            }
            Err(e) => {
                eprintln!(
                    "Failed to serialize messages for session {}: {}",
                    session_id, e
                );
            }
        }
    }

    /// Load messages for a session from disk.
    fn load_messages(&self, session_id: &str) -> Vec<Message> {
        let path = self.sessions_dir.join(session_id).join("messages.json");
        std::fs::read_to_string(&path)
            .ok()
            .and_then(|json| serde_json::from_str(&json).ok())
            .unwrap_or_default()
    }

    pub fn create_session(&self, agent_id: Option<String>, project_id: Option<String>) -> Session {
        let now = chrono::Utc::now().to_rfc3339();
        let id = uuid::Uuid::new_v4().to_string();
        let session = Session {
            id: id.clone(),
            title: "New Chat".to_string(),
            agent_id,
            project_id,
            provider_id: None,
            persona_id: None,
            model_name: None,
            created_at: now.clone(),
            updated_at: now,
            message_count: 0,
            last_message_preview: None,
            archived_at: None,
            forked_from: None,
            fork_point_message_id: None,
        };

        // Write empty messages file
        self.save_messages(&id, &[]);

        let mut sessions = self.sessions.lock().unwrap();
        sessions.insert(id, session.clone());
        self.save_metadata(&sessions);
        session
    }

    #[allow(dead_code)]
    pub fn get_session(&self, id: &str) -> Option<Session> {
        let sessions = self.sessions.lock().unwrap();
        sessions.get(id).cloned()
    }

    /// Ensure a session with the given ID exists, creating it if necessary.
    /// Returns the session (existing or newly created).
    pub fn ensure_session(&self, id: &str, agent_id: Option<String>) -> Session {
        use std::collections::hash_map::Entry;

        let mut sessions = self.sessions.lock().unwrap();
        match sessions.entry(id.to_string()) {
            Entry::Occupied(entry) => entry.get().clone(),
            Entry::Vacant(entry) => {
                let now = chrono::Utc::now().to_rfc3339();
                let session = Session {
                    id: id.to_string(),
                    title: "New Chat".to_string(),
                    agent_id,
                    project_id: None,
                    provider_id: None,
                    persona_id: None,
                    model_name: None,
                    created_at: now.clone(),
                    updated_at: now,
                    message_count: 0,
                    last_message_preview: None,
                    archived_at: None,
                    forked_from: None,
                    fork_point_message_id: None,
                };

                self.save_messages(id, &[]);
                entry.insert(session.clone());
                self.save_metadata(&sessions);
                session
            }
        }
    }

    pub fn list_sessions(&self) -> Vec<Session> {
        let sessions = self.sessions.lock().unwrap();
        let mut list: Vec<Session> = sessions
            .values()
            .filter(|s| s.archived_at.is_none())
            .cloned()
            .collect();
        // Sort by updated_at descending (most recent first)
        list.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        list
    }

    pub fn list_archived_sessions(&self) -> Vec<Session> {
        let sessions = self.sessions.lock().unwrap();
        let mut list: Vec<Session> = sessions
            .values()
            .filter(|s| s.archived_at.is_some())
            .cloned()
            .collect();
        // Sort by archived_at descending (most recently archived first)
        list.sort_by(|a, b| b.archived_at.cmp(&a.archived_at));
        list
    }

    pub fn archive_session(&self, id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().unwrap();
        let session = sessions
            .get_mut(id)
            .ok_or_else(|| format!("Session '{}' not found", id))?;

        session.archived_at = Some(chrono::Utc::now().to_rfc3339());
        self.save_metadata(&sessions);
        Ok(())
    }

    pub fn unarchive_session(&self, id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().unwrap();
        let session = sessions
            .get_mut(id)
            .ok_or_else(|| format!("Session '{}' not found", id))?;

        session.archived_at = None;
        self.save_metadata(&sessions);
        Ok(())
    }

    pub fn add_message(&self, session_id: &str, message: Message) -> Result<(), String> {
        let mut sessions = self.sessions.lock().unwrap();
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("Session '{}' not found", session_id))?;

        let mut messages = self.load_messages(session_id);
        messages.push(message);
        Self::refresh_session_message_metadata(session, &messages);
        self.save_metadata(&sessions);
        self.save_messages(session_id, &messages);

        Ok(())
    }

    pub fn update_message<F>(
        &self,
        session_id: &str,
        message_id: &str,
        updater: F,
    ) -> Result<(), String>
    where
        F: FnOnce(&mut Message),
    {
        let mut sessions = self.sessions.lock().unwrap();
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("Session '{}' not found", session_id))?;

        let mut messages = self.load_messages(session_id);
        let message = messages
            .iter_mut()
            .find(|message| message.id == message_id)
            .ok_or_else(|| {
                format!(
                    "Message '{}' not found in session '{}'",
                    message_id, session_id
                )
            })?;
        updater(message);

        Self::refresh_session_message_metadata(session, &messages);
        self.save_metadata(&sessions);
        self.save_messages(session_id, &messages);

        Ok(())
    }

    pub fn get_messages(&self, session_id: &str) -> Vec<Message> {
        // Acquire the mutex to avoid reading a partially-written messages file
        let _guard = self.sessions.lock().unwrap();
        self.load_messages(session_id)
    }

    pub fn update_session(&self, id: &str, update: SessionUpdate) -> Result<(), String> {
        let mut sessions = self.sessions.lock().unwrap();
        let session = sessions
            .get_mut(id)
            .ok_or_else(|| format!("Session '{}' not found", id))?;

        if let Some(title) = update.title {
            session.title = title;
        }
        if let Some(provider_id) = update.provider_id {
            session.provider_id = Some(provider_id);
        }
        if let Some(persona_id) = update.persona_id {
            session.persona_id = Some(persona_id);
        }
        if let Some(model_name) = update.model_name {
            session.model_name = Some(model_name);
        }
        if let Some(project_id) = update.project_id {
            session.project_id = project_id;
        }
        session.updated_at = chrono::Utc::now().to_rfc3339();
        self.save_metadata(&sessions);
        Ok(())
    }

    pub fn fork_session(
        &self,
        source_session_id: &str,
        fork_at_message_id: &str,
    ) -> Result<Session, String> {
        let sessions = self.sessions.lock().unwrap();
        let source = sessions
            .get(source_session_id)
            .ok_or_else(|| format!("Session '{}' not found", source_session_id))?;

        let source_messages = self.load_messages(source_session_id);
        let fork_index = source_messages
            .iter()
            .position(|m| m.id == fork_at_message_id)
            .ok_or_else(|| {
                format!(
                    "Message '{}' not found in session '{}'",
                    fork_at_message_id, source_session_id
                )
            })?;

        let forked_messages: Vec<Message> = source_messages[..=fork_index].to_vec();

        let now = chrono::Utc::now().to_rfc3339();
        let new_id = uuid::Uuid::new_v4().to_string();

        let new_session = Session {
            id: new_id.clone(),
            title: source.title.clone(),
            agent_id: source.agent_id.clone(),
            project_id: source.project_id.clone(),
            provider_id: source.provider_id.clone(),
            persona_id: source.persona_id.clone(),
            model_name: source.model_name.clone(),
            created_at: now.clone(),
            updated_at: now,
            message_count: forked_messages.len() as u32,
            last_message_preview: source.last_message_preview.clone(),
            archived_at: None,
            forked_from: Some(source_session_id.to_string()),
            fork_point_message_id: Some(fork_at_message_id.to_string()),
        };

        self.save_messages(&new_id, &forked_messages);

        drop(sessions);
        let mut sessions = self.sessions.lock().unwrap();
        sessions.insert(new_id, new_session.clone());
        self.save_metadata(&sessions);

        Ok(new_session)
    }

    pub fn delete_session(&self, id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().unwrap();
        sessions
            .remove(id)
            .ok_or_else(|| format!("Session '{}' not found", id))?;

        self.save_metadata(&sessions);

        // Remove messages directory from disk
        let dir = self.sessions_dir.join(id);
        let _ = std::fs::remove_dir_all(dir);
        Ok(())
    }
}
