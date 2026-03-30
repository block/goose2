//! Full-featured ACP driver for session management and streaming.
//!
//! This module provides the complete ACP integration including:
//! - Session initialization and resumption
//! - Streaming text and tool calls
//! - Permission handling
//! - Cancellation support

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use std::time::{Duration, Instant};

use agent_client_protocol::{
    Agent, ClientSideConnection, ContentBlock as AcpContentBlock, ImageContent, Implementation,
    InitializeRequest, LoadSessionRequest, McpServer, NewSessionRequest, PermissionOptionId,
    PromptRequest, ProtocolVersion, RequestPermissionOutcome, RequestPermissionRequest,
    RequestPermissionResponse, SelectedPermissionOutcome, SessionNotification, SessionUpdate,
    TextContent,
};
use async_trait::async_trait;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt};
use tokio::process::Command;
use tokio::sync::Mutex;
use tokio_util::compat::{TokioAsyncReadCompatExt, TokioAsyncWriteCompatExt};
use tokio_util::sync::CancellationToken;

// =============================================================================
// Public traits and types
// =============================================================================

/// Protocol-agnostic message writer — streams agent output.
///
/// This trait allows different storage backends (database, in-memory, etc.)
/// to receive streaming agent output without coupling to the ACP protocol.
#[async_trait]
pub trait MessageWriter: Send + Sync {
    /// Append a text chunk to the current assistant message.
    async fn append_text(&self, text: &str);

    /// Flush all buffered text and close the current message block.
    async fn finalize(&self);

    /// Record a tool call with its ID and title.
    async fn record_tool_call(&self, tool_call_id: &str, title: &str);

    /// Update a previously recorded tool call's title.
    async fn update_tool_call_title(&self, tool_call_id: &str, title: &str);

    /// Record the result/output of a tool call.
    async fn record_tool_result(&self, content: &str);
}

/// Storage interface for persisting agent session data.
///
/// This trait abstracts the storage backend, allowing different implementations
/// (SQLite, PostgreSQL, in-memory, etc.) without changing the driver logic.
#[async_trait]
pub trait Store: Send + Sync {
    /// Save the agent's session ID for resumption.
    fn set_agent_session_id(&self, session_id: &str, agent_session_id: &str) -> Result<(), String>;

    /// Retrieve existing session messages as `(role, content)` pairs.
    ///
    /// Used during session resumption to match replayed notifications
    /// against previously persisted messages.  The default implementation
    /// returns an empty list, which is correct for stores that do not
    /// support message persistence (e.g. `NoOpStore`).
    fn get_session_messages(&self, _session_id: &str) -> Result<Vec<(String, String)>, String> {
        Ok(vec![])
    }
}

/// Everything needed to run one turn of an agent.
///
/// Implementors own the protocol details (spawning a process, connecting,
/// sending the prompt, translating streaming events into [`MessageWriter`]
/// calls).
#[async_trait(?Send)]
#[allow(clippy::too_many_arguments)]
pub trait AgentDriver {
    /// Run a single turn: send `prompt`, stream results via `writer`.
    ///
    /// `images` contains `(base64_data, mime_type)` pairs that are sent as
    /// `ContentBlock::Image` entries alongside the text prompt.
    async fn run(
        &self,
        session_id: &str,
        prompt: &str,
        images: &[(String, String)],
        working_dir: &Path,
        store: &Arc<dyn Store>,
        writer: &Arc<dyn MessageWriter>,
        cancel_token: &CancellationToken,
        agent_session_id: Option<&str>,
    ) -> Result<(), String>;
}

// =============================================================================
// AcpDriver — the main driver implementation
// =============================================================================

/// The main ACP driver for spawning and communicating with ACP agents.
///
/// Handles session lifecycle, streaming notifications, permission handling,
/// and MCP server injection.
pub struct AcpDriver {
    binary_path: PathBuf,
    acp_args: Vec<String>,
    agent_label: String,
    /// Extra environment variables to pass to the agent process.
    extra_env: Vec<(String, String)>,
    /// MCP servers to inject into the session via NewSessionRequest.
    mcp_servers: Vec<McpServer>,
}

