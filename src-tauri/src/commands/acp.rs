use serde::Serialize;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, State};

use crate::services::acp::{make_composite_key, AcpRunningSession, AcpService, AcpSessionRegistry};
use crate::services::sessions::SessionStore;
use acp_client::discover_providers;

/// Response type for an ACP provider, sent to the frontend.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpProviderResponse {
    id: String,
    label: String,
}

fn default_artifacts_working_dir() -> PathBuf {
    if let Some(home_dir) = dirs::home_dir() {
        return home_dir.join(".goose").join("artifacts");
    }
    PathBuf::from("/tmp").join(".goose").join("artifacts")
}

fn expand_home_dir(path: PathBuf) -> PathBuf {
    let path_string = path.to_string_lossy();

    if path_string == "~" {
        return dirs::home_dir().unwrap_or(path);
    }

    if let Some(stripped) = path_string
        .strip_prefix("~/")
        .or_else(|| path_string.strip_prefix("~\\"))
    {
        if let Some(home_dir) = dirs::home_dir() {
            return home_dir.join(stripped);
        }
    }

    path
}

fn resolve_working_dir(
    working_dir: Option<String>,
    current_dir: &std::path::Path,
) -> Result<PathBuf, String> {
    let working_dir = working_dir
        .map(|dir| dir.trim().to_string())
        .filter(|dir| !dir.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(default_artifacts_working_dir);
    let working_dir = expand_home_dir(working_dir);

    let working_dir = if working_dir.is_relative() {
        current_dir.join(&working_dir)
    } else {
        working_dir
    };

    std::fs::create_dir_all(&working_dir).map_err(|error| {
        format!(
            "Failed to create working directory '{}': {error}",
            working_dir.display()
        )
    })?;

    std::fs::canonicalize(&working_dir).map_err(|error| {
        format!(
            "Working directory '{}' does not exist or is not accessible: {error}",
            working_dir.display()
        )
    })
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
    persona_id: Option<String>,
    persona_name: Option<String>,
    images: Vec<(String, String)>,
) -> Result<(), String> {
    let current_dir = std::env::current_dir()
        .map_err(|error| format!("Failed to determine current working directory: {error}"))?;
    let working_dir = resolve_working_dir(working_dir, &current_dir)?;

    AcpService::send_prompt(
        app_handle,
        Arc::clone(&registry),
        Arc::clone(&session_store),
        session_id,
        provider_id,
        prompt,
        working_dir,
        system_prompt,
        persona_id,
        persona_name,
        images,
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::{expand_home_dir, resolve_working_dir};
    use std::path::PathBuf;

    #[test]
    fn resolve_working_dir_returns_absolute_path_for_existing_relative_directory() {
        let temp_dir = tempfile::tempdir().expect("temp dir");
        let nested_dir = temp_dir.path().join("nested");
        std::fs::create_dir(&nested_dir).expect("create nested dir");

        let resolved =
            resolve_working_dir(Some("nested".to_string()), temp_dir.path()).expect("resolve path");

        assert!(resolved.is_absolute());
        assert_eq!(
            resolved,
            std::fs::canonicalize(&nested_dir).expect("canonical nested dir")
        );
    }

    #[test]
    fn resolve_working_dir_creates_missing_directory() {
        let temp_dir = tempfile::tempdir().expect("temp dir");
        let missing_dir = temp_dir.path().join("missing");
        let resolved =
            resolve_working_dir(Some("missing".to_string()), temp_dir.path()).expect("resolve path");

        assert!(missing_dir.exists());
        assert_eq!(
            resolved,
            std::fs::canonicalize(&missing_dir).expect("canonical missing dir")
        );
    }

    #[test]
    fn expand_home_dir_replaces_leading_tilde() {
        let home_dir = dirs::home_dir().expect("home dir");

        assert_eq!(expand_home_dir(PathBuf::from("~")), home_dir);
        assert_eq!(
            expand_home_dir(PathBuf::from("~/Code/goose2")),
            home_dir.join("Code/goose2")
        );
    }

    #[test]
    fn resolve_working_dir_accepts_tilde_prefixed_path() {
        let home_dir = dirs::home_dir().expect("home dir");
        let target_dir = home_dir.join(".goose");
        let resolved =
            resolve_working_dir(Some("~/.goose".to_string()), std::path::Path::new("/tmp"))
                .expect("resolve path");

        assert_eq!(
            resolved,
            std::fs::canonicalize(target_dir).expect("canonical home dir path")
        );
    }
}

/// Cancel a running ACP session.
///
/// When `persona_id` is provided the composite key `{session_id}__{persona_id}`
/// is used so only that persona's stream is cancelled.
#[tauri::command]
pub async fn acp_cancel_session(
    registry: State<'_, Arc<AcpSessionRegistry>>,
    session_id: String,
    persona_id: Option<String>,
) -> Result<bool, String> {
    let key = make_composite_key(&session_id, persona_id.as_deref());
    Ok(registry.cancel(&key))
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
