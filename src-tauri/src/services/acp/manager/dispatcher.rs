use std::collections::HashMap;
use std::sync::Arc;

use acp_client::MessageWriter;
use agent_client_protocol::{
    Client, ContentBlock as AcpContentBlock, PermissionOptionId, RequestPermissionOutcome,
    RequestPermissionRequest, RequestPermissionResponse, SelectedPermissionOutcome,
    SessionConfigKind, SessionConfigOption, SessionConfigOptionCategory,
    SessionConfigSelectOptions, SessionInfoUpdate, SessionModelState, SessionNotification,
    SessionUpdate,
};
use async_trait::async_trait;
use tauri::Emitter;
use tokio::sync::Mutex;

use crate::services::acp::payloads::{ModelStatePayload, SessionInfoPayload};

#[derive(Clone)]
pub(super) struct SessionRoute {
    pub(super) local_session_id: String,
    pub(super) writer: Option<Arc<dyn MessageWriter>>,
    pub(super) canceled: bool,
}

pub(super) struct SessionEventDispatcher {
    app_handle: tauri::AppHandle,
    routes: Arc<Mutex<HashMap<String, SessionRoute>>>,
}

impl SessionEventDispatcher {
    pub(super) fn new(
        app_handle: tauri::AppHandle,
        routes: Arc<Mutex<HashMap<String, SessionRoute>>>,
    ) -> Self {
        Self { app_handle, routes }
    }

    pub(super) async fn bind_session(&self, goose_session_id: &str, local_session_id: &str) {
        let mut routes = self.routes.lock().await;
        routes
            .entry(goose_session_id.to_string())
            .and_modify(|route| route.local_session_id = local_session_id.to_string())
            .or_insert_with(|| SessionRoute {
                local_session_id: local_session_id.to_string(),
                writer: None,
                canceled: false,
            });
    }

    pub(super) async fn attach_writer(
        &self,
        goose_session_id: &str,
        local_session_id: &str,
        writer: Arc<dyn MessageWriter>,
    ) {
        let mut routes = self.routes.lock().await;
        routes.insert(
            goose_session_id.to_string(),
            SessionRoute {
                local_session_id: local_session_id.to_string(),
                writer: Some(writer),
                canceled: false,
            },
        );
    }

    pub(super) async fn clear_writer(&self, goose_session_id: &str) {
        let mut routes = self.routes.lock().await;
        if let Some(route) = routes.get_mut(goose_session_id) {
            route.writer = None;
            route.canceled = false;
        }
    }

    pub(super) async fn mark_canceled(&self, goose_session_id: &str) -> bool {
        let mut routes = self.routes.lock().await;
        if let Some(route) = routes.get_mut(goose_session_id) {
            let had_writer = route.writer.is_some();
            route.writer = None;
            route.canceled = had_writer;
            return had_writer;
        }
        false
    }

    pub(super) async fn is_canceled(&self, goose_session_id: &str) -> bool {
        let routes = self.routes.lock().await;
        routes
            .get(goose_session_id)
            .is_some_and(|route| route.canceled)
    }

    pub(super) fn emit_session_info(&self, local_session_id: &str, info: &SessionInfoUpdate) {
        let _ = self.app_handle.emit(
            "acp:session_info",
            SessionInfoPayload {
                session_id: local_session_id.to_string(),
                title: info.title.value().cloned(),
            },
        );
    }

    pub(super) fn emit_model_state(&self, local_session_id: &str, state: &SessionModelState) {
        let current_model_name = state
            .available_models
            .iter()
            .find(|model| model.model_id == state.current_model_id)
            .map(|model| model.name.clone());
        let _ = self.app_handle.emit(
            "acp:model_state",
            ModelStatePayload {
                session_id: local_session_id.to_string(),
                current_model_id: state.current_model_id.to_string(),
                current_model_name,
            },
        );
    }