const ACP_SETUP_TIMEOUT: Duration = Duration::from_secs(90);

impl AcpDriver {
    /// Create a driver for the given provider ID (e.g. "goose", "claude").
    ///
    /// Looks up the agent in `KNOWN_AGENTS`, locates the binary on disk,
    /// and returns a ready-to-use driver.
    pub fn new(provider_id: &str) -> Result<Self, String> {
        crate::types::find_acp_agent_by_id(provider_id)
            .map(|agent| Self {
                binary_path: agent.binary_path,
                acp_args: agent.acp_args,
                agent_label: agent.label,
                extra_env: Vec::new(),
                mcp_servers: Vec::new(),
            })
            .ok_or_else(|| format!("Unknown or unavailable agent provider: {provider_id}"))
    }

    /// Create a driver for the first available provider.
    pub fn first_available() -> Result<Self, String> {
        crate::types::find_acp_agent()
            .map(|agent| Self {
                binary_path: agent.binary_path,
                acp_args: agent.acp_args,
                agent_label: agent.label,
                extra_env: Vec::new(),
                mcp_servers: Vec::new(),
            })
            .ok_or_else(|| {
                "No ACP agent found. Install Goose, Claude Code, Codex, Pi, or Amp and ensure it's on your PATH."
                    .to_string()
            })
    }

    /// Set extra environment variables to pass to the agent process.
    pub fn with_extra_env(mut self, vars: Vec<(String, String)>) -> Self {
        self.extra_env = vars;
        self
    }

    /// Set MCP servers to inject into the session via `NewSessionRequest` or `LoadSessionRequest`.
    pub fn with_mcp_servers(mut self, servers: Vec<McpServer>) -> Self {
        self.mcp_servers = servers;
        self
    }
}

/// Shell-escape a value by wrapping it in single quotes with interior quotes
/// escaped via the standard `'\''` trick.
fn shell_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', "'\\''"))
}

