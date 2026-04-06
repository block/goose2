use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct WidgetRegistry {
    paths: Mutex<HashMap<String, PathBuf>>,
}

impl WidgetRegistry {
    pub fn new() -> Self {
        Self {
            paths: Mutex::new(HashMap::new()),
        }
    }

    pub fn register(&self, id: &str, path: PathBuf) {
        let mut paths = self.paths.lock().unwrap();
        paths.insert(id.to_string(), path);
    }

    pub fn clear(&self) {
        let mut paths = self.paths.lock().unwrap();
        paths.clear();
    }

    pub fn get_path(&self, id: &str) -> Option<PathBuf> {
        let paths = self.paths.lock().unwrap();
        paths.get(id).cloned()
    }
}
