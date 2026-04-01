use std::collections::HashMap;

use serde::Serialize;
use tokio_util::sync::CancellationToken;

/// Info about a running ACP session, returned to the frontend.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpRunningSession {
    pub session_id: String,
    pub provider_id: String,
    pub running_for_secs: u64,
}

struct AcpSessionEntry {
    cancel_token: CancellationToken,
    provider_id: String,
    started_at: std::time::Instant,
    /// PID of the process that owns this session (for orphan detection).
    #[allow(dead_code)]
    owner_pid: u32,
}

/// Tracks running ACP sessions for cancellation and cleanup.
///
/// Each running session is registered with a `CancellationToken` so it can
/// be cancelled from the frontend or cleaned up on shutdown.
pub struct AcpSessionRegistry {
    sessions: std::sync::Mutex<HashMap<String, AcpSessionEntry>>,
}

impl AcpSessionRegistry {
    pub fn new() -> Self {
        Self {
            sessions: std::sync::Mutex::new(HashMap::new()),
        }
    }

    /// Register a new session and return its cancellation token.
    pub fn register(&self, session_id: &str, provider_id: &str) -> CancellationToken {
        let token = CancellationToken::new();
        let entry = AcpSessionEntry {
            cancel_token: token.clone(),
            provider_id: provider_id.to_string(),
            started_at: std::time::Instant::now(),
            owner_pid: std::process::id(),
        };
        self.sessions
            .lock()
            .expect("session registry lock")
            .insert(session_id.to_string(), entry);
        token
    }

    /// Deregister a session (called when it completes or errors).
    pub fn deregister(&self, session_id: &str) {
        self.sessions
            .lock()
            .expect("session registry lock")
            .remove(session_id);
    }

    /// Cancel a running session by signalling its cancellation token.
    pub fn cancel(&self, session_id: &str) -> bool {
        let guard = self.sessions.lock().expect("session registry lock");
        if let Some(entry) = guard.get(session_id) {
            entry.cancel_token.cancel();
            true
        } else {
            false
        }
    }

    /// Cancel all running sessions (used during app shutdown).
    pub fn cancel_all(&self) {
        let guard = self.sessions.lock().expect("session registry lock");
        for entry in guard.values() {
            entry.cancel_token.cancel();
        }
    }

    /// Return info about all currently running sessions (for the frontend).
    pub fn list_running(&self) -> Vec<AcpRunningSession> {
        let guard = self.sessions.lock().expect("session registry lock");
        guard
            .iter()
            .map(|(id, entry)| AcpRunningSession {
                session_id: id.clone(),
                provider_id: entry.provider_id.clone(),
                running_for_secs: entry.started_at.elapsed().as_secs(),
            })
            .collect()
    }
}
