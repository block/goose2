use serde::Serialize;
use std::sync::Arc;
use tauri::{AppHandle, State};

use crate::services::acp::{AcpRunningSession, AcpService, AcpSessionRegistry};
use crate::services::sessions::SessionStore;
use acp_client::discover_providers;

/// Response type for an ACP provider, sent to the frontend.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpProviderResponse {
    id: String,
    label: String,
}

/// Discover all locally available ACP providers.
#[tauri::command]
pub async fn discover_acp_providers() -> Vec<AcpProviderResponse> {
    discover_providers()
        .into_iter()
        .map(|p| AcpProviderResponse {
            id: p.id,
            label: p.label,
        })
        .collect()
}

/// Send a prompt to an ACP agent and stream the response via Tauri events.
///
/// The actual content arrives asynchronously through `acp:text`, `acp:tool_call`,
/// `acp:tool_result`, and `acp:done` events.
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn acp_send_message(
    app_handle: AppHandle,
    registry: State<'_, Arc<AcpSessionRegistry>>,
    session_store: State<'_, Arc<SessionStore>>,
    session_id: String,
    provider_id: String,
    prompt: String,
    system_prompt: Option<String>,
    working_dir: Option<String>,
) -> Result<(), String> {
    let working_dir = working_dir
        .map(|dir| dir.trim().to_string())
        .filter(|dir| !dir.is_empty())
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("/tmp")));

    AcpService::send_prompt(
        app_handle,
        Arc::clone(&registry),
        Arc::clone(&session_store),
        session_id,
        provider_id,
        prompt,
        working_dir,
        system_prompt,
    )
    .await
}

/// Cancel a running ACP session.
#[tauri::command]
pub async fn acp_cancel_session(
    registry: State<'_, Arc<AcpSessionRegistry>>,
    session_id: String,
) -> Result<bool, String> {
    Ok(registry.cancel(&session_id))
}

/// List all currently running ACP sessions.
#[tauri::command]
pub async fn acp_list_running(
    registry: State<'_, Arc<AcpSessionRegistry>>,
) -> Result<Vec<AcpRunningSession>, String> {
    Ok(registry.list_running())
}

/// Cancel all running ACP sessions (used during shutdown).
#[tauri::command]
pub async fn acp_cancel_all(registry: State<'_, Arc<AcpSessionRegistry>>) -> Result<(), String> {
    registry.cancel_all();
    Ok(())
}
