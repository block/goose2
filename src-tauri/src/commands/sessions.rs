use std::sync::Arc;

use crate::services::sessions::SessionStore;
use crate::types::agents::Session;
use crate::types::messages::Message;
use tauri::State;

#[tauri::command]
pub fn create_session(store: State<'_, Arc<SessionStore>>, agent_id: Option<String>, project_id: Option<String>) -> Session {
    store.create_session(agent_id, project_id)
}

#[tauri::command]
pub fn list_sessions(store: State<'_, Arc<SessionStore>>) -> Vec<Session> {
    store.list_sessions()
}

#[tauri::command]
pub fn get_session_messages(store: State<'_, Arc<SessionStore>>, session_id: String) -> Vec<Message> {
    store.get_messages(&session_id)
}

#[tauri::command]
pub fn delete_session(store: State<'_, Arc<SessionStore>>, session_id: String) -> Result<(), String> {
    store.delete_session(&session_id)
}
