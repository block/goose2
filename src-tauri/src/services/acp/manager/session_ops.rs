use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::Arc;

use acp_client::{MessageWriter, Store};
use agent_client_protocol::{
    Agent, CancelNotification, ClientSideConnection, ContentBlock as AcpContentBlock, ImageContent,
    LoadSessionRequest, NewSessionRequest, PromptRequest, SessionConfigKind, SessionConfigOption,
    SessionConfigSelectOptions, SetSessionConfigOptionRequest, TextContent,
};
use tokio::sync::Mutex;

use super::dispatcher::SessionEventDispatcher;

#[derive(Clone)]
pub(super) struct PreparedSession {
    goose_session_id: String,
    provider_id: String,
    working_dir: PathBuf,
}

pub(super) struct ManagerState {
    pub(super) sessions: HashMap<String, PreparedSession>,
    pub(super) op_locks: HashMap<String, Arc<Mutex<()>>>,
    pub(super) pending_cancels: HashSet<String>,
    pub(super) preparing_sessions: HashSet<String>,
}

impl ManagerState {
    pub(super) fn session_lock(&mut self, composite_key: &str) -> Arc<Mutex<()>> {
        self.op_locks
            .entry(composite_key.to_string())
            .or_insert_with(|| Arc::new(Mutex::new(())))
            .clone()
    }

    pub(super) fn mark_cancel_requested(&mut self, composite_key: &str) {
        self.pending_cancels.insert(composite_key.to_string());
    }

    pub(super) fn take_cancel_requested(&mut self, composite_key: &str) -> bool {
        self.pending_cancels.remove(composite_key)
    }
}

fn extract_current_select_value(
    options: &[SessionConfigOption],
    option_id: &str,
) -> Option<String> {
    let option = options
        .iter()
        .find(|candidate| candidate.id.0.as_ref() == option_id)?;
    let SessionConfigKind::Select(select) = &option.kind else {
        return None;
    };

    let current_value = select.current_value.to_string();
    match &select.options {
        SessionConfigSelectOptions::Ungrouped(values) => values
            .iter()
            .any(|value| value.value == select.current_value)
            .then_some(current_value),
        SessionConfigSelectOptions::Grouped(groups) => groups
            .iter()
            .flat_map(|group| group.options.iter())
            .any(|value| value.value == select.current_value)
            .then_some(current_value),
        _ => Some(current_value),
    }
}

fn needs_provider_update(current_provider_id: Option<&str>, requested_provider_id: &str) -> bool {
    current_provider_id != Some(requested_provider_id)
}

pub(super) struct PrepareSessionInput {
    pub(super) composite_key: String,
    pub(super) local_session_id: String,
    pub(super) provider_id: String,
    pub(super) working_dir: PathBuf,
    pub(super) existing_agent_session_id: Option<String>,
    pub(super) store: Arc<dyn Store>,
}