    pub(super) fn emit_model_state_from_options(
        &self,
        local_session_id: &str,
        options: &[SessionConfigOption],
    ) {
        let Some(option) = options
            .iter()
            .find(|option| option.category == Some(SessionConfigOptionCategory::Model))
        else {
            return;
        };

        let SessionConfigKind::Select(select) = &option.kind else {
            return;
        };
        let current_model_id = select.current_value.to_string();
        let current_model_name = match &select.options {
            SessionConfigSelectOptions::Ungrouped(values) => values
                .iter()
                .find(|value| value.value == select.current_value)
                .map(|value| value.name.clone()),
            SessionConfigSelectOptions::Grouped(groups) => groups
                .iter()
                .flat_map(|group| group.options.iter())
                .find(|value| value.value == select.current_value)
                .map(|value| value.name.clone()),
            _ => None,
        };

        let _ = self.app_handle.emit(
            "acp:model_state",
            ModelStatePayload {
                session_id: local_session_id.to_string(),
                current_model_id,
                current_model_name,
            },
        );
    }
}

fn extract_content_preview(content: &[agent_client_protocol::ToolCallContent]) -> Option<String> {
    for item in content {
        match item {
            agent_client_protocol::ToolCallContent::Content(content_item) => {
                if let AcpContentBlock::Text(text) = &content_item.content {
                    let preview: String = text.text.chars().take(500).collect();
                    return Some(if text.text.len() > 500 {
                        format!("{preview}…")
                    } else {
                        preview
                    });
                }
            }
            agent_client_protocol::ToolCallContent::Diff(diff) => {
                return Some(format!(
                    "{}{}",
                    diff.path.display(),
                    if diff.old_text.is_some() {
                        " (modified)"
                    } else {
                        " (new)"
                    }
                ));
            }
            agent_client_protocol::ToolCallContent::Terminal(terminal) => {
                return Some(format!("Terminal: {}", terminal.terminal_id.0));
            }
            _ => {}
        }
    }

    None
}

#[async_trait(?Send)]
impl Client for SessionEventDispatcher {
    async fn request_permission(
        &self,
        args: RequestPermissionRequest,
    ) -> agent_client_protocol::Result<RequestPermissionResponse> {
        let option_id = args
            .options
            .first()
            .map(|option| option.option_id.clone())
            .unwrap_or_else(|| PermissionOptionId::new("approve"));

        Ok(RequestPermissionResponse::new(
            RequestPermissionOutcome::Selected(SelectedPermissionOutcome::new(option_id)),
        ))
    }

    async fn session_notification(
        &self,
        notification: SessionNotification,
    ) -> agent_client_protocol::Result<()> {
        let goose_session_id = notification.session_id.to_string();
        let route = {
            let routes = self.routes.lock().await;
            routes.get(&goose_session_id).cloned()
        };

        let Some(route) = route else {
            return Ok(());
        };

        match &notification.update {
            SessionUpdate::SessionInfoUpdate(info) => {
                self.emit_session_info(&route.local_session_id, info);
                return Ok(());
            }
            SessionUpdate::ConfigOptionUpdate(update) => {
                self.emit_model_state_from_options(&route.local_session_id, &update.config_options);
                return Ok(());
            }
            _ => {}
        }

        let Some(writer) = route.writer else {
            return Ok(());
        };

        match &notification.update {
            SessionUpdate::AgentMessageChunk(chunk) => {
                if let AcpContentBlock::Text(text) = &chunk.content {
                    writer.append_text(&text.text).await;
                }
            }
            SessionUpdate::ToolCall(tool_call) => {
                writer
                    .record_tool_call(&tool_call.tool_call_id.0, &tool_call.title)
                    .await;
            }
            SessionUpdate::ToolCallUpdate(update) => {
                if let Some(title) = &update.fields.title {
                    writer
                        .update_tool_call_title(&update.tool_call_id.0, title)
                        .await;
                }
                if let Some(content) = &update.fields.content {
                    if let Some(result) = extract_content_preview(content) {
                        writer.record_tool_result(&result).await;
                    }
                }
            }
            _ => {}
        }

        Ok(())
    }
}
