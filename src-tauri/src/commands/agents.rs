use crate::services::personas::PersonaStore;
use crate::types::agents::*;
use tauri::State;

#[tauri::command]
pub fn list_personas(store: State<'_, PersonaStore>) -> Vec<Persona> {
    store.list()
}

#[tauri::command]
pub fn create_persona(
    store: State<'_, PersonaStore>,
    request: CreatePersonaRequest,
) -> Result<Persona, String> {
    store.create(request)
}

#[tauri::command]
pub fn update_persona(
    store: State<'_, PersonaStore>,
    id: String,
    request: UpdatePersonaRequest,
) -> Result<Persona, String> {
    store.update(&id, request)
}

#[tauri::command]
pub fn delete_persona(store: State<'_, PersonaStore>, id: String) -> Result<(), String> {
    store.delete(&id)
}