#[async_trait(?Send)]
impl AgentDriver for AcpDriver {
    async fn run(
        &self,
        session_id: &str,
        prompt: &str,
        images: &[(String, String)],
        working_dir: &Path,
        store: &Arc<dyn Store>,
        writer: &Arc<dyn MessageWriter>,
        cancel_token: &CancellationToken,
        agent_session_id: Option<&str>,
    ) -> Result<(), String> {
        // For local sessions we need Hermit (and similar directory-based shell
        // hooks) to activate before the agent binary runs. We match the
        // approach used by the actions executor: spawn an interactive login
        // shell with `-s` (stdin mode) in the working directory with a clean
        // environment. The shell initialises fully (`.zshrc` installs hooks),
        // `precmd` fires in the working directory (activating Hermit), then we
        // write an `exec <binary>` command to stdin. `exec` replaces the shell
        // with the agent binary so all subsequent stdin/stdout traffic is the
        // JSON-RPC protocol.
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
        let mut cmd = Command::new(&shell);
        cmd.current_dir(working_dir) // start in project dir so precmd sees hermit config
            .env_clear() // clean slate — shell init rebuilds the environment
            .env("HOME", std::env::var("HOME").unwrap_or_default())
            .env("USER", std::env::var("USER").unwrap_or_default())
            .env("SHELL", &shell)
            .arg("-i") // interactive: ensures hooks like precmd/chpwd are installed
            .arg("-l") // login: loads full profile / environment
            .arg("-s"); // read commands from stdin (after init completes)

        cmd.stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .kill_on_drop(true);
        for (k, v) in &self.extra_env {
            cmd.env(k, v);
        }
        let mut child = cmd.spawn().map_err(|e| {
            format!(
                "Failed to spawn {} (binary: {}, cwd: {}): {e}",
                self.agent_label,
                self.binary_path.display(),
                working_dir.display()
            )
        })?;

        let mut stdin = child
            .stdin
            .take()
            .ok_or_else(|| "Failed to get stdin".to_string())?;

        // Write the exec command to stdin. By the time the shell reads from
        // stdin, init is complete and `precmd` has fired in the working
        // directory (activating Hermit). `exec` replaces the shell with the
        // agent binary — from this point on, stdin belongs to the agent's
        // JSON-RPC transport.
        let exec_line = format!(
            "exec {} {}\n",
            shell_quote(&self.binary_path.to_string_lossy()),
            self.acp_args
                .iter()
                .map(|a| shell_quote(a))
                .collect::<Vec<_>>()
                .join(" ")
        );
        stdin
            .write_all(exec_line.as_bytes())
            .await
            .map_err(|e| format!("Failed to write exec command to shell stdin: {e}"))?;
        stdin
            .flush()
            .await
            .map_err(|e| format!("Failed to flush shell stdin: {e}"))?;

        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Failed to get stdout".to_string())?;

        let stdin_compat = stdin.compat_write();

        // Local shell init (.zshrc, plugin banners, Hermit activation) may
        // write to stdout before `exec` replaces the shell. Filter out any
        // non-JSON lines so they don't reach the JSON-RPC parser.
        let (normalized_stdout_writer, normalized_stdout_reader) = tokio::io::duplex(64 * 1024);
        tokio::task::spawn_local(async move {
            if let Err(error) = normalize_local_acp_stdout(stdout, normalized_stdout_writer).await {
                eprintln!("local ACP stdout normalization failed: {error}");
            }
        });
        let stdout_compat = normalized_stdout_reader.compat();

        let is_resuming = agent_session_id.is_some();
        let db_messages = if is_resuming {
            store.get_session_messages(session_id).unwrap_or_else(|e| {
                eprintln!("Failed to load session messages for replay matching: {e}");
                vec![]
            })
        } else {
            vec![]
        };
        let handler = Arc::new(AcpNotificationHandler::new(
            Arc::clone(writer),
            is_resuming,
            db_messages,
        ));
        let handler_for_conn = Arc::clone(&handler);

        let (connection, io_future) =
            ClientSideConnection::new(handler_for_conn, stdin_compat, stdout_compat, |fut| {
                tokio::task::spawn_local(fut);
            });

        tokio::task::spawn_local(async move {
            if let Err(e) = io_future.await {
                eprintln!("ACP IO error: {e:?}");
            }
        });

        let protocol_result = tokio::select! {
            _ = cancel_token.cancelled() => {
                writer.finalize().await;
                return Ok(());
            }
            result = run_acp_protocol(
                &connection, working_dir, prompt, images, store,
                session_id, agent_session_id, &handler, &self.mcp_servers,
            ) => result,
        };

        writer.finalize().await;
        let _ = child.kill().await;

        protocol_result
    }
}

/// Filter local ACP stdout, forwarding only valid JSON lines.
///
/// Local shell initialization (`.zshrc`, Hermit activation, plugin banners)
/// may write non-JSON text to stdout before `exec` replaces the shell with
/// the agent binary. This function reads lines from the child's stdout and
/// only forwards those that parse as valid JSON, discarding everything else.
async fn normalize_local_acp_stdout<R: tokio::io::AsyncRead + Unpin>(
    stdout: R,
    mut writer: tokio::io::DuplexStream,
) -> Result<(), std::io::Error> {
    let mut reader = tokio::io::BufReader::new(stdout);
    let mut line = String::new();

    loop {
        line.clear();
        let bytes_read = reader.read_line(&mut line).await?;
        if bytes_read == 0 {
            break;
        }

        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        if serde_json::from_str::<serde_json::Value>(trimmed).is_ok() {
            writer.write_all(trimmed.as_bytes()).await?;
            writer.write_all(b"\n").await?;
        }
    }

    writer.shutdown().await
}

// =============================================================================
// ACP notification handler — phase-based replay-sync state machine
// =============================================================================

/// The current phase of the notification handler during session resumption.
enum HandlerPhase {
    /// Accumulating replay notifications and matching against DB messages.
    Replaying(ReplayBuffer),
    /// Replay detected as complete; waiting for prompt to be sent.
    /// All notifications are dropped; tool-call IDs are recorded.
    WaitingForPrompt {
        replayed_tool_call_ids: HashSet<String>,
    },
    /// Prompt has been sent; forwarding live notifications to the writer.
    Live {
        replayed_tool_call_ids: HashSet<String>,
    },
}