pub(super) async fn prepare_session_inner(
    connection: &Arc<ClientSideConnection>,
    dispatcher: &Arc<SessionEventDispatcher>,
    state: &Arc<Mutex<ManagerState>>,
    input: PrepareSessionInput,
) -> Result<String, String> {
    let PrepareSessionInput {
        composite_key,
        local_session_id,
        provider_id,
        working_dir,
        existing_agent_session_id,
        store,
    } = input;

    let session_lock = {
        let mut guard = state.lock().await;
        guard.session_lock(&composite_key)
    };
    let _lock_guard = session_lock.lock().await;

    {
        let mut guard = state.lock().await;
        guard.preparing_sessions.insert(composite_key.clone());
    }

    let prepare_result: Result<(String, Option<PreparedSession>), String> = async {
        let existing_prepared = {
            let guard = state.lock().await;
            guard.sessions.get(&composite_key).cloned()
        };

        if let Some(prepared) = existing_prepared {
            dispatcher
                .bind_session(&prepared.goose_session_id, &local_session_id)
                .await;

            if prepared.working_dir != working_dir {
                let response = connection
                    .load_session(LoadSessionRequest::new(
                        prepared.goose_session_id.clone(),
                        working_dir.clone(),
                    ))
                    .await
                    .map_err(|error| format!("Failed to load Goose session: {error:?}"))?;
                if let Some(models) = &response.models {
                    dispatcher.emit_model_state(&local_session_id, models);
                }
                if let Some(options) = &response.config_options {
                    dispatcher.emit_model_state_from_options(&local_session_id, options);
                }

                let mut guard = state.lock().await;
                if let Some(session) = guard.sessions.get_mut(&composite_key) {
                    session.working_dir = working_dir.clone();
                }
            }

            if needs_provider_update(Some(&prepared.provider_id), &provider_id) {
                let response = connection
                    .set_session_config_option(SetSessionConfigOptionRequest::new(
                        prepared.goose_session_id.clone(),
                        "provider",
                        provider_id.as_str(),
                    ))
                    .await
                    .map_err(|error| {
                        format!("Failed to update provider via Goose ACP: {error:?}")
                    })?;
                dispatcher
                    .emit_model_state_from_options(&local_session_id, &response.config_options);

                let mut guard = state.lock().await;
                if let Some(session) = guard.sessions.get_mut(&composite_key) {
                    session.provider_id = provider_id.clone();
                }
            }

            return Ok((prepared.goose_session_id, None));
        }

        let goose_session_id = if let Some(existing_id) = existing_agent_session_id {
            dispatcher
                .bind_session(&existing_id, &local_session_id)
                .await;

            let response = connection
                .load_session(LoadSessionRequest::new(
                    existing_id.clone(),
                    working_dir.clone(),
                ))
                .await
                .map_err(|error| format!("Failed to load Goose session: {error:?}"))?;

            if let Some(models) = &response.models {
                dispatcher.emit_model_state(&local_session_id, models);
            }
            if let Some(options) = &response.config_options {
                dispatcher.emit_model_state_from_options(&local_session_id, options);
            }

            let loaded_provider_id = response
                .config_options
                .as_deref()
                .and_then(|options| extract_current_select_value(options, "provider"));
            if needs_provider_update(loaded_provider_id.as_deref(), &provider_id) {
                let response = connection
                    .set_session_config_option(SetSessionConfigOptionRequest::new(
                        existing_id.clone(),
                        "provider",
                        provider_id.as_str(),
                    ))
                    .await
                    .map_err(|error| {
                        format!("Failed to update provider via Goose ACP: {error:?}")
                    })?;
                dispatcher
                    .emit_model_state_from_options(&local_session_id, &response.config_options);
            }

            existing_id
        } else {
            let mut request = NewSessionRequest::new(working_dir.clone());
            if provider_id != "goose" {
                let mut meta = serde_json::Map::new();
                meta.insert(
                    "provider".into(),
                    serde_json::Value::String(provider_id.clone()),
                );
                request = request.meta(meta);
            }

            let response = connection
                .new_session(request)
                .await
                .map_err(|error| format!("Failed to create Goose session: {error:?}"))?;

            let new_id = response.session_id.to_string();
            store
                .set_agent_session_id(&local_session_id, &new_id)
                .map_err(|error| format!("Failed to save Goose session ID: {error}"))?;

            dispatcher.bind_session(&new_id, &local_session_id).await;

            if let Some(models) = &response.models {
                dispatcher.emit_model_state(&local_session_id, models);
            }
            if let Some(options) = &response.config_options {
                dispatcher.emit_model_state_from_options(&local_session_id, options);
            }

            new_id
        };

        Ok((
            goose_session_id.clone(),
            Some(PreparedSession {
                goose_session_id,
                provider_id,
                working_dir,
            }),
        ))
    }
    .await;

    {
        let mut guard = state.lock().await;
        guard.preparing_sessions.remove(&composite_key);
    }

    let (goose_session_id, prepared_session) = prepare_result?;

    if let Some(prepared_session) = prepared_session {
        let mut guard = state.lock().await;
        guard.sessions.insert(composite_key, prepared_session);
    }

    Ok(goose_session_id)
}

async fn take_cancel_requested(state: &Arc<Mutex<ManagerState>>, composite_key: &str) -> bool {
    let mut guard = state.lock().await;
    guard.take_cancel_requested(composite_key)
}

async fn clear_cancel_requested(state: &Arc<Mutex<ManagerState>>, composite_key: &str) {
    let mut guard = state.lock().await;
    guard.pending_cancels.remove(composite_key);
}

