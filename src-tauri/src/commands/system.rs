#[tauri::command]
pub fn get_home_dir() -> Result<String, String> {
    let home_dir = dirs::home_dir().ok_or("Could not determine home directory")?;
    Ok(home_dir.to_string_lossy().into_owned())
}

#[tauri::command]
#[allow(dead_code)]
pub fn path_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}
