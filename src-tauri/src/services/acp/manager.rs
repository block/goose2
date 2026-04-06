mod dispatcher;
mod session_ops;

use std::collections::{HashMap, HashSet};
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
use session_ops::{
    cancel_session_inner, prepare_session_inner, send_prompt_inner, ManagerState,
    PrepareSessionInput,
};

enum ManagerCommand {
    ListProviders {
        response: oneshot::Sender<Result<Vec<GooseAcpProvider>, String>>,
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
}

fn run_manager_thread(
    app_handle: tauri::AppHandle,
    mut command_rx: mpsc::UnboundedReceiver<ManagerCommand>,
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

        let state = Arc::new(Mutex::new(ManagerState {
            sessions: HashMap::new(),
            op_locks: HashMap::new(),
            pending_cancels: HashSet::new(),
            preparing_sessions: HashSet::new(),
        }));

        while let Some(command) = command_rx.recv().await {
            match command {
                ManagerCommand::ListProviders { response } => {
                    let connection = Arc::clone(&connection);
                    tokio::task::spawn_local(async move {
                        let result = async {
                            let params = RawValue::from_string("{}".to_string())
                                .map_err(|error| format!("Failed to build ACP request body: {error}"))?;
                            let response_value = connection
                                .ext_method(ExtRequest::new("goose/providers/list", params.into()))
                                .await
                                .map_err(|error| {
                                    format!("Failed to list providers via Goose ACP: {error:?}")
                                })?;
                            let parsed: GooseProvidersResponse =
                                serde_json::from_str(response_value.0.get()).map_err(|error| {
                                    format!("Failed to decode Goose provider list: {error}")
                                })?;
                            Ok::<_, String>(parsed.providers)
                        }
                        .await;
                        let _ = response.send(result);
                    });
                }
                ManagerCommand::PrepareSession {
                    composite_key,
                    local_session_id,
                    provider_id,
                    working_dir,
                    existing_agent_session_id,
                    response,
                } => {
                    let connection = Arc::clone(&connection);
                    let dispatcher = dispatcher.clone();
                    let state = Arc::clone(&state);
                    tokio::task::spawn_local(async move {
                        let result = prepare_session_inner(
                            &connection,
                            &dispatcher,
                            &state,
                            PrepareSessionInput {
                                composite_key,
                                local_session_id,
                                provider_id,
                                working_dir,
                                existing_agent_session_id,
                            },
                        )
                        .await
                        .map(|_| ());
                        let _ = response.send(result);
                    });
                }
                ManagerCommand::SendPrompt {
                    composite_key,
                    local_session_id,
                    provider_id,
                    working_dir,
                    existing_agent_session_id,
                    writer,
                    prompt,
                    images,
                    response,
                } => {
                    let connection = Arc::clone(&connection);
                    let dispatcher = dispatcher.clone();
                    let state = Arc::clone(&state);
                    tokio::task::spawn_local(async move {
                        let result = send_prompt_inner(
                            &connection,
                            &dispatcher,
                            &state,
                            composite_key,
                            local_session_id,
                            provider_id,
                            working_dir,
                            existing_agent_session_id,
                            writer,
                            prompt,
                            images,
                        )
                        .await;
                        let _ = response.send(result);
                    });
                }
                ManagerCommand::CancelSession {
                    composite_key,
                    response,
                } => {
                    let connection = Arc::clone(&connection);
                    let dispatcher = dispatcher.clone();
                    let state = Arc::clone(&state);
                    tokio::task::spawn_local(async move {
                        let result =
                            cancel_session_inner(&connection, &dispatcher, &state, &composite_key)
                                .await;
                        let _ = response.send(result);
                    });
                }
            }
        }
    });
}
