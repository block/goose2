mod command_dispatch;
mod dispatcher;
mod session_ops;

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use acp_client::MessageWriter;
use agent_client_protocol::{
    Agent, ClientSideConnection, ExtRequest, Implementation, InitializeRequest, ProtocolVersion,
};
use futures::{SinkExt, StreamExt};
use serde::Deserialize;
use serde_json::value::RawValue;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::{mpsc, oneshot, Mutex, OnceCell};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;
use tokio_util::compat::{TokioAsyncReadCompatExt, TokioAsyncWriteCompatExt};

use super::goose_serve::{GooseServeProcess, WS_BRIDGE_BUFFER_BYTES};
use dispatcher::{SessionEventDispatcher, SessionRoute};
pub use session_ops::AcpSessionInfo;

enum ManagerCommand {
    ListProviders {
        response: oneshot::Sender<Result<Vec<GooseAcpProvider>, String>>,
    },
    ListSessions {
        response: oneshot::Sender<Result<Vec<AcpSessionInfo>, String>>,
    },
    LoadSession {
        local_session_id: String,
        goose_session_id: String,
        working_dir: PathBuf,
        response: oneshot::Sender<Result<(), String>>,
    },
    PrepareSession {
        composite_key: String,
        local_session_id: String,
        provider_id: String,
        working_dir: PathBuf,
        existing_agent_session_id: Option<String>,
        response: oneshot::Sender<Result<(), String>>,
    },
    SendPrompt {
        composite_key: String,
        local_session_id: String,
        provider_id: String,
        working_dir: PathBuf,
        existing_agent_session_id: Option<String>,
        writer: Arc<dyn MessageWriter>,
        prompt: String,
        images: Vec<(String, String)>,
        response: oneshot::Sender<Result<(), String>>,
    },
    CancelSession {
        composite_key: String,
        response: oneshot::Sender<Result<bool, String>>,
    },
    ExportSession {
        session_id: String,
        response: oneshot::Sender<Result<String, String>>,
    },
    ImportSession {
        json: String,
        response: oneshot::Sender<Result<AcpSessionInfo, String>>,
    },
    ForkSession {
        session_id: String,
        response: oneshot::Sender<Result<AcpSessionInfo, String>>,
    },
}

pub struct GooseAcpManager {
    command_tx: mpsc::UnboundedSender<ManagerCommand>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct GooseAcpProvider {
    pub id: String,
    pub label: String,
}

#[derive(Debug, Deserialize)]
struct GooseProvidersResponse {
    providers: Vec<GooseAcpProvider>,
}

static GOOSE_ACP_MANAGER: OnceCell<Arc<GooseAcpManager>> = OnceCell::const_new();

impl GooseAcpManager {
    pub async fn start(app_handle: tauri::AppHandle) -> Result<Arc<Self>, String> {
        GOOSE_ACP_MANAGER
            .get_or_try_init(|| async move {
                let (command_tx, command_rx) = mpsc::unbounded_channel();
                let manager = Arc::new(Self { command_tx });
                let (ready_tx, ready_rx) = oneshot::channel();

                std::thread::Builder::new()
                    .name("goose-acp-manager".to_string())
                    .spawn(move || run_manager_thread(app_handle, command_rx, ready_tx))
                    .map_err(|error| {
                        format!("Failed to spawn Goose ACP manager thread: {error}")
                    })?;

                ready_rx
                    .await
                    .map_err(|_| "Goose ACP manager failed before initialization".to_string())??;

                Ok(manager)
            })
            .await
            .map(Arc::clone)
    }

    pub async fn list_sessions(&self) -> Result<Vec<AcpSessionInfo>, String> {
        let (response_tx, response_rx) = oneshot::channel();
        self.command_tx
            .send(ManagerCommand::ListSessions {
                response: response_tx,
            })
            .map_err(|_| "Goose ACP manager is unavailable".to_string())?;
        response_rx
            .await
            .map_err(|_| "Goose ACP manager dropped list sessions request".to_string())?
    }

    pub async fn load_session(
        &self,
        local_session_id: String,
        goose_session_id: String,
        working_dir: PathBuf,
    ) -> Result<(), String> {
        let (response_tx, response_rx) = oneshot::channel();
        self.command_tx
            .send(ManagerCommand::LoadSession {
                local_session_id,
                goose_session_id,
                working_dir,
                response: response_tx,
            })
            .map_err(|_| "Goose ACP manager is unavailable".to_string())?;
        response_rx
            .await
            .map_err(|_| "Goose ACP manager dropped load session request".to_string())?
    }

