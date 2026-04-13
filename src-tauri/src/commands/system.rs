use serde::Serialize;
use tauri::Window;
use tauri_plugin_dialog::DialogExt;

use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

const DEFAULT_FILE_MENTION_LIMIT: usize = 1500;
const MAX_FILE_MENTION_LIMIT: usize = 5000;
const MAX_SCAN_DEPTH: usize = 8;

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileTreeEntry {
    pub name: String,
    pub path: String,
    pub kind: String,
}

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

fn read_directory_entries(path: &Path) -> Result<Vec<FileTreeEntry>, String> {
    if !path.exists() {
        return Err(format!("Directory does not exist: {}", path.display()));
    }

    let metadata = fs::metadata(path)
        .map_err(|error| format!("Failed to inspect '{}': {}", path.display(), error))?;
    if !metadata.is_dir() {
        return Err(format!("Path is not a directory: {}", path.display()));
    }

    let mut entries = Vec::new();
    let reader = fs::read_dir(path)
        .map_err(|error| format!("Failed to read directory '{}': {}", path.display(), error))?;

    for entry in reader {
        let entry = entry
            .map_err(|error| format!("Failed to read directory '{}': {}", path.display(), error))?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if name == ".git" {
            continue;
        }

        let file_type = entry.file_type().map_err(|error| {
            format!(
                "Failed to inspect directory entry '{}' in '{}': {}",
                name,
                path.display(),
                error
            )
        })?;

        entries.push(FileTreeEntry {
            name,
            path: entry.path().to_string_lossy().into_owned(),
            kind: if file_type.is_dir() {
                "directory".to_string()
            } else {
                "file".to_string()
            },
        });
    }

    entries.sort_by(|a, b| {
        let a_rank = if a.kind == "directory" { 0 } else { 1 };
        let b_rank = if b.kind == "directory" { 0 } else { 1 };
        a_rank
            .cmp(&b_rank)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
            .then_with(|| a.name.cmp(&b.name))
    });

    Ok(entries)
}

