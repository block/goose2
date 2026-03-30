mod commands;
mod services;
mod types;

use commands::sidecar::SidecarState;
use services::personas::PersonaStore;
use services::sessions::SessionStore;
use tauri_plugin_window_state::StateFlags;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::all() & !StateFlags::VISIBLE)
                .build(),
        )
        .manage(SidecarState::default())
        .manage(PersonaStore::new())
        .manage(SessionStore::new())
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
            commands::sessions::create_session,
            commands::sessions::list_sessions,
            commands::sessions::get_session_messages,
            commands::sessions::delete_session,
            commands::chat::chat_send_message,
            commands::acp::discover_acp_providers,
            commands::acp::acp_send_message,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
