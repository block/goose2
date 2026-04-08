use serde::Serialize;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, State};

use crate::services::acp::{
    make_composite_key, AcpRunningSession, AcpService, AcpSessionInfo, AcpSessionRegistry,
    GooseAcpManager,
};
use crate::services::session_db;

const DEPRECATED_PROVIDER_IDS: &[&str] = &["claude-code", "codex", "gemini-cli"];

/// Response type for an ACP provider, sent to the frontend.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpProviderResponse {
    id: String,
    label: String,
}

fn should_include_provider(provider_id: &str) -> bool {
    !DEPRECATED_PROVIDER_IDS.contains(&provider_id)
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
            "Failed to resolve working directory '{}': {error}",
            working_dir.display()
        )
    })
}

async fn resolve_exportable_session_id(
    app_handle: &AppHandle,
    session_id: &str,
    persona_id: Option<&str>,
) -> Result<String, String> {
    let db_path = session_db::session_db_path()?;
    if session_db::read_session(&db_path, session_id).is_ok() {
        return Ok(session_id.to_string());
    }

    let manager = GooseAcpManager::start(app_handle.clone()).await?;
    let session_lookup_key = make_composite_key(session_id, persona_id);
    manager
        .resolve_session_id(session_lookup_key)
        .await?
        .ok_or_else(|| format!("Session '{session_id}' not found in sessions or threads"))
}

