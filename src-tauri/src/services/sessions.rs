use crate::types::agents::Session;
use crate::types::messages::Message;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

struct SessionData {
    session: Session,
    messages: Vec<Message>,
}

pub struct SessionStore {
    sessions: Mutex<HashMap<String, SessionData>>,
    sessions_dir: PathBuf,
}

impl SessionStore {
    pub fn new() -> Self {
        let sessions_dir = dirs::home_dir()
            .expect("home dir")
            .join(".goose")
            .join("sessions");
        let _ = std::fs::create_dir_all(&sessions_dir);

        let mut sessions = HashMap::new();

        // Load existing sessions from disk
        if let Ok(entries) = std::fs::read_dir(&sessions_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    if let Some(id) = path.file_name().and_then(|n| n.to_str()) {
                        let session_file = path.join("session.json");
                        let messages_file = path.join("messages.json");

                        if let Ok(session_json) = std::fs::read_to_string(&session_file) {
                            if let Ok(session) = serde_json::from_str::<Session>(&session_json) {
                                let messages: Vec<Message> =
                                    std::fs::read_to_string(&messages_file)
                                        .ok()
                                        .and_then(|m| serde_json::from_str(&m).ok())
                                        .unwrap_or_default();

                                sessions.insert(id.to_string(), SessionData { session, messages });
                            }
                        }
                    }
                }
            }
        }

        Self {
            sessions: Mutex::new(sessions),
            sessions_dir,
        }
    }

    fn save_session(&self, id: &str, data: &SessionData) {
        let dir = self.sessions_dir.join(id);
        let _ = std::fs::create_dir_all(&dir);

        if let Ok(json) = serde_json::to_string_pretty(&data.session) {
            let _ = std::fs::write(dir.join("session.json"), json);
        }
        if let Ok(json) = serde_json::to_string_pretty(&data.messages) {
            let _ = std::fs::write(dir.join("messages.json"), json);
        }
    }

    pub fn create_session(&self, agent_id: Option<String>) -> Session {
        let now = chrono::Utc::now().to_rfc3339();
        let id = uuid::Uuid::new_v4().to_string();
        let session = Session {
            id: id.clone(),
            title: "New Chat".to_string(),
            agent_id,
            created_at: now.clone(),
            updated_at: now,
            message_count: 0,
            last_message_preview: None,
        };

        let data = SessionData {
            session: session.clone(),
            messages: Vec::new(),
        };

        self.save_session(&id, &data);

        let mut sessions = self.sessions.lock().unwrap();
        sessions.insert(id, data);
        session
    }

    #[allow(dead_code)]
    pub fn get_session(&self, id: &str) -> Option<Session> {
        let sessions = self.sessions.lock().unwrap();
        sessions.get(id).map(|d| d.session.clone())
    }

    pub fn list_sessions(&self) -> Vec<Session> {
        let sessions = self.sessions.lock().unwrap();
        let mut list: Vec<Session> = sessions.values().map(|d| d.session.clone()).collect();
        // Sort by updated_at descending (most recent first)
        list.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        list
    }

    pub fn add_message(&self, session_id: &str, message: Message) -> Result<(), String> {
        let mut sessions = self.sessions.lock().unwrap();
        let data = sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("Session '{}' not found", session_id))?;

        // Update session metadata
        data.session.message_count += 1;
        data.session.updated_at = chrono::Utc::now().to_rfc3339();

        // Extract a preview from text content
        for content in &message.content {
            if let crate::types::messages::MessageContent::Text { text } = content {
                let preview = if text.len() > 100 {
                    format!("{}...", &text[..100])
                } else {
                    text.clone()
                };
                data.session.last_message_preview = Some(preview);
                break;
            }
        }

        data.messages.push(message);
        self.save_session(session_id, data);
        Ok(())
    }

    pub fn get_messages(&self, session_id: &str) -> Vec<Message> {
        let sessions = self.sessions.lock().unwrap();
        sessions
            .get(session_id)
            .map(|d| d.messages.clone())
            .unwrap_or_default()
    }

    #[allow(dead_code)]
    pub fn update_session_title(&self, id: &str, title: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().unwrap();
        let data = sessions
            .get_mut(id)
            .ok_or_else(|| format!("Session '{}' not found", id))?;

        data.session.title = title.to_string();
        data.session.updated_at = chrono::Utc::now().to_rfc3339();
        self.save_session(id, data);
        Ok(())
    }

    pub fn delete_session(&self, id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().unwrap();
        sessions
            .remove(id)
            .ok_or_else(|| format!("Session '{}' not found", id))?;

        // Remove from disk
        let dir = self.sessions_dir.join(id);
        let _ = std::fs::remove_dir_all(dir);
        Ok(())
    }
}
