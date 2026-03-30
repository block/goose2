use crate::types::agents::{builtin_personas, CreatePersonaRequest, Persona, UpdatePersonaRequest};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct PersonaStore {
    personas: Mutex<Vec<Persona>>,
    store_path: PathBuf,
}

impl PersonaStore {
    pub fn new() -> Self {
        let store_path = Self::store_path();
        let stored = Self::load_from_disk(&store_path);
        let merged = Self::merge_with_builtins(stored);
        Self {
            personas: Mutex::new(merged),
            store_path,
        }
    }

    fn store_path() -> PathBuf {
        let base = dirs::home_dir().expect("home dir");
        base.join(".goose").join("personas.json")
    }

    fn load_from_disk(path: &PathBuf) -> Vec<Persona> {
        match std::fs::read_to_string(path) {
            Ok(contents) => serde_json::from_str(&contents).unwrap_or_default(),
            Err(_) => Vec::new(),
        }
    }

    fn merge_with_builtins(stored: Vec<Persona>) -> Vec<Persona> {
        let builtins = builtin_personas();
        let builtin_ids: std::collections::HashSet<String> =
            builtins.iter().map(|p| p.id.clone()).collect();

        let mut result = builtins;

        // Add custom (non-builtin) personas from disk
        for persona in stored {
            if !builtin_ids.contains(&persona.id) {
                result.push(persona);
            }
        }

        result
    }

    fn save_to_disk(&self, personas: &[Persona]) {
        if let Some(parent) = self.store_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        // Only persist custom personas (not builtins)
        let custom: Vec<&Persona> = personas.iter().filter(|p| !p.is_builtin).collect();
        if let Ok(json) = serde_json::to_string_pretty(&custom) {
            let _ = std::fs::write(&self.store_path, json);
        }
    }

    pub fn list(&self) -> Vec<Persona> {
        let personas = self.personas.lock().unwrap();
        personas.clone()
    }

    pub fn get(&self, id: &str) -> Option<Persona> {
        let personas = self.personas.lock().unwrap();
        personas.iter().find(|p| p.id == id).cloned()
    }

    pub fn create(&self, req: CreatePersonaRequest) -> Result<Persona, String> {
        let now = chrono::Utc::now().to_rfc3339();
        let persona = Persona {
            id: uuid::Uuid::new_v4().to_string(),
            display_name: req.display_name,
            avatar_url: req.avatar_url,
            system_prompt: req.system_prompt,
            provider: req.provider,
            model: req.model,
            is_builtin: false,
            created_at: now.clone(),
            updated_at: now,
        };

        let mut personas = self.personas.lock().unwrap();
        personas.push(persona.clone());
        self.save_to_disk(&personas);
        Ok(persona)
    }

    pub fn update(&self, id: &str, req: UpdatePersonaRequest) -> Result<Persona, String> {
        let mut personas = self.personas.lock().unwrap();
        let persona = personas
            .iter_mut()
            .find(|p| p.id == id)
            .ok_or_else(|| format!("Persona '{}' not found", id))?;

        if persona.is_builtin {
            return Err("Cannot update a built-in persona".to_string());
        }

        if let Some(name) = req.display_name {
            persona.display_name = name;
        }
        if let Some(avatar) = req.avatar_url {
            persona.avatar_url = Some(avatar);
        }
        if let Some(prompt) = req.system_prompt {
            persona.system_prompt = prompt;
        }
        if let Some(provider) = req.provider {
            persona.provider = Some(provider);
        }
        if let Some(model) = req.model {
            persona.model = Some(model);
        }
        persona.updated_at = chrono::Utc::now().to_rfc3339();

        let updated = persona.clone();
        self.save_to_disk(&personas);
        Ok(updated)
    }

    pub fn delete(&self, id: &str) -> Result<(), String> {
        let mut personas = self.personas.lock().unwrap();

        let persona = personas
            .iter()
            .find(|p| p.id == id)
            .ok_or_else(|| format!("Persona '{}' not found", id))?;

        if persona.is_builtin {
            return Err("Cannot delete a built-in persona".to_string());
        }

        personas.retain(|p| p.id != id);
        self.save_to_disk(&personas);
        Ok(())
    }
}