/// Return the list of providers available through goose serve.
#[tauri::command]
pub async fn discover_acp_providers(
    app_handle: AppHandle,
) -> Result<Vec<AcpProviderResponse>, String> {
    let manager = GooseAcpManager::start(app_handle).await?;
    let providers = manager.list_providers().await?;
    Ok(providers
        .into_iter()
        .filter(|provider| should_include_provider(&provider.id))
        .map(|provider| AcpProviderResponse {
            id: provider.id,
            label: provider.label,
        })
        .collect())
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

#[tauri::command]
pub async fn acp_prepare_session(
    app_handle: AppHandle,
    session_id: String,
    provider_id: String,
    working_dir: Option<String>,
    persona_id: Option<String>,
) -> Result<(), String> {
    let current_dir = std::env::current_dir()
        .map_err(|error| format!("Failed to determine current working directory: {error}"))?;
    let working_dir = resolve_working_dir(working_dir, &current_dir)?;

    AcpService::prepare_session(app_handle, session_id, provider_id, working_dir, persona_id).await
}

/// List all sessions known to the goose binary.
#[tauri::command]
pub async fn acp_list_sessions(app_handle: AppHandle) -> Result<Vec<AcpSessionInfo>, String> {
    let manager = GooseAcpManager::start(app_handle).await?;
    let mut sessions = manager.list_sessions().await?;

    if let Ok(db_path) = session_db::session_db_path() {
        if let Ok(counts) = session_db::thread_message_counts(&db_path) {
            for session in &mut sessions {
                session.message_count = counts.get(&session.session_id).copied().unwrap_or(0);
            }
        }
    }

    Ok(sessions)
}

/// Load an existing session, replaying its messages as Tauri events.
///
/// The goose binary sends `SessionNotification` events for each message in
/// the session history. The frontend's `useAcpStream` hook picks these up
/// the same way it handles live streaming.
#[tauri::command]
pub async fn acp_load_session(
    app_handle: AppHandle,
    session_id: String,
    goose_session_id: String,
    working_dir: Option<String>,
) -> Result<(), String> {
    let current_dir = std::env::current_dir()
        .map_err(|error| format!("Failed to determine current working directory: {error}"))?;
    let working_dir = resolve_working_dir(working_dir, &current_dir)?;
    let db_path = session_db::session_db_path()?;
    session_db::backfill_thread_messages_if_missing(&db_path, &goose_session_id)?;

    let manager = GooseAcpManager::start(app_handle).await?;
    manager
        .load_session(session_id, goose_session_id, working_dir)
        .await
}

#[cfg(test)]
mod tests {
    use super::{expand_home_dir, resolve_working_dir, should_include_provider};
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
        let resolved = resolve_working_dir(Some("missing".to_string()), temp_dir.path())
            .expect("resolve path");

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
    fn provider_discovery_hides_deprecated_cli_providers() {
        assert!(!should_include_provider("claude-code"));
        assert!(!should_include_provider("codex"));
        assert!(!should_include_provider("gemini-cli"));
        assert!(should_include_provider("goose"));
        assert!(should_include_provider("claude-acp"));
        assert!(should_include_provider("codex-acp"));
    }
}

/// Cancel a running ACP session.
///
/// When `persona_id` is provided the composite key `{session_id}__{persona_id}`
/// is used so only that persona's stream is cancelled.
#[tauri::command]
pub async fn acp_cancel_session(
    app_handle: AppHandle,
    registry: State<'_, Arc<AcpSessionRegistry>>,
    session_id: String,
    persona_id: Option<String>,
) -> Result<bool, String> {
    let key = make_composite_key(&session_id, persona_id.as_deref());
    let _assistant_message_id = registry.cancel(&key);
    let manager = GooseAcpManager::start(app_handle).await?;
    let was_cancelled = manager.cancel_session(key).await?;

    Ok(was_cancelled)
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

/// Export a session as JSON from the goose session database.
///
/// Returns an OG-goose-compatible JSON string with a `conversation` field
/// containing all messages.
#[tauri::command]
pub async fn acp_export_session(
    app_handle: AppHandle,
    session_id: String,
    persona_id: Option<String>,
) -> Result<String, String> {
    let db_path = session_db::session_db_path()?;
    let resolved_session_id =
        resolve_exportable_session_id(&app_handle, &session_id, persona_id.as_deref()).await?;
    let (row, messages) = session_db::read_session(&db_path, &resolved_session_id)?;
    let exported = session_db::to_exported_session(&row, &messages);
    serde_json::to_string_pretty(&exported).map_err(|e| format!("Failed to serialize session: {e}"))
}

/// Import a session from JSON into the goose session database.
///
/// Hybrid approach: creates the session via ACP (so the goose binary
/// registers it in memory), then populates messages via direct SQLite.
#[tauri::command]
pub async fn acp_import_session(
    app_handle: AppHandle,
    json: String,
) -> Result<AcpSessionInfo, String> {
    let db_path = session_db::session_db_path()?;
    let exported = session_db::parse_import_json(&json)?;
    let title = exported
        .name
        .clone()
        .unwrap_or_else(|| "Imported Session".to_string());

    // 1. Create session via ACP so the binary knows about it
    let working_dir = resolve_working_dir(
        exported.working_dir.clone(),
        &std::env::current_dir().unwrap_or_default(),
    )?;
    let manager = GooseAcpManager::start(app_handle).await?;
    let goose_session_id = manager.create_session(working_dir).await?;

    // 2. Find the DB id for this new session (binary wrote it to SQLite)
    let db_id = session_db::db_id_for_thread(&db_path, &goose_session_id)?;

    // 3. Insert messages via SQLite
    session_db::insert_messages(&db_path, &db_id, &goose_session_id, &exported.conversation)?;

    // 4. Update session name
    session_db::update_session_name(&db_path, &db_id, &title)?;

    let now = chrono::Utc::now().to_rfc3339();
    Ok(AcpSessionInfo {
        session_id: goose_session_id,
        title: Some(title),
        updated_at: Some(now),
        message_count: exported.conversation.len(),
    })
}

/// Duplicate a session in the goose session database.
///
/// Hybrid approach: reads source session, creates new session via ACP,
/// then copies messages via direct SQLite.
#[tauri::command]
pub async fn acp_duplicate_session(
    app_handle: AppHandle,
    session_id: String,
    persona_id: Option<String>,
) -> Result<AcpSessionInfo, String> {
    let db_path = session_db::session_db_path()?;
    let resolved_session_id =
        resolve_exportable_session_id(&app_handle, &session_id, persona_id.as_deref()).await?;

    // 1. Read the source session's messages
    let (source_row, source_messages) = session_db::read_session(&db_path, &resolved_session_id)?;
    let exported = session_db::to_exported_session(&source_row, &source_messages);
    let source_name = source_row.name.unwrap_or_else(|| "Session".to_string());
    let copy_name = format!("Copy of {}", source_name);

    // 2. Create new session via ACP
    let working_dir = resolve_working_dir(
        exported.working_dir.clone(),
        &std::env::current_dir().unwrap_or_default(),
    )?;
    let manager = GooseAcpManager::start(app_handle).await?;
    let goose_session_id = manager.create_session(working_dir).await?;

    // 3. Find the DB id and populate messages
    let db_id = session_db::db_id_for_thread(&db_path, &goose_session_id)?;
    session_db::insert_messages(&db_path, &db_id, &goose_session_id, &exported.conversation)?;
    session_db::update_session_name(&db_path, &db_id, &copy_name)?;

    let now = chrono::Utc::now().to_rfc3339();
    Ok(AcpSessionInfo {
        session_id: goose_session_id,
        title: Some(copy_name),
        updated_at: Some(now),
        message_count: exported.conversation.len(),
    })
}