/// Accumulates replay notifications and matches them against DB messages.
struct ReplayBuffer {
    /// `(role, content)` pairs from the DB, in order.
    db_messages: Vec<(String, String)>,
    /// Index into `db_messages` of the next message to match.
    match_cursor: usize,
    /// Index of the last non-user message in `db_messages`.
    /// When the cursor passes this, replay is considered complete.
    target_index: Option<usize>,
    /// Text accumulated for the current streaming message.
    current_text: String,
    /// Role of the current streaming message (`"user"` or `"assistant"`).
    current_role: Option<String>,
    /// Tool-call IDs observed during replay (used as a safety-net later).
    replayed_tool_call_ids: HashSet<String>,
    /// Timestamp of the last notification received during replay.
    last_notification_at: Instant,
    /// Whether at least one notification has been received.
    received_any: bool,
}

impl ReplayBuffer {
    fn new(db_messages: Vec<(String, String)>) -> Self {
        // Find index of last non-user message.
        let target_index = db_messages
            .iter()
            .enumerate()
            .rev()
            .find(|(_, (role, _))| role != "user")
            .map(|(i, _)| i);

        Self {
            db_messages,
            match_cursor: 0,
            target_index,
            current_text: String::new(),
            current_role: None,
            replayed_tool_call_ids: HashSet::new(),
            last_notification_at: Instant::now(),
            received_any: false,
        }
    }

    /// Finalize the current streaming text and try to match it against DB.
    /// Called when the role transitions (e.g. from assistant text to tool call).
    /// Returns `true` if replay is now considered complete.
    fn finalize_current(&mut self) -> bool {
        if let Some(role) = self.current_role.take() {
            if !self.current_text.is_empty() {
                self.current_text.clear();
                return self.try_match(&role);
            }
        }
        false
    }

    /// Try to match a role against `db_messages[match_cursor]`.
    /// Returns `true` if replay is now considered complete.
    fn try_match(&mut self, role: &str) -> bool {
        if self.match_cursor >= self.db_messages.len() {
            return self.is_complete();
        }

        let (db_role, _) = &self.db_messages[self.match_cursor];

        if role == db_role {
            self.match_cursor += 1;
        }
        // Don't advance cursor on role mismatch.

        self.is_complete()
    }

    /// Returns `true` if the match cursor has passed the target index.
    fn is_complete(&self) -> bool {
        match self.target_index {
            Some(target) => self.match_cursor > target,
            None => true, // No non-user messages → complete immediately
        }
    }
}

struct AcpNotificationHandler {
    writer: Arc<dyn MessageWriter>,
    phase: Mutex<HandlerPhase>,
    /// Signalled when replay matching determines all DB messages have been replayed.
    replay_done: tokio::sync::Notify,
}

impl AcpNotificationHandler {
    fn new(
        writer: Arc<dyn MessageWriter>,
        replaying: bool,
        db_messages: Vec<(String, String)>,
    ) -> Self {
        let phase = if replaying {
            HandlerPhase::Replaying(ReplayBuffer::new(db_messages))
        } else {
            HandlerPhase::Live {
                replayed_tool_call_ids: HashSet::new(),
            }
        };

        Self {
            writer,
            phase: Mutex::new(phase),
            replay_done: tokio::sync::Notify::new(),
        }
    }

    /// Check whether the replay phase has been idle for at least `timeout`.
    /// Returns `false` if not in the Replaying phase or no notification received yet.
    async fn is_replay_idle(&self, timeout: Duration) -> bool {
        let phase = self.phase.lock().await;
        if let HandlerPhase::Replaying(buf) = &*phase {
            buf.received_any && buf.last_notification_at.elapsed() >= timeout
        } else {
            false
        }
    }

    /// Transition from Replaying to WaitingForPrompt.
    /// Extracts the replayed_tool_call_ids from the ReplayBuffer.
    async fn transition_to_waiting_for_prompt(&self) {
        let mut phase = self.phase.lock().await;
        let ids = match &mut *phase {
            HandlerPhase::Replaying(buf) => std::mem::take(&mut buf.replayed_tool_call_ids),
            HandlerPhase::WaitingForPrompt { .. } | HandlerPhase::Live { .. } => return,
        };
        *phase = HandlerPhase::WaitingForPrompt {
            replayed_tool_call_ids: ids,
        };
    }

