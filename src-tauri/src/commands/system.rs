use tauri::Window;
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub fn get_home_dir() -> Result<String, String> {
    let home_dir = dirs::home_dir().ok_or("Could not determine home directory")?;
    Ok(home_dir.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn save_exported_session_file(
    window: Window,
    default_filename: String,
    contents: String,
) -> Result<Option<String>, String> {
    let mut dialog = window
        .dialog()
        .file()
        .set_title("Export Session")
        .set_file_name(default_filename)
        .add_filter("JSON", &["json"]);

    #[cfg(desktop)]
    {
        dialog = dialog.set_parent(&window);
    }

    let Some(path) = dialog.blocking_save_file() else {
        return Ok(None);
    };

    let path = path
        .into_path()
        .map_err(|_| "Selected save path is not available".to_string())?;
    std::fs::write(&path, contents)
        .map_err(|e| format!("Failed to write file '{}': {}", path.display(), e))?;

    Ok(Some(path.to_string_lossy().into_owned()))
}

#[tauri::command]
#[allow(dead_code)]
pub fn path_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}
