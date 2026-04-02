use agent_client_protocol::{
    Agent, Client, ClientSideConnection, Error as AcpError, Implementation, InitializeRequest,
    LoadSessionRequest, NewSessionRequest, ProtocolVersion, RequestPermissionRequest,
    RequestPermissionResponse, Result as AcpResult, SessionConfigKind, SessionConfigOption,
    SessionConfigOptionCategory, SessionConfigSelectOptions, SessionModelState,
    SessionNotification, SetSessionConfigOptionRequest, SetSessionModelRequest,
};
use async_trait::async_trait;
use serde::Serialize;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use tauri::{AppHandle, State};
use tokio::process::Command;
use tokio_util::compat::{TokioAsyncReadCompatExt, TokioAsyncWriteCompatExt};

use crate::services::acp::{
    make_composite_key, AcpRunningSession, AcpService, AcpSessionRegistry, TauriStore,
};
use crate::services::sessions::SessionStore;
use crate::types::messages::{
    MessageCompletionStatus, MessageContent, MessageMetadata, ToolCallStatus,
};
use acp_client::{discover_providers, find_acp_agent_by_id};

/// Response type for an ACP provider, sent to the frontend.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpProviderResponse {
    id: String,
    label: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpAvailableModelResponse {
    id: String,
    name: String,
    description: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpModelStateResponse {
    source: String,
    config_id: Option<String>,
    current_model_id: String,
    current_model_name: Option<String>,
    available_models: Vec<AcpAvailableModelResponse>,
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

struct NoopAcpClient;

#[async_trait(?Send)]
impl Client for NoopAcpClient {
    async fn request_permission(
        &self,
        _args: RequestPermissionRequest,
    ) -> AcpResult<RequestPermissionResponse> {
        Err(AcpError::method_not_found())
    }

    async fn session_notification(&self, _args: SessionNotification) -> AcpResult<()> {
        Ok(())
    }
}

async fn run_acp_set_model(
    working_dir: PathBuf,
    provider_id: String,
    agent_session_id: String,
    model_id: String,
    source: String,
    config_id: Option<String>,
) -> Result<(), String> {
    let provider = find_acp_agent_by_id(&provider_id)
        .ok_or_else(|| format!("Unknown or unavailable agent provider: {provider_id}"))?;

    let mut child = Command::new(&provider.binary_path)
        .args(&provider.acp_args)
        .current_dir(&working_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .map_err(|error| {
            format!(
                "Failed to spawn {} (binary: {}, cwd: {}): {error}",
                provider.label,
                provider.binary_path.display(),
                working_dir.display()
            )
        })?;

    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Failed to open ACP stdin".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to open ACP stdout".to_string())?;

    let (connection, io_future) = ClientSideConnection::new(
        NoopAcpClient,
        stdin.compat_write(),
        stdout.compat(),
        |future| {
            tokio::task::spawn_local(future);
        },
    );

    tokio::task::spawn_local(async move {
        if let Err(error) = io_future.await {
            log::error!("ACP IO error during set_model: {error:?}");
        }
    });

    let init_request = InitializeRequest::new(ProtocolVersion::LATEST)
        .client_info(Implementation::new("goose2", env!("CARGO_PKG_VERSION")));
    let init_response = connection
        .initialize(init_request)
        .await
        .map_err(|error| format!("ACP init failed: {error:?}"))?;

    if !init_response.agent_capabilities.load_session {
        return Err("Agent does not support load_session".to_string());
    }

    connection
        .load_session(LoadSessionRequest::new(
            agent_session_id.clone(),
            working_dir.clone(),
        ))
        .await
        .map_err(|error| format!("Failed to load ACP session: {error:?}"))?;

    match source.as_str() {
        "config_option" => {
            let config_id = config_id.ok_or_else(|| {
                "Missing config option ID for config-option-backed model selection".to_string()
            })?;

            connection
                .set_session_config_option(SetSessionConfigOptionRequest::new(
                    agent_session_id,
                    config_id,
                    model_id.as_str(),
                ))
                .await
                .map_err(|error| format!("Failed to set ACP session config option: {error:?}"))?;
        }
        _ => {
            connection
                .set_session_model(SetSessionModelRequest::new(agent_session_id, model_id))
                .await
                .map_err(|error| format!("Failed to set ACP session model: {error:?}"))?;
        }
    }

    let _ = child.start_kill();
    let _ = child.wait().await;

    Ok(())
}

fn model_state_from_session_models(
    model_state: SessionModelState,
) -> Option<AcpModelStateResponse> {
    if model_state.available_models.is_empty() {
        return None;
    }

    let current_model_name = model_state
        .available_models
        .iter()
        .find(|model| model.model_id == model_state.current_model_id)
        .map(|model| model.name.clone());
    let available_models = model_state
        .available_models
        .into_iter()
        .map(|model| AcpAvailableModelResponse {
            id: model.model_id.to_string(),
            name: model.name,
            description: model.description,
        })
        .collect();

    Some(AcpModelStateResponse {
        source: "session_model".to_string(),
        config_id: None,
        current_model_id: model_state.current_model_id.to_string(),
        current_model_name,
        available_models,
    })
}

fn model_state_from_config_options(
    config_options: Vec<SessionConfigOption>,
) -> Option<AcpModelStateResponse> {
    let option = config_options
        .into_iter()
        .find(|option| matches!(option.category, Some(SessionConfigOptionCategory::Model)))?;
    let config_id = option.id.to_string();
    let option_name = option.name.clone();

    let select = match option.kind {
        SessionConfigKind::Select(select) => select,
        #[allow(unreachable_patterns)]
        _ => return None,
    };

    let current_model_id = select.current_value.to_string();
    let available_models = match select.options {
        SessionConfigSelectOptions::Ungrouped(options) => options
            .into_iter()
            .map(|model| AcpAvailableModelResponse {
                id: model.value.to_string(),
                name: model.name,
                description: model.description,
            })
            .collect::<Vec<_>>(),
        SessionConfigSelectOptions::Grouped(groups) => groups
            .into_iter()
            .flat_map(|group| group.options.into_iter())
            .map(|model| AcpAvailableModelResponse {
                id: model.value.to_string(),
                name: model.name,
                description: model.description,
            })
            .collect::<Vec<_>>(),
        _ => return None,
    };
    let current_model_name = available_models
        .iter()
        .find(|model| model.id == current_model_id)
        .map(|model| model.name.clone())
        .or(Some(option_name));

    Some(AcpModelStateResponse {
        source: "config_option".to_string(),
        config_id: Some(config_id),
        current_model_id,
        current_model_name,
        available_models,
    })
}

fn normalize_model_state(
    models: Option<SessionModelState>,
    config_options: Option<Vec<SessionConfigOption>>,
) -> Result<AcpModelStateResponse, String> {
    if let Some(model_state) = models.and_then(model_state_from_session_models) {
        return Ok(model_state);
    }

    if let Some(model_state) = config_options.and_then(model_state_from_config_options) {
        return Ok(model_state);
    }

    Err("ACP session did not return model options".to_string())
}

async fn run_acp_get_model_state(
    working_dir: PathBuf,
    _session_id: String,
    provider_id: String,
    tauri_store: TauriStore,
) -> Result<AcpModelStateResponse, String> {
    let provider = find_acp_agent_by_id(&provider_id)
        .ok_or_else(|| format!("Unknown or unavailable agent provider: {provider_id}"))?;

    let mut child = Command::new(&provider.binary_path)
        .args(&provider.acp_args)
        .current_dir(&working_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .map_err(|error| {
            format!(
                "Failed to spawn {} (binary: {}, cwd: {}): {error}",
                provider.label,
                provider.binary_path.display(),
                working_dir.display()
            )
        })?;

    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Failed to open ACP stdin".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to open ACP stdout".to_string())?;

    let (connection, io_future) = ClientSideConnection::new(
        NoopAcpClient,
        stdin.compat_write(),
        stdout.compat(),
        |future| {
            tokio::task::spawn_local(future);
        },
    );

    tokio::task::spawn_local(async move {
        if let Err(error) = io_future.await {
            log::error!("ACP IO error during model bootstrap: {error:?}");
        }
    });

    let result = async {
        let init_request = InitializeRequest::new(ProtocolVersion::LATEST)
            .client_info(Implementation::new("goose2", env!("CARGO_PKG_VERSION")));
        let init_response = connection
            .initialize(init_request)
            .await
            .map_err(|error| format!("ACP init failed: {error:?}"))?;

        // Try to load an existing session. If the stored session ID is stale
        // (e.g. provider was restarted), fall back to creating a new session.
        let mut loaded = None;
        if let Some(agent_session_id) = tauri_store.get_agent_session_id() {
            if init_response.agent_capabilities.load_session {
                match connection
                    .load_session(LoadSessionRequest::new(
                        agent_session_id.clone(),
                        working_dir.clone(),
                    ))
                    .await
                {
                    Ok(session_response) => {
                        loaded = Some(session_response);
                    }
                    Err(error) => {
                        log::warn!(
                            "Failed to load ACP session {agent_session_id}, \
                             falling back to new session: {error:?}"
                        );
                    }
                }
            }
        }

        if let Some(session_response) = loaded {
            normalize_model_state(session_response.models, session_response.config_options)
        } else {
            let session_response = connection
                .new_session(NewSessionRequest::new(working_dir.clone()))
                .await
                .map_err(|error| format!("Failed to create ACP session: {error:?}"))?;

            // Do NOT save the agent session ID here. This bootstrap process is
            // throwaway — it will be killed after we read the model state. The
            // real send path (driver.run) creates its own session and persists
            // the ID via the Store trait. Saving here causes the send path to
            // find a stale ID from a dead process and fail with "Resource not found".

            normalize_model_state(session_response.models, session_response.config_options)
        }
    }
    .await;

    let _ = child.start_kill();
    let _ = child.wait().await;

    result
}

#[tauri::command]
pub async fn acp_get_model_state(
    session_store: State<'_, Arc<SessionStore>>,
    session_id: String,
    provider_id: String,
    persona_id: Option<String>,
    working_dir: Option<String>,
    persist_session: Option<bool>,
) -> Result<AcpModelStateResponse, String> {
    let current_dir = std::env::current_dir()
        .map_err(|error| format!("Failed to determine current working directory: {error}"))?;
    let working_dir = resolve_working_dir(working_dir, &current_dir)?;

    if persist_session.unwrap_or(true) {
        session_store.ensure_session(&session_id, Some(provider_id.clone()));
    }
    let tauri_store = TauriStore::with_provider(
        Arc::clone(&session_store),
        session_id.clone(),
        persona_id.clone(),
        Some(provider_id.clone()),
    );

    tokio::task::spawn_blocking(move || {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .map_err(|error| format!("Failed to build tokio runtime: {error}"))?;
        let local = tokio::task::LocalSet::new();

        local.block_on(&runtime, async move {
            run_acp_get_model_state(working_dir, session_id, provider_id, tauri_store).await
        })
    })
    .await
    .map_err(|error| format!("ACP model bootstrap task panicked: {error}"))?
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn acp_set_model(
    session_store: State<'_, Arc<SessionStore>>,
    session_id: String,
    provider_id: String,
    model_id: String,
    source: String,
    config_id: Option<String>,
    persona_id: Option<String>,
    working_dir: Option<String>,
) -> Result<(), String> {
    let current_dir = std::env::current_dir()
        .map_err(|error| format!("Failed to determine current working directory: {error}"))?;
    let working_dir = resolve_working_dir(working_dir, &current_dir)?;
    let tauri_store = TauriStore::with_provider(
        Arc::clone(&session_store),
        session_id.clone(),
        persona_id.clone(),
        Some(provider_id.clone()),
    );
    let agent_session_id = tauri_store.get_agent_session_id().ok_or_else(|| {
        let key = make_composite_key(&session_id, persona_id.as_deref());
        format!("No ACP session found for '{key}'. Send a message first before changing models.")
    })?;

    tokio::task::spawn_blocking(move || {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .map_err(|error| format!("Failed to build tokio runtime: {error}"))?;
        let local = tokio::task::LocalSet::new();

        local.block_on(&runtime, async move {
            run_acp_set_model(
                working_dir,
                provider_id,
                agent_session_id,
                model_id,
                source,
                config_id,
            )
            .await
        })
    })
    .await
    .map_err(|error| format!("ACP set_model task panicked: {error}"))?
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
}

/// Cancel a running ACP session.
///
/// When `persona_id` is provided the composite key `{session_id}__{persona_id}`
/// is used so only that persona's stream is cancelled.
#[tauri::command]
pub async fn acp_cancel_session(
    registry: State<'_, Arc<AcpSessionRegistry>>,
    session_store: State<'_, Arc<SessionStore>>,
    session_id: String,
    persona_id: Option<String>,
) -> Result<bool, String> {
    let key = make_composite_key(&session_id, persona_id.as_deref());
    let assistant_message_id = registry.cancel(&key);

    if let Some(message_id) = assistant_message_id.as_deref() {
        let _ = session_store.update_message(&session_id, message_id, |message| {
            for block in &mut message.content {
                if let MessageContent::ToolRequest { status, .. } = block {
                    *status = ToolCallStatus::Stopped;
                }
            }

            let metadata = message
                .metadata
                .get_or_insert_with(MessageMetadata::default);
            metadata.completion_status = Some(MessageCompletionStatus::Stopped);
        });
    }

    Ok(assistant_message_id.is_some())
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
