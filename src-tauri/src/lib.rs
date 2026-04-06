mod commands;
mod services;
mod types;

use std::sync::Arc;

use services::acp::AcpSessionRegistry;
use services::personas::PersonaStore;
use services::sessions::SessionStore;
use services::widgets::WidgetRegistry;
use tauri::Manager;
use tauri_plugin_window_state::StateFlags;

const BRIDGE_JS: &str = include_str!("bridge.js");

fn mime_from_extension(path: &str) -> &'static str {
    if path.ends_with(".html") || path.ends_with(".htm") {
        "text/html"
    } else if path.ends_with(".css") {
        "text/css"
    } else if path.ends_with(".js") || path.ends_with(".mjs") {
        "application/javascript"
    } else if path.ends_with(".json") {
        "application/json"
    } else if path.ends_with(".png") {
        "image/png"
    } else if path.ends_with(".jpg") || path.ends_with(".jpeg") {
        "image/jpeg"
    } else if path.ends_with(".gif") {
        "image/gif"
    } else if path.ends_with(".svg") {
        "image/svg+xml"
    } else if path.ends_with(".webp") {
        "image/webp"
    } else if path.ends_with(".woff2") {
        "font/woff2"
    } else if path.ends_with(".woff") {
        "font/woff"
    } else {
        "application/octet-stream"
    }
}

fn inject_bridge(html: &str) -> String {
    let base_style = r#"<style id="goose-theme">
:root {
  color-scheme: light dark;
  background: transparent;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
body { margin: 0; }
</style>"#;

    let bridge_tag = format!("<script>{}</script>", BRIDGE_JS);

    if let Some(pos) = html.find("<head>") {
        let insert_at = pos + "<head>".len();
        format!(
            "{}\n{}\n{}\n{}",
            &html[..insert_at],
            base_style,
            bridge_tag,
            &html[insert_at..]
        )
    } else if let Some(pos) = html.find("<html") {
        let tag_end = html[pos..].find('>').map(|i| pos + i + 1).unwrap_or(pos);
        format!(
            "{}<head>\n{}\n{}\n</head>{}",
            &html[..tag_end],
            base_style,
            bridge_tag,
            &html[tag_end..]
        )
    } else {
        format!("<head>\n{}\n{}\n</head>\n{}", base_style, bridge_tag, html)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    services::acp::TauriStore::cleanup_stale_sessions(std::time::Duration::from_secs(24 * 60 * 60));

    let acp_registry = Arc::new(AcpSessionRegistry::new());
    let acp_registry_for_exit = Arc::clone(&acp_registry);

    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Debug)
                .targets([tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::Stdout,
                )])
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::all() & !StateFlags::VISIBLE)
                .build(),
        )
        .manage(PersonaStore::new())
        .manage(Arc::new(SessionStore::new()))
        .manage(acp_registry)
        .manage(WidgetRegistry::new())
        .register_uri_scheme_protocol("goose", |ctx, request| {
            let uri = request.uri().to_string();

            let path = uri
                .strip_prefix("goose://localhost/")
                .or_else(|| uri.strip_prefix("goose://localhost"))
                .unwrap_or("");

            let path = path.split('?').next().unwrap_or(path);

            let mut parts = path.splitn(2, '/');
            let widget_id = parts.next().unwrap_or("");
            let file_path = parts.next().unwrap_or("index.html");

            if widget_id.is_empty() {
                return tauri::http::Response::builder()
                    .status(404)
                    .body(b"Widget not found".to_vec())
                    .unwrap();
            }

            let registry = ctx.app_handle().state::<WidgetRegistry>();
            let widget_dir = match registry.get_path(widget_id) {
                Some(dir) => dir,
                None => {
                    return tauri::http::Response::builder()
                        .status(404)
                        .body(format!("Widget '{}' not registered", widget_id).into_bytes())
                        .unwrap();
                }
            };

            let full_path = widget_dir.join(file_path);

            if !full_path.starts_with(&widget_dir) {
                return tauri::http::Response::builder()
                    .status(403)
                    .body(b"Path traversal denied".to_vec())
                    .unwrap();
            }

            let content = match std::fs::read(&full_path) {
                Ok(bytes) => bytes,
                Err(_) => {
                    return tauri::http::Response::builder()
                        .status(404)
                        .body(
                            format!("File not found: {}", full_path.display()).into_bytes(),
                        )
                        .unwrap();
                }
            };

            let file_str = full_path.to_string_lossy();
            let mime = mime_from_extension(&file_str);
            let is_html = mime == "text/html";

            let body = if is_html {
                let html = String::from_utf8_lossy(&content);
                inject_bridge(&html).into_bytes()
            } else {
                content
            };

            tauri::http::Response::builder()
                .status(200)
                .header("content-type", mime)
                .header("access-control-allow-origin", "*")
                .body(body)
                .unwrap()
        })
        .invoke_handler(tauri::generate_handler![
            commands::agents::list_personas,
            commands::agents::create_persona,
            commands::agents::update_persona,
            commands::agents::delete_persona,
            commands::agents::refresh_personas,
            commands::agents::export_persona,
            commands::agents::import_personas,
            commands::agents::save_persona_avatar,
            commands::agents::save_persona_avatar_bytes,
            commands::agents::get_avatars_dir,
            commands::sessions::create_session,
            commands::sessions::list_sessions,
            commands::sessions::get_session_messages,
            commands::sessions::update_session,
            commands::sessions::delete_session,
            commands::sessions::list_archived_sessions,
            commands::sessions::archive_session,
            commands::sessions::unarchive_session,
            commands::chat::chat_send_message,
            commands::acp::discover_acp_providers,
            commands::acp::acp_prepare_session,
            commands::acp::acp_send_message,
            commands::acp::acp_cancel_session,
            commands::acp::acp_list_running,
            commands::acp::acp_cancel_all,
            commands::skills::create_skill,
            commands::skills::list_skills,
            commands::skills::delete_skill,
            commands::skills::update_skill,
            commands::skills::export_skill,
            commands::skills::import_skills,
            commands::projects::list_projects,
            commands::projects::create_project,
            commands::projects::update_project,
            commands::projects::delete_project,
            commands::projects::get_project,
            commands::projects::list_archived_projects,
            commands::projects::archive_project,
            commands::projects::restore_project,
            commands::doctor::run_doctor,
            commands::doctor::run_doctor_fix,
            commands::git::get_git_state,
            commands::system::get_home_dir,
            commands::system::path_exists,
            commands::widgets::discover_widgets,
            commands::widgets::widget_shell_run,
            commands::widgets::widget_storage_get,
            commands::widgets::widget_storage_set,
            commands::widgets::widget_storage_remove,
            commands::widgets::widget_storage_clear,
        ])
        .setup(|_app| Ok(()))
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |_app, event| {
            if let tauri::RunEvent::Exit = event {
                acp_registry_for_exit.cancel_all();
            }
        });
}
