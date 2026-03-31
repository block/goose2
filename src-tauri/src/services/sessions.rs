use crate::types::agents::Session;
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
            created_at: now.clone(),
            updated_at: now,
            message_count: 0,
            last_message_preview: None,
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
                    created_at: now.clone(),
                    updated_at: now,
                    message_count: 0,
                    last_message_preview: None,
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
        let mut list: Vec<Session> = sessions.values().cloned().collect();
        // Sort by updated_at descending (most recent first)
        list.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        list
    }

    pub fn add_message(&self, session_id: &str, message: Message) -> Result<(), String> {
        let mut sessions = self.sessions.lock().unwrap();
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("Session '{}' not found", session_id))?;

        // Update session metadata
        session.message_count += 1;
        session.updated_at = chrono::Utc::now().to_rfc3339();

        // Extract a preview from text content
        for content in &message.content {
            if let crate::types::messages::MessageContent::Text { text } = content {
                let preview = if text.len() > 100 {
                    format!("{}...", &text[..100])
                } else {
                    text.clone()
                };
                session.last_message_preview = Some(preview);
                break;
            }
        }

        self.save_metadata(&sessions);

        // Append message to the messages file on disk
        let mut messages = self.load_messages(session_id);
        messages.push(message);
        self.save_messages(session_id, &messages);

        Ok(())
    }

    pub fn get_messages(&self, session_id: &str) -> Vec<Message> {
        // Acquire the mutex to avoid reading a partially-written messages file
        let _guard = self.sessions.lock().unwrap();
        self.load_messages(session_id)
    }

    #[allow(dead_code)]
    pub fn update_session_title(&self, id: &str, title: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().unwrap();
        let session = sessions
            .get_mut(id)
            .ok_or_else(|| format!("Session '{}' not found", id))?;

        session.title = title.to_string();
        session.updated_at = chrono::Utc::now().to_rfc3339();
        self.save_metadata(&sessions);
        Ok(())
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
