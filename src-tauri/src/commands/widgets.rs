use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use tauri::State;

use crate::services::widgets::WidgetRegistry;

#[derive(Deserialize)]
struct RawManifest {
    name: String,
    #[serde(default)]
    description: Option<String>,
    entry: String,
    #[serde(default = "default_size")]
    size: String,
    #[serde(default = "default_placement")]
    placement: Vec<String>,
    #[serde(default)]
    permissions: Vec<String>,
}

fn default_size() -> String {
    "standard".to_string()
}

fn default_placement() -> Vec<String> {
    vec!["context-panel".to_string()]
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WidgetManifest {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub entry: String,
    pub path: String,
    pub size: String,
    pub placement: Vec<String>,
    pub permissions: Vec<String>,
    pub scope: String,
}

fn scan_widget_dir(dir: &PathBuf, scope: &str) -> Vec<WidgetManifest> {
    let mut widgets = Vec::new();

    let entries = match std::fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return widgets,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let manifest_path = path.join("widget.yaml");
        if !manifest_path.exists() {
            continue;
        }

        let yaml = match std::fs::read_to_string(&manifest_path) {
            Ok(content) => content,
            Err(_) => continue,
        };

        let raw: RawManifest = match serde_yaml::from_str(&yaml) {
            Ok(manifest) => manifest,
            Err(_) => continue,
        };

        let id = entry.file_name().to_string_lossy().to_string();
        let entry_file = path.join(&raw.entry);
        if !entry_file.exists() {
            continue;
        }

        widgets.push(WidgetManifest {
            id,
            name: raw.name,
            description: raw.description,
            entry: raw.entry,
            path: path.to_string_lossy().to_string(),
            size: raw.size,
            placement: raw.placement,
            permissions: raw.permissions,
            scope: scope.to_string(),
        });
    }

    widgets
}

#[tauri::command]
pub fn discover_widgets(
    registry: State<'_, WidgetRegistry>,
    project_dir: Option<String>,
) -> Vec<WidgetManifest> {
    registry.clear();

    let user_widgets_dir = dirs::home_dir()
        .expect("home dir")
        .join(".goose")
        .join("widgets");

    let mut user_widgets = scan_widget_dir(&user_widgets_dir, "user");

    if let Some(ref project) = project_dir {
        let project_widgets_dir = PathBuf::from(project).join(".goose").join("widgets");
        let project_widgets = scan_widget_dir(&project_widgets_dir, "project");

        for pw in &project_widgets {
            user_widgets.retain(|uw| uw.id != pw.id);
        }

        for pw in &project_widgets {
            registry.register(&pw.id, PathBuf::from(&pw.path));
        }

        user_widgets.extend(project_widgets);
    }

    for w in &user_widgets {
        registry.register(&w.id, PathBuf::from(&w.path));
    }

    user_widgets
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

#[tauri::command]
pub fn widget_shell_run(command: String, cwd: Option<String>) -> Result<ShellResult, String> {
    let mut cmd = std::process::Command::new("sh");
    cmd.arg("-c").arg(&command);

    if let Some(ref dir) = cwd {
        cmd.current_dir(dir);
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to run command: {}", e))?;

    Ok(ShellResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}

fn widget_data_dir() -> PathBuf {
    let dir = dirs::home_dir()
        .expect("home dir")
        .join(".goose")
        .join("widget-data");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

fn storage_path(widget_id: &str) -> PathBuf {
    widget_data_dir().join(format!("{}.json", widget_id))
}

fn read_storage(widget_id: &str) -> serde_json::Map<String, Value> {
    let path = storage_path(widget_id);
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|json| serde_json::from_str(&json).ok())
        .unwrap_or_default()
}

fn write_storage(widget_id: &str, data: &serde_json::Map<String, Value>) {
    let path = storage_path(widget_id);
    if let Ok(json) = serde_json::to_string_pretty(data) {
        let _ = std::fs::write(path, json);
    }
}

#[tauri::command]
pub fn widget_storage_get(widget_id: String, key: String) -> Value {
    let data = read_storage(&widget_id);
    data.get(&key).cloned().unwrap_or(Value::Null)
}

#[tauri::command]
pub fn widget_storage_set(widget_id: String, key: String, value: Value) {
    let mut data = read_storage(&widget_id);
    data.insert(key, value);
    write_storage(&widget_id, &data);
}

#[tauri::command]
pub fn widget_storage_remove(widget_id: String, key: String) {
    let mut data = read_storage(&widget_id);
    data.remove(&key);
    write_storage(&widget_id, &data);
}

#[tauri::command]
pub fn widget_storage_clear(widget_id: String) {
    let path = storage_path(&widget_id);
    let _ = std::fs::remove_file(path);
}