#[allow(clippy::too_many_arguments)]
pub(super) async fn send_prompt_inner(
    connection: &Arc<ClientSideConnection>,
    dispatcher: &Arc<SessionEventDispatcher>,
    state: &Arc<Mutex<ManagerState>>,
    composite_key: String,
    local_session_id: String,
    provider_id: String,
    working_dir: PathBuf,
    existing_agent_session_id: Option<String>,
    store: Arc<dyn Store>,
    writer: Arc<dyn MessageWriter>,
    prompt: String,
    images: Vec<(String, String)>,
) -> Result<(), String> {
    let goose_session_id = match prepare_session_inner(
        connection,
        dispatcher,
        state,
        PrepareSessionInput {
            composite_key: composite_key.clone(),
            local_session_id: local_session_id.clone(),
            provider_id,
            working_dir,
            existing_agent_session_id,
            store,
        },
    )
    .await
    {
        Ok(goose_session_id) => goose_session_id,
        Err(error) => {
            clear_cancel_requested(state, &composite_key).await;
            return Err(error);
        }
    };

    if take_cancel_requested(state, &composite_key).await {
        return Ok(());
    }

    dispatcher
        .attach_writer(&goose_session_id, &local_session_id, writer.clone())
        .await;

    if dispatcher.is_canceled(&goose_session_id).await
        || take_cancel_requested(state, &composite_key).await
    {
        dispatcher.clear_writer(&goose_session_id).await;
        return Ok(());
    }

    let mut content_blocks = vec![AcpContentBlock::Text(TextContent::new(prompt))];
    for (data, mime_type) in &images {
        content_blocks.push(AcpContentBlock::Image(ImageContent::new(
            data.as_str(),
            mime_type.as_str(),
        )));
    }

    let result = connection
        .prompt(PromptRequest::new(goose_session_id.clone(), content_blocks))
        .await
        .map(|_| ())
        .map_err(|error| format!("Prompt failed via Goose ACP: {error:?}"));

    let canceled = dispatcher.is_canceled(&goose_session_id).await;
    dispatcher.clear_writer(&goose_session_id).await;
    clear_cancel_requested(state, &composite_key).await;

    if result.is_ok() && !canceled {
        writer.finalize().await;
    }

    result
}

pub(super) async fn cancel_session_inner(
    connection: &Arc<ClientSideConnection>,
    dispatcher: &Arc<SessionEventDispatcher>,
    state: &Arc<Mutex<ManagerState>>,
    composite_key: &str,
) -> Result<bool, String> {
    let (goose_session_id, is_preparing) = {
        let mut guard = state.lock().await;
        let goose_session_id = guard
            .sessions
            .get(composite_key)
            .map(|session| session.goose_session_id.clone());
        let is_preparing = guard.preparing_sessions.contains(composite_key);
        if goose_session_id.is_some() || is_preparing {
            guard.mark_cancel_requested(composite_key);
        }
        (goose_session_id, is_preparing)
    };

    let Some(goose_session_id) = goose_session_id else {
        return Ok(is_preparing);
    };

    let had_writer = dispatcher.mark_canceled(&goose_session_id).await;
    if !had_writer {
        return Ok(true);
    }

    connection
        .cancel(CancelNotification::new(goose_session_id))
        .await
        .map_err(|error| format!("Failed to cancel Goose ACP session: {error:?}"))?;

    Ok(true)
}

#[cfg(test)]
mod tests {
    use std::collections::{HashMap, HashSet};

    use super::{needs_provider_update, ManagerState};

    #[test]
    fn provider_update_detects_switch_back_to_goose() {
        assert!(needs_provider_update(Some("openai"), "goose"));
        assert!(needs_provider_update(Some("claude-acp"), "goose"));
        assert!(!needs_provider_update(Some("goose"), "goose"));
        assert!(needs_provider_update(None, "goose"));
    }

    #[test]
    fn pending_cancel_is_consumed_once() {
        let mut state = ManagerState {
            sessions: HashMap::new(),
            op_locks: HashMap::new(),
            pending_cancels: HashSet::new(),
            preparing_sessions: HashSet::new(),
        };

        state.mark_cancel_requested("session-1");

        assert!(state.take_cancel_requested("session-1"));
        assert!(!state.take_cancel_requested("session-1"));
    }
}
