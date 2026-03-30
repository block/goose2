use std::fs;
use std::path::PathBuf;

fn skills_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not determine home directory")?;
    Ok(home.join(".goose").join("skills"))
}

/// Validates that a skill name is kebab-case only: `^[a-z0-9]+(-[a-z0-9]+)*$`.
/// This prevents path traversal attacks (e.g. `../../.ssh/authorized_keys`).
fn validate_skill_name(name: &str) -> Result<(), String> {
    if name.is_empty() {
        return Err("Skill name must not be empty".to_string());
    }
    let mut expect_alnum = true; // true = next char must be [a-z0-9], false = can also be '-'
    for ch in name.chars() {
        if ch.is_ascii_lowercase() || ch.is_ascii_digit() {
            expect_alnum = false;
        } else if ch == '-' && !expect_alnum {
            expect_alnum = true; // char after '-' must be [a-z0-9]
        } else {
            return Err(format!(
                "Invalid skill name \"{}\". Names must be kebab-case (lowercase letters, digits, and hyphens; \
                 must not start or end with a hyphen or contain consecutive hyphens).",
                name
            ));
        }
    }
    if expect_alnum {
        // name ended with '-'
        return Err(format!(
            "Invalid skill name \"{}\". Names must not end with a hyphen.",
            name
        ));
    }
    Ok(())
}

fn build_skill_md(name: &str, description: &str, instructions: &str) -> String {
    // Escape embedded single quotes by doubling them, then wrap in single quotes
    // to prevent YAML injection in the description field.
    let safe_desc = description.replace('\'', "''");
    let mut md = format!(
        "---\nname: {}\ndescription: '{}'\n---\n",
        name, safe_desc
    );
    if !instructions.is_empty() {
        md.push('\n');
        md.push_str(instructions);
        md.push('\n');
    }
    md
}

#[tauri::command]
pub fn create_skill(name: String, description: String, instructions: String) -> Result<(), String> {
    validate_skill_name(&name)?;
    let dir = skills_dir()?.join(&name);

    if dir.exists() {
        return Err(format!("A skill named \"{}\" already exists", name));
    }

    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create skill directory: {}", e))?;

    let skill_path = dir.join("SKILL.md");
    let content = build_skill_md(&name, &description, &instructions);

    fs::write(&skill_path, content)
        .map_err(|e| format!("Failed to write SKILL.md: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn list_skills() -> Result<Vec<SkillInfo>, String> {
    let dir = skills_dir()?;

    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut skills = Vec::new();
    let entries = fs::read_dir(&dir).map_err(|e| format!("Failed to read skills dir: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let skill_md = path.join("SKILL.md");
        if !skill_md.exists() {
            continue;
        }

        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        let raw = fs::read_to_string(&skill_md).unwrap_or_default();
        let (description, instructions) = parse_frontmatter(&raw);

        skills.push(SkillInfo {
            name,
            description,
            instructions,
            path: skill_md.to_string_lossy().to_string(),
        });
    }

    skills.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(skills)
}

#[tauri::command]
pub fn delete_skill(name: String) -> Result<(), String> {
    validate_skill_name(&name)?;
    let dir = skills_dir()?.join(&name);
    if !dir.exists() {
        return Err(format!("Skill \"{}\" not found", name));
    }
    fs::remove_dir_all(&dir).map_err(|e| format!("Failed to delete skill: {}", e))?;
    Ok(())
}

fn parse_frontmatter(raw: &str) -> (String, String) {
    let trimmed = raw.trim();
    if !trimmed.starts_with("---") {
        return (String::new(), raw.to_string());
    }

    if let Some(end) = trimmed[3..].find("\n---") {
        let front = &trimmed[3..3 + end].trim();
        let body = trimmed[3 + end + 4..].trim().to_string();

        let mut description = String::new();
        for line in front.lines() {
            let line = line.trim();
            if line.starts_with("description:") {
                let val = line["description:".len()..].trim();
                // Strip surrounding quotes (single or double)
                let unquoted = val
                    .trim_start_matches(|c| c == '\'' || c == '"')
                    .trim_end_matches(|c| c == '\'' || c == '"');
                description = if val.starts_with('\'') {
                    // Un-escape doubled single quotes
                    unquoted.replace("''", "'")
                } else {
                    // Legacy double-quote format
                    unquoted.replace("\\\"", "\"")
                }
                .to_string();
            }
        }

        (description, body)
    } else {
        (String::new(), raw.to_string())
    }
}

#[derive(serde::Serialize, Clone)]
pub struct SkillInfo {
    pub name: String,
    pub description: String,
    pub instructions: String,
    pub path: String,
}