    /// Transition from WaitingForPrompt (or Replaying) to Live.
    async fn transition_to_live(&self) {
        let mut phase = self.phase.lock().await;
        let ids = match &mut *phase {
            HandlerPhase::WaitingForPrompt {
                replayed_tool_call_ids,
            } => std::mem::take(replayed_tool_call_ids),
            HandlerPhase::Replaying(buf) => std::mem::take(&mut buf.replayed_tool_call_ids),
            HandlerPhase::Live { .. } => return,
        };
        *phase = HandlerPhase::Live {
            replayed_tool_call_ids: ids,
        };
    }
}

#[async_trait(?Send)]
impl agent_client_protocol::Client for AcpNotificationHandler {
    async fn request_permission(
        &self,
        args: RequestPermissionRequest,
    ) -> agent_client_protocol::Result<RequestPermissionResponse> {
        let option_id = args
            .options
            .first()
            .map(|opt| opt.option_id.clone())
            .unwrap_or_else(|| PermissionOptionId::new("approve"));

        Ok(RequestPermissionResponse::new(
            RequestPermissionOutcome::Selected(SelectedPermissionOutcome::new(option_id)),
        ))
    }

    async fn session_notification(
        &self,
        notification: SessionNotification,
    ) -> agent_client_protocol::Result<()> {
        // Determine the action to take under the lock, then drop the lock
        // before calling into the writer to avoid holding it across await points.
        enum LiveAction {
            AppendText(String),
            RecordToolCall {
                id: String,
                title: String,
            },
            ToolCallUpdate {
                id: String,
                title: Option<String>,
                result: Option<String>,
            },
            Ignore,
            Drop,
        }

        let live_action = {
            let mut phase = self.phase.lock().await;

            match &mut *phase {
                // -- Replaying phase: accumulate chunks, match against DB --
                HandlerPhase::Replaying(buf) => {
                    buf.last_notification_at = Instant::now();
                    buf.received_any = true;

                    // Record tool-call IDs for the safety-net.
                    if let Some(id) = notification_tool_call_id(&notification.update) {
                        buf.replayed_tool_call_ids.insert(id);
                    }

                    let completed = match &notification.update {
                        SessionUpdate::AgentMessageChunk(chunk) => {
                            if let AcpContentBlock::Text(text) = &chunk.content {
                                // If switching from non-assistant role, finalize previous.
                                let mut done = false;
                                if buf.current_role.as_deref() != Some("assistant") {
                                    done = buf.finalize_current();
                                    buf.current_role = Some("assistant".to_string());
                                }
                                buf.current_text.push_str(&text.text);
                                done
                            } else {
                                false
                            }
                        }
                        SessionUpdate::UserMessageChunk(chunk) => {
                            if let AcpContentBlock::Text(text) = &chunk.content {
                                let mut done = false;
                                if buf.current_role.as_deref() != Some("user") {
                                    done = buf.finalize_current();
                                    buf.current_role = Some("user".to_string());
                                }
                                buf.current_text.push_str(&text.text);
                                done
                            } else {
                                false
                            }
                        }
                        SessionUpdate::ToolCall(_tc) => {
                            buf.finalize_current();
                            buf.try_match("tool_call")
                        }
                        SessionUpdate::ToolCallUpdate(update) => {
                            if update.fields.content.is_some() {
                                buf.finalize_current();
                                buf.try_match("tool_result")
                            } else {
                                false
                            }
                        }
                        SessionUpdate::AgentThoughtChunk(_) => {
                            // Thinking is not persisted — ignore.
                            false
                        }
                        _ => false,
                    };

                    if completed {
                        self.replay_done.notify_one();
                    }
                    return Ok(());
                }

                // -- WaitingForPrompt phase: drop everything, record tool-call IDs --
                HandlerPhase::WaitingForPrompt {
                    replayed_tool_call_ids,
                } => {
                    if let Some(id) = notification_tool_call_id(&notification.update) {
                        replayed_tool_call_ids.insert(id);
                    }
                    return Ok(());
                }

                // -- Live phase: determine action, then release lock --
                HandlerPhase::Live {
                    replayed_tool_call_ids,
                } => {
                    // Safety net: drop notifications for tool-call IDs seen during replay.
                    if let Some(id) = notification_tool_call_id(&notification.update) {
                        if replayed_tool_call_ids.contains(&id) {
                            return Ok(());
                        }
                    }

                    match &notification.update {
                        SessionUpdate::AgentMessageChunk(chunk) => {
                            if let AcpContentBlock::Text(text) = &chunk.content {
                                LiveAction::AppendText(text.text.clone())
                            } else {
                                LiveAction::Drop
                            }
                        }
                        SessionUpdate::ToolCall(tool_call) => LiveAction::RecordToolCall {
                            id: tool_call.tool_call_id.0.to_string(),
                            title: tool_call.title.clone(),
                        },
                        SessionUpdate::ToolCallUpdate(update) => {
                            let tc_id = update.tool_call_id.0.to_string();
                            let title = update.fields.title.clone();
                            let result = update
                                .fields
                                .content
                                .as_ref()
                                .and_then(|c| extract_content_preview(c));
                            if title.is_some() || result.is_some() {
                                LiveAction::ToolCallUpdate {
                                    id: tc_id,
                                    title,
                                    result,
                                }
                            } else {
                                LiveAction::Drop
                            }
                        }
                        _ => LiveAction::Ignore,
                    }
                }
            }
            // phase lock is dropped here
        };

        // Execute the live action without holding the phase lock.
        match live_action {
            LiveAction::AppendText(text) => {
                self.writer.append_text(&text).await;
            }
            LiveAction::RecordToolCall { id, title } => {
                self.writer.record_tool_call(&id, &title).await;
            }
            LiveAction::ToolCallUpdate { id, title, result } => {
                if let Some(title) = title {
                    self.writer.update_tool_call_title(&id, &title).await;
                }
                if let Some(preview) = result {
                    self.writer.record_tool_result(&preview).await;
                }
            }
            LiveAction::Ignore => {}
            LiveAction::Drop => {}
        }
        Ok(())
    }
}