#[tauri::command]
pub fn list_directory_entries(path: String) -> Result<Vec<FileTreeEntry>, String> {
    read_directory_entries(Path::new(&path))
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

    let mut builder = ignore::WalkBuilder::new(&roots[0]);
    for root in &roots[1..] {
        builder.add(root);
    }
    builder
        .max_depth(Some(MAX_SCAN_DEPTH))
        .follow_links(false) // don't traverse symlinks
        .hidden(true) // skip hidden files/dirs
        .git_ignore(true) // respect .gitignore
        .git_global(true) // respect global gitignore
        .git_exclude(true); // respect .git/info/exclude

    // Canonicalize roots so we can reject paths that escape via symlink targets
    let canonical_roots: Vec<PathBuf> = roots
        .iter()
        .filter_map(|root| root.canonicalize().ok())
        .collect();

    let mut seen = HashSet::new();
    let mut files = Vec::new();

    for entry in builder.build().flatten() {
        if files.len() >= limit {
            break;
        }
        let Some(ft) = entry.file_type() else {
            continue;
        };
        if !ft.is_file() {
            continue;
        }
        // Reject any path that resolved outside the project roots
        let canonical = match entry.path().canonicalize() {
            Ok(c) => c,
            Err(_) => continue,
        };
        if !canonical_roots
            .iter()
            .any(|root| canonical.starts_with(root))
        {
            continue;
        }
        let path_str = entry.path().to_string_lossy().to_string();
        let dedup_key = path_str.to_lowercase();
        if seen.insert(dedup_key) {
            files.push(path_str);
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
    use super::{read_directory_entries, scan_files_for_mentions};
    use std::fs;
    #[cfg(unix)]
    use std::os::unix::fs::PermissionsExt;
    use std::process::Command;
    use tempfile::tempdir;

    /// Create a temp dir with `git init` so the ignore crate picks up `.gitignore`.
    fn git_tempdir() -> tempfile::TempDir {
        let dir = tempdir().expect("tempdir");
        Command::new("git")
            .args(["init", "--quiet"])
            .current_dir(dir.path())
            .output()
            .expect("git init");
        dir
    }

    #[test]
    fn respects_gitignore() {
        let dir = git_tempdir();
        let root = dir.path();
        let src = root.join("src");
        let ignored = root.join("node_modules").join("pkg");

        fs::create_dir_all(&src).expect("src dir");
        fs::create_dir_all(&ignored).expect("ignored dir");
        fs::write(src.join("main.ts"), "export {}").expect("source file");
        fs::write(ignored.join("index.js"), "module.exports = {}").expect("ignored file");
        fs::write(root.join(".gitignore"), "node_modules/\n").expect(".gitignore");

        let files = scan_files_for_mentions(vec![root.to_string_lossy().to_string()], Some(50));

        let joined = files.join("\n");
        assert!(joined.contains("main.ts"), "should include source files");
        assert!(
            !joined.contains("node_modules"),
            "should respect .gitignore"
        );
    }

    #[test]
    fn skips_hidden_files() {
        let dir = git_tempdir();
        let root = dir.path();

        fs::write(root.join("visible.ts"), "").expect("visible file");
        fs::write(root.join(".hidden"), "").expect("hidden file");

        let files = scan_files_for_mentions(vec![root.to_string_lossy().to_string()], Some(50));

        let joined = files.join("\n");
        assert!(joined.contains("visible.ts"));
        assert!(!joined.contains(".hidden"));
    }

    #[test]
    fn lists_directory_entries_with_expected_sorting_and_visibility() {
        let dir = tempdir().expect("tempdir");
        let root = dir.path();

        fs::create_dir_all(root.join(".git")).expect(".git dir");
        fs::create_dir_all(root.join(".github")).expect(".github dir");
        fs::create_dir_all(root.join("node_modules")).expect("node_modules dir");
        fs::create_dir_all(root.join("src")).expect("src dir");
        fs::write(root.join(".env"), "").expect(".env");
        fs::write(root.join(".gitignore"), "node_modules/\n").expect(".gitignore");
        fs::write(root.join("README.md"), "").expect("README");
        fs::write(root.join("alpha.ts"), "").expect("alpha");

        let entries = read_directory_entries(root).expect("entries");

        assert_eq!(
            entries,
            vec![
                super::FileTreeEntry {
                    name: ".github".into(),
                    path: root.join(".github").to_string_lossy().into_owned(),
                    kind: "directory".into(),
                },
                super::FileTreeEntry {
                    name: "node_modules".into(),
                    path: root.join("node_modules").to_string_lossy().into_owned(),
                    kind: "directory".into(),
                },
                super::FileTreeEntry {
                    name: "src".into(),
                    path: root.join("src").to_string_lossy().into_owned(),
                    kind: "directory".into(),
                },
                super::FileTreeEntry {
                    name: ".env".into(),
                    path: root.join(".env").to_string_lossy().into_owned(),
                    kind: "file".into(),
                },
                super::FileTreeEntry {
                    name: ".gitignore".into(),
                    path: root.join(".gitignore").to_string_lossy().into_owned(),
                    kind: "file".into(),
                },
                super::FileTreeEntry {
                    name: "alpha.ts".into(),
                    path: root.join("alpha.ts").to_string_lossy().into_owned(),
                    kind: "file".into(),
                },
                super::FileTreeEntry {
                    name: "README.md".into(),
                    path: root.join("README.md").to_string_lossy().into_owned(),
                    kind: "file".into(),
                },
            ]
        );
    }

    #[test]
    fn list_directory_entries_errors_for_missing_paths() {
        let dir = tempdir().expect("tempdir");
        let missing = dir.path().join("missing");

        let error = read_directory_entries(&missing).expect_err("missing dir should error");
        assert!(error.contains("Directory does not exist"));
    }

    #[test]
    #[cfg(unix)]
    fn list_directory_entries_errors_for_unreadable_directories() {
        let dir = tempdir().expect("tempdir");
        let blocked = dir.path().join("blocked");
        fs::create_dir(&blocked).expect("blocked dir");

        let original_permissions = fs::metadata(&blocked).expect("metadata").permissions();
        let mut unreadable_permissions = original_permissions.clone();
        unreadable_permissions.set_mode(0o000);
        fs::set_permissions(&blocked, unreadable_permissions).expect("set unreadable");

        let error = read_directory_entries(&blocked).expect_err("unreadable dir should error");

        let mut restored_permissions = original_permissions;
        restored_permissions.set_mode(0o700);
        fs::set_permissions(&blocked, restored_permissions).expect("restore permissions");

        assert!(error.contains("Failed to read directory"));
    }
}
