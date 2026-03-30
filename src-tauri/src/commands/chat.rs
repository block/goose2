use crate::services::sessions::SessionStore;
use crate::types::messages::*;
use tauri::State;

#[tauri::command]
pub async fn chat_send_message(
    session_store: State<'_, SessionStore>,
    session_id: String,
    message: Message,
) -> Result<Message, String> {
    // 1. Store the user message
    session_store.add_message(&session_id, message.clone())?;

    // 2. TODO: Connect to goosed via HTTP/SSE for real inference
    // For now, return a mock assistant response
    let response = Message {
        id: uuid::Uuid::new_v4().to_string(),
        role: MessageRole::Assistant,
        created: chrono::Utc::now().timestamp_millis(),
        content: vec![MessageContent::Text {
            text: "I'm Goose, your AI coding assistant. The chat backend is being set up — real inference coming soon! For now, I can confirm the message pipeline is working end-to-end.".to_string(),
        }],
        metadata: None,
    };

    session_store.add_message(&session_id, response.clone())?;
    Ok(response)
}
