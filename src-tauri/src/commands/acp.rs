use serde::Serialize;
use tauri::AppHandle;

use acp_client::discover_providers;
use crate::services::acp::AcpService;

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
#[tauri::command]
pub async fn acp_send_message(
    app_handle: AppHandle,
    session_id: String,
    provider_id: String,
    prompt: String,
) -> Result<(), String> {
    let working_dir = dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("/tmp"));

    AcpService::send_prompt(app_handle, session_id, provider_id, prompt, working_dir).await
}