/// Extract the tool-call ID from a session update, if it carries one.
fn notification_tool_call_id(update: &SessionUpdate) -> Option<String> {
    match update {
        SessionUpdate::ToolCall(tc) => Some(tc.tool_call_id.0.to_string()),
        SessionUpdate::ToolCallUpdate(tcu) => Some(tcu.tool_call_id.0.to_string()),
        _ => None,
    }
}

// =============================================================================
// Protocol helpers
// =============================================================================

#[allow(clippy::too_many_arguments)]
async fn run_acp_protocol(
    connection: &ClientSideConnection,
    working_dir: &Path,
    prompt: &str,
    images: &[(String, String)],
    store: &Arc<dyn Store>,
    our_session_id: &str,
    acp_session_id: Option<&str>,
    handler: &Arc<AcpNotificationHandler>,
    mcp_servers: &[McpServer],
) -> Result<(), String> {
    let agent_session_id = tokio::time::timeout(
        ACP_SETUP_TIMEOUT,
        setup_acp_session(
            connection,
            working_dir,
            store,
            our_session_id,
            acp_session_id,
            mcp_servers,
        ),
    )
    .await
    .map_err(|_| {
        format!(
            "Timed out waiting for ACP protocol startup after {}s",
            ACP_SETUP_TIMEOUT.as_secs()
        )
    })??;

    // If resuming, wait for replay to complete (content match OR idle timeout).
    // An absolute 10s timeout prevents a hang if the server sends zero replay
    // notifications (e.g. the session was garbage-collected).
    if acp_session_id.is_some() {
        let absolute_deadline = tokio::time::Instant::now() + Duration::from_secs(10);
        loop {
            tokio::select! {
                _ = handler.replay_done.notified() => {
                    break;
                }
                _ = tokio::time::sleep_until(absolute_deadline) => {
                    eprintln!("Replay-wait absolute timeout reached (10s) — proceeding");
                    break;
                }
                _ = tokio::time::sleep(Duration::from_millis(100)) => {
                    if handler.is_replay_idle(Duration::from_secs(1)).await {
                        break;
                    }
                }
            }
        }
        handler.transition_to_waiting_for_prompt().await;
    }

    let mut content_blocks = vec![AcpContentBlock::Text(TextContent::new(prompt))];
    for (data, mime_type) in images {
        content_blocks.push(AcpContentBlock::Image(ImageContent::new(
            data.as_str(),
            mime_type.as_str(),
        )));
    }
    let prompt_request = PromptRequest::new(agent_session_id, content_blocks);

    handler.transition_to_live().await;

    connection
        .prompt(prompt_request)
        .await
        .map_err(|e| format!("Prompt failed: {e:?}"))?;

    Ok(())
}

