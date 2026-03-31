use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UiState {
    pub open_tab_ids: Vec<String>,
    pub active_tab_id: Option<String>,
}

fn ui_state_path() -> std::path::PathBuf {
    dirs::home_dir()
        .expect("home dir")
        .join(".goose")
        .join("ui_state.json")
}

#[tauri::command]
pub fn save_ui_state(
    open_tab_ids: Vec<String>,
    active_tab_id: Option<String>,
) -> Result<(), String> {
    let state = UiState {
        open_tab_ids,
        active_tab_id,
    };
    let path = ui_state_path();
    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let json = serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_ui_state() -> Result<UiState, String> {
    let path = ui_state_path();
    if !path.exists() {
        return Ok(UiState {
            open_tab_ids: Vec::new(),
            active_tab_id: None,
        });
    }
    let json = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&json).map_err(|e| e.to_string())
}
