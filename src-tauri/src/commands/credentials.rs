use tauri::State;

use crate::services::goose_config::{FieldValue, GooseConfig, ProviderStatus};

#[tauri::command]
pub fn get_provider_config(
    config: State<'_, GooseConfig>,
    provider_id: String,
) -> Result<Vec<FieldValue>, String> {
    config.get_provider_field_values(&provider_id)
}

#[tauri::command]
pub fn save_provider_field(
    config: State<'_, GooseConfig>,
    key: String,
    value: String,
    is_secret: bool,
) -> Result<(), String> {
    let trimmed_value = value.trim();
    if trimmed_value.is_empty() {
        return Err("Field value cannot be empty".to_string());
    }

    if is_secret {
        config.set_secret(&key, trimmed_value)
    } else {
        config.set_param(&key, trimmed_value)
    }
}

#[tauri::command]
pub fn delete_provider_config(
    config: State<'_, GooseConfig>,
    provider_id: String,
) -> Result<(), String> {
    config.delete_all_provider_fields(&provider_id)
}

#[tauri::command]
pub fn check_all_provider_status(config: State<'_, GooseConfig>) -> Vec<ProviderStatus> {
    config.check_all_provider_status()
}

#[tauri::command]
pub fn restart_app(app: tauri::AppHandle) {
    app.restart();
}
