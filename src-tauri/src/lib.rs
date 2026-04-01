mod commands;
mod services;
mod types;

use std::sync::Arc;

use commands::sidecar::SidecarState;
use services::acp::AcpSessionRegistry;
use services::personas::PersonaStore;
use services::sessions::SessionStore;
use tauri_plugin_window_state::StateFlags;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Clean up stale ACP session files older than 24 hours.
    services::acp::TauriStore::cleanup_stale_sessions(std::time::Duration::from_secs(24 * 60 * 60));

    let acp_registry = Arc::new(AcpSessionRegistry::new());
    let acp_registry_for_exit = Arc::clone(&acp_registry);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::all() & !StateFlags::VISIBLE)
                .build(),
        )
        .manage(SidecarState::default())
        .manage(PersonaStore::new())
        .manage(Arc::new(SessionStore::new()))
        .manage(acp_registry)
        .invoke_handler(tauri::generate_handler![
            commands::sidecar::start_sidecar,
            commands::sidecar::stop_sidecar,
            commands::sidecar::get_sidecar_url,
            commands::sidecar::get_sidecar_secret,
            commands::sidecar::sidecar_health,
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
            commands::ui_state::save_ui_state,
            commands::ui_state::load_ui_state,
            commands::ui_state::get_home_dir,
            commands::chat::chat_send_message,
            commands::acp::discover_acp_providers,
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
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |_app, event| {
            if let tauri::RunEvent::Exit = event {
                acp_registry_for_exit.cancel_all();
            }
        });
}