async fn setup_acp_session(
    connection: &ClientSideConnection,
    working_dir: &Path,
    store: &Arc<dyn Store>,
    our_session_id: &str,
    acp_session_id: Option<&str>,
    mcp_servers: &[McpServer],
) -> Result<String, String> {
    let client_info = Implementation::new("acp-client", env!("CARGO_PKG_VERSION"));
    let init_request = InitializeRequest::new(ProtocolVersion::LATEST).client_info(client_info);

    let init_response = connection
        .initialize(init_request)
        .await
        .map_err(|e| format!("ACP init failed: {e:?}"))?;

    if !mcp_servers.is_empty() {
        let mcp_caps = &init_response.agent_capabilities.mcp_capabilities;
        let requires_http = mcp_servers
            .iter()
            .any(|server| matches!(server, McpServer::Http(_)));
        let requires_sse = mcp_servers
            .iter()
            .any(|server| matches!(server, McpServer::Sse(_)));

        if (requires_http && !mcp_caps.http) || (requires_sse && !mcp_caps.sse) {
            return Err(format!(
                "Agent does not support required MCP transports (required: http={}, sse={}; agent: http={}, sse={}). Select a provider with MCP support for project tools.",
                requires_http,
                requires_sse,
                mcp_caps.http,
                mcp_caps.sse
            ));
        }
    }

    match acp_session_id {
        Some(existing_id) => {
            if !init_response.agent_capabilities.load_session {
                return Err(
                    "Agent does not support load_session — cannot resume conversation".to_string(),
                );
            }

            connection
                .load_session(
                    LoadSessionRequest::new(existing_id.to_string(), working_dir.to_path_buf())
                        .mcp_servers(mcp_servers.to_vec()),
                )
                .await
                .map_err(|e| format!("Failed to load ACP session: {e:?}"))?;

            Ok(existing_id.to_string())
        }
        None => {
            let new_session_request =
                NewSessionRequest::new(working_dir.to_path_buf()).mcp_servers(mcp_servers.to_vec());
            let session_response = connection
                .new_session(new_session_request)
                .await
                .map_err(|e| format!("Failed to create ACP session: {e:?}"))?;

            let new_id = session_response.session_id.to_string();
            store
                .set_agent_session_id(our_session_id, &new_id)
                .map_err(|e| format!("Failed to save agent session ID: {e}"))?;
            Ok(new_id)
        }
    }
}

/// Strip outer markdown code fences from tool-result content.
///
/// Agents often wrap results in ``` fences which are redundant in our `<pre>` display.
/// The closing fence may be absent when content was truncated by the preview limit.
pub fn strip_code_fences(content: &str) -> String {
    let trimmed = content.trim();
    if let Some(after_open) = trimmed.strip_prefix("```") {
        if let Some(nl) = after_open.find('\n') {
            let body = after_open[nl + 1..].trim_end();
            return body
                .strip_suffix("```")
                .unwrap_or(body)
                .trim_end()
                .to_string();
        }
    }
    content.to_string()
}

