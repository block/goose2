use crate::services::sessions::SessionStore;
use crate::types::agents::Session;
use crate::types::messages::Message;
use tauri::State;

#[tauri::command]
pub fn create_session(store: State<'_, SessionStore>, agent_id: Option<String>) -> Session {
    store.create_session(agent_id)
}

#[tauri::command]
pub fn list_sessions(store: State<'_, SessionStore>) -> Vec<Session> {
    store.list_sessions()
}

#[tauri::command]
pub fn get_session_messages(store: State<'_, SessionStore>, session_id: String) -> Vec<Message> {
    store.get_messages(&session_id)
}

#[tauri::command]
pub fn delete_session(store: State<'_, SessionStore>, session_id: String) -> Result<(), String> {
    store.delete_session(&session_id)
}