    pub async fn prepare_session(
        &self,
        composite_key: String,
        local_session_id: String,
        provider_id: String,
        working_dir: PathBuf,
        existing_agent_session_id: Option<String>,
    ) -> Result<(), String> {
        let (response_tx, response_rx) = oneshot::channel();
        self.command_tx
            .send(ManagerCommand::PrepareSession {
                composite_key,
                local_session_id,
                provider_id,
                working_dir,
                existing_agent_session_id,
                response: response_tx,
            })
            .map_err(|_| "Goose ACP manager is unavailable".to_string())?;
        response_rx
            .await
            .map_err(|_| "Goose ACP manager dropped prepare request".to_string())?
    }

    pub async fn list_providers(&self) -> Result<Vec<GooseAcpProvider>, String> {
        let (response_tx, response_rx) = oneshot::channel();
        self.command_tx
            .send(ManagerCommand::ListProviders {
                response: response_tx,
            })
            .map_err(|_| "Goose ACP manager is unavailable".to_string())?;
        response_rx
            .await
            .map_err(|_| "Goose ACP manager dropped provider discovery request".to_string())?
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn send_prompt(
        &self,
        composite_key: String,
        local_session_id: String,
        provider_id: String,
        working_dir: PathBuf,
        existing_agent_session_id: Option<String>,
        writer: Arc<dyn MessageWriter>,
        prompt: String,
        images: Vec<(String, String)>,
    ) -> Result<(), String> {
        let (response_tx, response_rx) = oneshot::channel();
        self.command_tx
            .send(ManagerCommand::SendPrompt {
                composite_key,
                local_session_id,
                provider_id,
                working_dir,
                existing_agent_session_id,
                writer,
                prompt,
                images,
                response: response_tx,
            })
            .map_err(|_| "Goose ACP manager is unavailable".to_string())?;
        response_rx
            .await
            .map_err(|_| "Goose ACP manager dropped prompt request".to_string())?
    }

    pub async fn cancel_session(&self, composite_key: String) -> Result<bool, String> {
        let (response_tx, response_rx) = oneshot::channel();
        self.command_tx
            .send(ManagerCommand::CancelSession {
                composite_key,
                response: response_tx,
            })
            .map_err(|_| "Goose ACP manager is unavailable".to_string())?;
        response_rx
            .await
            .map_err(|_| "Goose ACP manager dropped cancel request".to_string())?
    }

    /// Export a session as JSON via the goose binary.
    pub async fn export_session(&self, session_id: String) -> Result<String, String> {
        let (response_tx, response_rx) = oneshot::channel();
        self.command_tx
            .send(ManagerCommand::ExportSession {
                session_id,
                response: response_tx,
            })
            .map_err(|_| "Goose ACP manager is unavailable".to_string())?;
        response_rx
            .await
            .map_err(|_| "Goose ACP manager dropped export session request".to_string())?
    }

    /// Import a session from JSON via the goose binary.
    pub async fn import_session(&self, json: String) -> Result<AcpSessionInfo, String> {
        let (response_tx, response_rx) = oneshot::channel();
        self.command_tx
            .send(ManagerCommand::ImportSession {
                json,
                response: response_tx,
            })
            .map_err(|_| "Goose ACP manager is unavailable".to_string())?;
        response_rx
            .await
            .map_err(|_| "Goose ACP manager dropped import session request".to_string())?
    }

    /// Fork (duplicate) a session via the goose binary.
    pub async fn fork_session(&self, session_id: String) -> Result<AcpSessionInfo, String> {
        let (response_tx, response_rx) = oneshot::channel();
        self.command_tx
            .send(ManagerCommand::ForkSession {
                session_id,
                response: response_tx,
            })
            .map_err(|_| "Goose ACP manager is unavailable".to_string())?;
        response_rx
            .await
            .map_err(|_| "Goose ACP manager dropped fork session request".to_string())?
    }
}

/// Call a goose ext_method and return the raw JSON response string.
async fn call_ext_method(
    connection: &Arc<ClientSideConnection>,
    method: &str,
    params_json: serde_json::Value,
) -> Result<String, String> {
    let params = RawValue::from_string(params_json.to_string())
        .map_err(|e| format!("Failed to build {method} request: {e}"))?;
    let resp = connection
        .ext_method(ExtRequest::new(method, params.into()))
        .await
        .map_err(|e| format!("{method} failed via Goose ACP: {e:?}"))?;
    Ok(resp.0.get().to_string())
}

fn run_manager_thread(
    app_handle: tauri::AppHandle,
    command_rx: mpsc::UnboundedReceiver<ManagerCommand>,
    ready_tx: oneshot::Sender<Result<(), String>>,
) {
    let runtime = match tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
    {
        Ok(runtime) => runtime,
        Err(error) => {
            let _ = ready_tx.send(Err(format!(
                "Failed to build Goose ACP manager runtime: {error}"
            )));
            return;
        }
    };

    let local = tokio::task::LocalSet::new();
    local.block_on(&runtime, async move {
        let setup_result = async {
            GooseServeProcess::start().await?;
            let process = GooseServeProcess::get()?;
            let ws_stream = connect_async(process.ws_url())
                .await
                .map(|(stream, _)| stream)
                .map_err(|error| format!("Failed to connect to goose serve: {error}"))?;

            let (mut ws_writer, mut ws_reader) = ws_stream.split();
            let (connection_outgoing, bridge_outgoing_reader) =
                tokio::io::duplex(WS_BRIDGE_BUFFER_BYTES);
            let (bridge_incoming_writer, connection_incoming) =
                tokio::io::duplex(WS_BRIDGE_BUFFER_BYTES);

            tokio::task::spawn_local(async move {
                let mut reader = BufReader::new(bridge_outgoing_reader);
                let mut line = String::new();

                loop {
                    line.clear();
                    let bytes_read = match reader.read_line(&mut line).await {
                        Ok(bytes_read) => bytes_read,
                        Err(error) => {
                            log::error!("Failed to read ACP output for Goose WebSocket: {error}");
                            break;
                        }
                    };
                    if bytes_read == 0 {
                        break;
                    }

                    let payload = line.trim_end_matches(['\r', '\n']);
                    if payload.is_empty() {
                        continue;
                    }

                    if let Err(error) = ws_writer.send(Message::Text(payload.to_string())).await {
                        log::error!("Failed to write Goose WebSocket frame: {error}");
                        break;
                    }
                }

                let _ = ws_writer.close().await;
            });

            tokio::task::spawn_local(async move {
                let mut writer = bridge_incoming_writer;

                while let Some(message) = ws_reader.next().await {
                    match message {
                        Ok(Message::Text(text)) => {
                            if let Err(error) = writer.write_all(text.as_bytes()).await {
                                log::error!(
                                    "Failed to forward Goose WebSocket payload to ACP client: {error}"
                                );
                                break;
                            }
                            if let Err(error) = writer.write_all(b"\n").await {
                                log::error!(
                                    "Failed to delimit Goose WebSocket payload for ACP client: {error}"
                                );
                                break;
                            }
                            if let Err(error) = writer.flush().await {
                                log::error!("Failed to flush Goose WebSocket payload: {error}");
                                break;
                            }
                        }
                        Ok(Message::Close(_)) => break,
                        Ok(Message::Binary(_))
                        | Ok(Message::Ping(_))
                        | Ok(Message::Pong(_))
                        | Ok(Message::Frame(_)) => {}
                        Err(error) => {
                            log::error!("Goose WebSocket read failed: {error}");
                            break;
                        }
                    }
                }

                let _ = writer.shutdown().await;
            });

            let routes = Arc::new(Mutex::new(HashMap::<String, SessionRoute>::new()));
            let dispatcher = Arc::new(SessionEventDispatcher::new(
                app_handle.clone(),
                Arc::clone(&routes),
            ));
            let (connection, io_future) = ClientSideConnection::new(
                dispatcher.clone(),
                connection_outgoing.compat_write(),
                connection_incoming.compat(),
                |future| {
                    tokio::task::spawn_local(future);
                },
            );
            let connection = Arc::new(connection);

            tokio::task::spawn_local(async move {
                if let Err(error) = io_future.await {
                    log::error!("Goose ACP IO error: {error:?}");
                }
            });

            connection
                .initialize(
                    InitializeRequest::new(ProtocolVersion::LATEST)
                        .client_info(Implementation::new("goose2", env!("CARGO_PKG_VERSION"))),
                )
                .await
                .map_err(|error| format!("Goose ACP initialize failed: {error:?}"))?;

            Ok::<_, String>((connection, dispatcher))
        }
        .await;

        let (connection, dispatcher) = match setup_result {
            Ok(parts) => {
                let _ = ready_tx.send(Ok(()));
                parts
            }
            Err(error) => {
                let _ = ready_tx.send(Err(error));
                return;
            }
        };

        command_dispatch::dispatch_commands(command_rx, connection, dispatcher).await;
    });
}
