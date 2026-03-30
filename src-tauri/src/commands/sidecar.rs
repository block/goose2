use std::env;
use std::net::TcpListener;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

use rand::RngExt;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

/// Information about the running sidecar process.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidecarInfo {
    pub url: String,
    pub port: u16,
    pub pid: Option<u32>,
    pub secret_key: String,
    pub healthy: bool,
}

/// Shared state for the sidecar process.
pub struct SidecarState {
    pub process: Mutex<Option<Child>>,
    pub url: Mutex<Option<String>>,
    pub port: Mutex<Option<u16>>,
    pub secret_key: Mutex<Option<String>>,
}

impl Default for SidecarState {
    fn default() -> Self {
        Self {
            process: Mutex::new(None),
            url: Mutex::new(None),
            port: Mutex::new(None),
            secret_key: Mutex::new(None),
        }
    }
}

/// Find an available TCP port by binding to port 0.
fn find_available_port() -> Result<u16, String> {
    let listener =
        TcpListener::bind("127.0.0.1:0").map_err(|e| format!("Failed to bind port: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("Failed to get local addr: {e}"))?
        .port();
    Ok(port)
}

/// Generate a random 32-character hex secret key.
fn generate_secret_key() -> String {
    let mut rng = rand::rng();
    let bytes: Vec<u8> = (0..16).map(|_| rng.random::<u8>()).collect();
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// Resolve the path to the goosed binary.
fn find_goosed_binary(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    // Check for an explicit override via environment variable.
    if let Ok(path) = env::var("GOOSED_PATH") {
        let p = std::path::PathBuf::from(&path);
        if p.exists() {
            return Ok(p);
        }
        return Err(format!("GOOSED_PATH set but not found: {path}"));
    }

    // In debug mode, look relative to the workspace root.
    #[cfg(debug_assertions)]
    {
        let resource_dir = app
            .path()
            .resource_dir()
            .unwrap_or_else(|_| std::path::PathBuf::from("."));

        let candidates = [
            resource_dir.join("../../target/debug/goosed"),
            resource_dir.join("../../target/release/goosed"),
            std::path::PathBuf::from("../../target/debug/goosed"),
            std::path::PathBuf::from("../../target/release/goosed"),
        ];

        for candidate in &candidates {
            if candidate.exists() {
                return Ok(candidate.clone());
            }
        }
    }

    // In release mode, look next to the app bundle.
    #[cfg(not(debug_assertions))]
    {
        let resource_dir = app
            .path()
            .resource_dir()
            .map_err(|e| format!("Failed to get resource dir: {e}"))?;

        let candidate = resource_dir.join("goosed");
        if candidate.exists() {
            return Ok(candidate);
        }
    }

    // Fallback: check PATH.
    if let Ok(output) = Command::new("which").arg("goosed").output() {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return Ok(std::path::PathBuf::from(path));
            }
        }
    }

    Err("Could not find goosed binary".to_string())
}

/// Build a reqwest client that accepts self-signed certificates.
fn build_http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {e}"))
}

/// Poll the sidecar health endpoint until it responds or we time out.
async fn wait_for_healthy(url: &str, secret_key: &str) -> Result<bool, String> {
    let client = build_http_client()?;
    let status_url = format!("{url}/status");

    for _ in 0..80 {
        let result = client
            .get(&status_url)
            .header("X-Secret-Key", secret_key)
            .send()
            .await;

        if let Ok(resp) = result {
            if resp.status().is_success() {
                return Ok(true);
            }
        }

        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }

    Err("Sidecar did not become healthy within 8 seconds".to_string())
}