fn extract_content_preview(content: &[agent_client_protocol::ToolCallContent]) -> Option<String> {
    for item in content {
        match item {
            agent_client_protocol::ToolCallContent::Content(c) => {
                if let AcpContentBlock::Text(text) = &c.content {
                    let preview: String = text.text.chars().take(500).collect();
                    return Some(if text.text.len() > 500 {
                        format!("{preview}...")
                    } else {
                        preview
                    });
                }
            }
            agent_client_protocol::ToolCallContent::Diff(d) => {
                return Some(format!(
                    "{}{}",
                    d.path.display(),
                    if d.old_text.is_some() {
                        " (modified)"
                    } else {
                        " (new)"
                    }
                ));
            }
            agent_client_protocol::ToolCallContent::Terminal(t) => {
                return Some(format!("Terminal: {}", t.terminal_id.0));
            }
            _ => {}
        }
    }
    None
}

// =============================================================================
// Basic MessageWriter implementation
// =============================================================================

/// Simple in-memory message writer for basic usage.
///
/// Collects streamed text and tool call information in memory.
/// Useful for tests and simple one-shot prompting.
pub struct BasicMessageWriter {
    text: Mutex<String>,
    last_flush_at: Mutex<Instant>,
}

impl BasicMessageWriter {
    /// Create a new empty message writer.
    pub fn new() -> Self {
        Self {
            text: Mutex::new(String::new()),
            last_flush_at: Mutex::new(Instant::now()),
        }
    }

    /// Get the accumulated text.
    pub async fn get_text(&self) -> String {
        self.text.lock().await.clone()
    }
}

impl Default for BasicMessageWriter {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl MessageWriter for BasicMessageWriter {
    async fn append_text(&self, text: &str) {
        let mut current = self.text.lock().await;
        current.push_str(text);
        *self.last_flush_at.lock().await = Instant::now();
    }

    async fn finalize(&self) {
        // Nothing to do for basic implementation
    }

    async fn record_tool_call(&self, _tool_call_id: &str, title: &str) {
        let mut current = self.text.lock().await;
        current.push_str(&format!("\n[Tool: {}]\n", title));
    }

    async fn update_tool_call_title(&self, _tool_call_id: &str, _title: &str) {
        // Nothing to do for basic implementation
    }

    async fn record_tool_result(&self, content: &str) {
        let mut current = self.text.lock().await;
        current.push_str(&format!("\n[Result: {}]\n", content));
    }
}

#[cfg(test)]
mod tests {
    use super::shell_quote;

    #[test]
    fn shell_quote_simple_value() {
        assert_eq!(
            shell_quote("/usr/local/bin/goose"),
            "'/usr/local/bin/goose'"
        );
    }

    #[test]
    fn shell_quote_escapes_single_quotes() {
        assert_eq!(shell_quote("it's here"), "'it'\\''s here'");
    }

    #[test]
    fn shell_quote_preserves_spaces() {
        assert_eq!(shell_quote("/path/with space"), "'/path/with space'");
    }

    #[tokio::test]
    async fn local_stdout_normalization_filters_non_json() {
        use super::normalize_local_acp_stdout;
        use tokio::io::AsyncReadExt;

        let input = b"Hermit environment /home/user/.hermit activated\n\
                       {\"jsonrpc\":\"2.0\",\"id\":1,\"result\":null}\n\
                       some banner text\n\
                       {\"jsonrpc\":\"2.0\",\"id\":2,\"result\":null}\n";

        let (writer, mut reader) = tokio::io::duplex(64 * 1024);
        let input_reader = &input[..];

        normalize_local_acp_stdout(input_reader, writer)
            .await
            .expect("normalization should succeed");

        let mut output = String::new();
        reader
            .read_to_string(&mut output)
            .await
            .expect("read should succeed");

        assert_eq!(
            output,
            "{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":null}\n\
             {\"jsonrpc\":\"2.0\",\"id\":2,\"result\":null}\n"
        );
    }

    #[tokio::test]
    async fn local_stdout_normalization_passes_empty_input() {
        use super::normalize_local_acp_stdout;
        use tokio::io::AsyncReadExt;

        let input = b"";
        let (writer, mut reader) = tokio::io::duplex(64 * 1024);

        normalize_local_acp_stdout(&input[..], writer)
            .await
            .expect("normalization should succeed");

        let mut output = String::new();
        reader
            .read_to_string(&mut output)
            .await
            .expect("read should succeed");

        assert!(output.is_empty());
    }
}
