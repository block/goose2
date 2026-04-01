use serde::{Deserialize, Deserializer, Serialize};

/// Avatar for a persona — either a remote URL or a local file in ~/.goose/avatars/.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "value")]
pub enum Avatar {
    #[serde(rename = "url")]
    Url(String),
    #[serde(rename = "local")]
    Local(String),
}

/// Custom deserializer that handles migration from old format.
/// Accepts:
///   - null                              → None
///   - "https://..."  (bare string)      → Some(Avatar::Url(s))
///   - { "type": "url", "value": "..." } → Some(Avatar::Url(...))
///   - { "type": "local", "value": "x" } → Some(Avatar::Local(...))
fn deserialize_avatar_compat<'de, D>(deserializer: D) -> Result<Option<Avatar>, D::Error>
where
    D: Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum AvatarOrString {
        Avatar(Avatar),
        BareString(String),
    }

    let opt: Option<AvatarOrString> = Option::deserialize(deserializer)?;
    match opt {
        None => Ok(None),
        Some(AvatarOrString::BareString(s)) => {
            if s.is_empty() {
                Ok(None)
            } else {
                Ok(Some(Avatar::Url(s)))
            }
        }
        Some(AvatarOrString::Avatar(a)) => Ok(Some(a)),
    }
}

/// Deserializer for UpdatePersonaRequest: distinguishes "field absent" from "field: null".
/// - JSON field absent          → None        (don't update)
/// - "avatar": null             → Some(None)  (clear the avatar)
/// - "avatar": {...} or "str"   → Some(Some(Avatar))
fn deserialize_avatar_update<'de, D>(deserializer: D) -> Result<Option<Option<Avatar>>, D::Error>
where
    D: Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum AvatarOrString {
        Avatar(Avatar),
        BareString(String),
    }

    let opt: Option<AvatarOrString> = Option::deserialize(deserializer)?;
    match opt {
        None => Ok(Some(None)), // explicit null → clear
        Some(AvatarOrString::BareString(s)) => {
            if s.is_empty() {
                Ok(Some(None))
            } else {
                Ok(Some(Some(Avatar::Url(s))))
            }
        }
        Some(AvatarOrString::Avatar(a)) => Ok(Some(Some(a))),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Persona {
    pub id: String,
    pub display_name: String,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        alias = "avatarUrl",
        deserialize_with = "deserialize_avatar_compat"
    )]
    pub avatar: Option<Avatar>,
    pub system_prompt: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    pub is_builtin: bool,
    #[serde(default)]
    pub is_from_disk: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePersonaRequest {
    pub display_name: String,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_avatar_compat"
    )]
    pub avatar: Option<Avatar>,
    pub system_prompt: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePersonaRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_avatar_update"
    )]
    pub avatar: Option<Option<Avatar>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Agent {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub persona_id: Option<String>,
    pub provider: String,
    pub model: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_prompt: Option<String>,
    pub connection_type: String,
    pub status: String,
    pub is_builtin: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub acp_endpoint: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub project_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub provider_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub persona_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub model_name: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub message_count: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_message_preview: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub archived_at: Option<String>,
}

/// Partial update for a session — only provided fields are applied.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionUpdate {
    pub title: Option<String>,
    pub provider_id: Option<String>,
    pub persona_id: Option<String>,
    pub model_name: Option<String>,
    #[serde(default, deserialize_with = "deserialize_nullable_field")]
    pub project_id: Option<Option<String>>,
}

fn deserialize_nullable_field<'de, D, T>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    Option::<Option<T>>::deserialize(deserializer)
}

/// Built-in persona definitions
pub fn builtin_personas() -> Vec<Persona> {
    let now = chrono::Utc::now().to_rfc3339();
    vec![
        Persona {
            id: "builtin-goose".to_string(),
            display_name: "Goose".to_string(),
            avatar: None,
            system_prompt: "You are Goose, a helpful AI coding assistant. You help users write, debug, and understand code. You are direct, concise, and prefer showing code over describing it. You have access to tools for reading files, running commands, and searching codebases.".to_string(),
            provider: Some("goose".to_string()),
            model: Some("claude-sonnet-4-20250514".to_string()),
            is_builtin: true,
            is_from_disk: false,
            created_at: now.clone(),
            updated_at: now.clone(),
        },
        Persona {
            id: "builtin-researcher".to_string(),
            display_name: "Scout".to_string(),
            avatar: None,
            system_prompt: "You are Scout, a research-focused AI assistant. You follow a Research-Plan-Implement pattern: first thoroughly research the problem space, then create a detailed plan, and finally implement the solution. You excel at exploring codebases, finding patterns, and synthesizing information from multiple sources.".to_string(),
            provider: Some("goose".to_string()),
            model: Some("claude-sonnet-4-20250514".to_string()),
            is_builtin: true,
            is_from_disk: false,
            created_at: now.clone(),
            updated_at: now.clone(),
        },
        Persona {
            id: "builtin-reviewer".to_string(),
            display_name: "Reviewer".to_string(),
            avatar: None,
            system_prompt: "You are Reviewer, a code review specialist. You analyze code changes for correctness, security vulnerabilities, performance issues, and adherence to best practices. You provide actionable feedback with specific suggestions for improvement. You check for edge cases, error handling, and test coverage.".to_string(),
            provider: Some("goose".to_string()),
            model: Some("claude-sonnet-4-20250514".to_string()),
            is_builtin: true,
            is_from_disk: false,
            created_at: now.clone(),
            updated_at: now.clone(),
        },
        Persona {
            id: "builtin-architect".to_string(),
            display_name: "Architect".to_string(),
            avatar: None,
            system_prompt: "You are Architect, a system design specialist. You help users design software architectures, make technology choices, and plan complex implementations. You think in terms of components, interfaces, data flow, and trade-offs. You consider scalability, maintainability, and simplicity.".to_string(),
            provider: Some("goose".to_string()),
            model: Some("claude-sonnet-4-20250514".to_string()),
            is_builtin: true,
            is_from_disk: false,
            created_at: now.clone(),
            updated_at: now,
        },
    ]
}