/// Start the goosed sidecar process.
///
/// If `GOOSE_EXTERNAL_BACKEND` is set, connects to an already-running goosed
/// instance instead of spawning a new process.
#[tauri::command]
pub async fn start_sidecar(
    app: AppHandle,
    state: State<'_, SidecarState>,
    working_dir: Option<String>,
    port: Option<u16>,
) -> Result<SidecarInfo, String> {
    // If an external backend is configured, use it directly.
    if let Ok(external_url) = env::var("GOOSE_EXTERNAL_BACKEND") {
        let secret_key =
            env::var("GOOSE_SERVER__SECRET_KEY").unwrap_or_else(|_| generate_secret_key());

        *state.url.lock().map_err(|e| e.to_string())? = Some(external_url.clone());
        *state.secret_key.lock().map_err(|e| e.to_string())? = Some(secret_key.clone());

        // Try to parse port from the external URL.
        let parsed_port = external_url
            .rsplit(':')
            .next()
            .and_then(|p| p.trim_end_matches('/').parse::<u16>().ok())
            .unwrap_or(0);

        *state.port.lock().map_err(|e| e.to_string())? = Some(parsed_port);

        return Ok(SidecarInfo {
            url: external_url,
            port: parsed_port,
            pid: None,
            secret_key,
            healthy: true,
        });
    }

    let port = match port {
        Some(p) => p,
        None => find_available_port()?,
    };

    let secret_key = generate_secret_key();
    let url = format!("https://127.0.0.1:{port}");

    let goosed_path = find_goosed_binary(&app)?;

    let home_dir = dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "/tmp".to_string());

    let mut cmd = Command::new(&goosed_path);
    cmd.env("GOOSE_PORT", port.to_string())
        .env("GOOSE_SERVER__SECRET_KEY", &secret_key)
        .env("HOME", &home_dir)
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    if let Some(ref dir) = working_dir {
        cmd.current_dir(dir);
    }

    let child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn goosed at {}: {e}", goosed_path.display()))?;

    let pid = child.id();

    *state.process.lock().map_err(|e| e.to_string())? = Some(child);
    *state.url.lock().map_err(|e| e.to_string())? = Some(url.clone());
    *state.port.lock().map_err(|e| e.to_string())? = Some(port);
    *state.secret_key.lock().map_err(|e| e.to_string())? = Some(secret_key.clone());

    // Wait for the sidecar to become healthy.
    let healthy = wait_for_healthy(&url, &secret_key).await.unwrap_or(false);

    Ok(SidecarInfo {
        url,
        port,
        pid: Some(pid),
        secret_key,
        healthy,
    })
}

/// Stop the running sidecar process.
#[tauri::command]
pub async fn stop_sidecar(state: State<'_, SidecarState>) -> Result<(), String> {
    let mut process_guard = state.process.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut child) = *process_guard {
        child
            .kill()
            .map_err(|e| format!("Failed to kill sidecar: {e}"))?;
        child
            .wait()
            .map_err(|e| format!("Failed to wait on sidecar: {e}"))?;
    }
    *process_guard = None;
    *state.url.lock().map_err(|e| e.to_string())? = None;
    *state.port.lock().map_err(|e| e.to_string())? = None;
    *state.secret_key.lock().map_err(|e| e.to_string())? = None;
    Ok(())
}

/// Get the URL of the running sidecar.
#[tauri::command]
pub async fn get_sidecar_url(state: State<'_, SidecarState>) -> Result<Option<String>, String> {
    let url = state.url.lock().map_err(|e| e.to_string())?;
    Ok(url.clone())
}

/// Get the secret key for authenticating with the sidecar.
#[tauri::command]
pub async fn get_sidecar_secret(state: State<'_, SidecarState>) -> Result<Option<String>, String> {
    let secret = state.secret_key.lock().map_err(|e| e.to_string())?;
    Ok(secret.clone())
}

/// Check if the sidecar is healthy by hitting its status endpoint.
#[tauri::command]
pub async fn sidecar_health(state: State<'_, SidecarState>) -> Result<bool, String> {
    let url = {
        let guard = state.url.lock().map_err(|e| e.to_string())?;
        match guard.clone() {
            Some(u) => u,
            None => return Ok(false),
        }
    };

    let secret_key = {
        let guard = state.secret_key.lock().map_err(|e| e.to_string())?;
        guard.clone().unwrap_or_default()
    };

    let client = build_http_client()?;
    let status_url = format!("{url}/status");

    let result = client
        .get(&status_url)
        .header("X-Secret-Key", &secret_key)
        .send()
        .await;

    match result {
        Ok(resp) => Ok(resp.status().is_success()),
        Err(_) => Ok(false),
    }
}
