use tauri::Window;
use tauri_plugin_dialog::DialogExt;

use std::collections::{HashSet, VecDeque};
use std::fs;
use std::path::PathBuf;

const DEFAULT_FILE_MENTION_LIMIT: usize = 1500;
const MAX_FILE_MENTION_LIMIT: usize = 5000;
const MAX_SCAN_DEPTH: usize = 8;

#[tauri::command]
pub fn get_home_dir() -> Result<String, String> {
    let home_dir = dirs::home_dir().ok_or("Could not determine home directory")?;
    Ok(home_dir.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn save_exported_session_file(
    window: Window,
    default_filename: String,
    contents: String,
) -> Result<Option<String>, String> {
    let desktop =
        dirs::desktop_dir().unwrap_or_else(|| dirs::home_dir().unwrap_or_default().join("Desktop"));

    let mut dialog = window
        .dialog()
        .file()
        .set_title("Export Session")
        .set_file_name(default_filename)
        .set_directory(desktop)
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

fn should_skip_dir(name: &str) -> bool {
    if name.starts_with('.') {
        return true;
    }

    matches!(
        name,
        "node_modules"
            | "dist"
            | "build"
            | "target"
            | ".next"
            | ".nuxt"
            | ".cache"
            | "coverage"
            | ".turbo"
            | ".pnpm-store"
    )
}

fn normalize_roots(roots: Vec<String>) -> Vec<PathBuf> {
    let mut dedup = HashSet::new();
    let mut normalized = Vec::new();
    for root in roots {
        let trimmed = root.trim();
        if trimmed.is_empty() {
            continue;
        }
        let path = PathBuf::from(trimmed);
        let key = path.to_string_lossy().to_lowercase();
        if dedup.insert(key) {
            normalized.push(path);
        }
    }
    normalized
}

fn scan_files_for_mentions(roots: Vec<String>, max_results: Option<usize>) -> Vec<String> {
    let roots = normalize_roots(roots);
    if roots.is_empty() {
        return Vec::new();
    }

    let limit = max_results
        .unwrap_or(DEFAULT_FILE_MENTION_LIMIT)
        .clamp(1, MAX_FILE_MENTION_LIMIT);

    let mut queue: VecDeque<(PathBuf, usize)> =
        roots.into_iter().map(|path| (path, 0usize)).collect();
    let mut seen = HashSet::new();
    let mut files = Vec::new();

    while let Some((dir, depth)) = queue.pop_front() {
        if files.len() >= limit {
            break;
        }

        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };

        for entry in entries.flatten() {
            if files.len() >= limit {
                break;
            }

            let Ok(file_type) = entry.file_type() else {
                continue;
            };
            let path = entry.path();

            if file_type.is_dir() {
                if depth >= MAX_SCAN_DEPTH {
                    continue;
                }
                let name = entry.file_name();
                let name = name.to_string_lossy();
                if should_skip_dir(&name) {
                    continue;
                }
                queue.push_back((path, depth + 1));
                continue;
            }

            if !file_type.is_file() {
                continue;
            }

            let path_str = path.to_string_lossy().to_string();
            let dedup_key = path_str.to_lowercase();
            if seen.insert(dedup_key) {
                files.push(path_str);
            }
        }
    }

    files.sort_by_key(|path| path.to_lowercase());
    files
}

#[tauri::command]
pub async fn list_files_for_mentions(
    roots: Vec<String>,
    max_results: Option<usize>,
) -> Result<Vec<String>, String> {
    tokio::task::spawn_blocking(move || scan_files_for_mentions(roots, max_results))
        .await
        .map_err(|error| format!("Failed to scan files for mentions: {}", error))
}

#[cfg(test)]
mod tests {
    use super::scan_files_for_mentions;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn scans_project_files_and_skips_node_modules() {
        let dir = tempdir().expect("tempdir");
        let root = dir.path();
        let src = root.join("src");
        let ignored = root.join("node_modules").join("pkg");

        fs::create_dir_all(&src).expect("src dir");
        fs::create_dir_all(&ignored).expect("ignored dir");
        fs::write(src.join("main.ts"), "export {}").expect("source file");
        fs::write(ignored.join("index.js"), "module.exports = {}").expect("ignored file");

        let files = scan_files_for_mentions(vec![root.to_string_lossy().to_string()], Some(50));

        let joined = files.join("\n");
        assert!(joined.contains("main.ts"));
        assert!(!joined.contains("node_modules"));
    }
}
