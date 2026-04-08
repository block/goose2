// Session database access layer for export, import, and duplicate.
//
// Reads/writes the SQLite database that the goose binary manages at
// `~/.local/share/goose/sessions/sessions.db`.
//
// Types and format-parsing live in `session_types.rs`.

use chrono::Utc;
use rusqlite::{params, Connection, OpenFlags, OptionalExtension};
use std::path::PathBuf;
use uuid::Uuid;

pub(crate) use super::session_types::{
    parse_import_json, to_exported_session, ExportedMessage, MessageRow, SessionRow,
};

// ---------------------------------------------------------------------------
// DB path resolution
// ---------------------------------------------------------------------------

/// Returns the path to the goose sessions database.
///
/// The goose binary uses XDG-style paths (`~/.local/share/goose/sessions/sessions.db`)
/// regardless of platform, so we hardcode `$HOME/.local/share` rather than using
/// `dirs::data_local_dir()` (which returns `~/Library/Application Support/` on macOS).
pub fn session_db_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or_else(|| "Could not determine home directory".to_string())?;
    let path = home
        .join(".local")
        .join("share")
        .join("goose")
        .join("sessions")
        .join("sessions.db");
    if !path.exists() {
        return Err(format!("Session database not found at {}", path.display()));
    }
    Ok(path)
}

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

/// Verify that the expected columns exist in the sessions and messages tables.
fn check_schema(conn: &Connection) -> Result<(), String> {
    conn.execute_batch("SELECT thread_id FROM sessions LIMIT 0")
        .map_err(|e| {
            format!(
                "Schema check failed: sessions.thread_id column missing ({}). \
                 The database may need a migration.",
                e
            )
        })?;

    conn.execute_batch("SELECT message_id FROM messages LIMIT 0")
        .map_err(|e| {
            format!(
                "Schema check failed: messages.message_id column missing ({}). \
                 The database may need a migration.",
                e
            )
        })?;

    conn.execute_batch("SELECT id FROM threads LIMIT 0")
        .map_err(|e| {
            format!(
                "Schema check failed: threads table missing ({}). \
                 The database may need a migration.",
                e
            )
        })?;

    conn.execute_batch("SELECT thread_id FROM thread_messages LIMIT 0")
        .map_err(|e| {
            format!(
                "Schema check failed: thread_messages table missing ({}). \
                 The database may need a migration.",
                e
            )
        })?;

    Ok(())
}

// ---------------------------------------------------------------------------
// DB open helpers
// ---------------------------------------------------------------------------

fn open_readonly(db_path: &PathBuf) -> Result<Connection, String> {
    let conn = Connection::open_with_flags(db_path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|e| format!("Failed to open database read-only: {}", e))?;
    check_schema(&conn)?;
    Ok(conn)
}

fn open_readwrite(db_path: &PathBuf) -> Result<Connection, String> {
    let conn = Connection::open_with_flags(db_path, OpenFlags::SQLITE_OPEN_READ_WRITE)
        .map_err(|e| format!("Failed to open database read-write: {}", e))?;
    check_schema(&conn)?;
    Ok(conn)
}

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/// Find the DB primary key (`id`) for a session given its ACP `thread_id`.
pub fn db_id_for_thread(db_path: &PathBuf, thread_id: &str) -> Result<String, String> {
    let conn = open_readonly(db_path)?;
    conn.query_row(
        "SELECT id FROM sessions WHERE thread_id = ?1",
        params![thread_id],
        |row| row.get(0),
    )
    .map_err(|e| format!("Session with thread_id '{thread_id}' not found: {e}"))
}

/// Insert messages into an existing session (identified by DB `id`).
pub fn insert_messages(
    db_path: &PathBuf,
    db_session_id: &str,
    thread_id: &str,
    messages: &[ExportedMessage],
) -> Result<(), String> {
    let conn = open_readwrite(db_path)?;
    conn.execute_batch("BEGIN IMMEDIATE")
        .map_err(|e| format!("Failed to begin transaction: {e}"))?;

    let result = (|| -> Result<(), String> {
        for msg in messages {
            let message_id = msg
                .message_id
                .clone()
                .unwrap_or_else(|| format!("msg_{}_{}", thread_id, Uuid::new_v4()));
            let content = serde_json::to_string(&msg.content).unwrap_or_else(|_| "[]".to_string());
            let metadata = msg
                .metadata
                .as_ref()
                .and_then(|v| serde_json::to_string(v).ok());
            let thread_metadata = metadata.clone().unwrap_or_else(|| "{}".to_string());
            let created_timestamp = msg.created_timestamp.unwrap_or(0);

            conn.execute(
                "INSERT INTO messages (
                    message_id, session_id, role, content_json, created_timestamp, metadata_json
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    message_id.clone(),
                    db_session_id,
                    msg.role.clone(),
                    content.clone(),
                    created_timestamp,
                    metadata.clone()
                ],
            )
            .map_err(|e| format!("Failed to insert message: {e}"))?;

            conn.execute(
                "INSERT INTO thread_messages (
                    thread_id, session_id, message_id, role, content_json, created_timestamp, metadata_json
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    thread_id,
                    db_session_id,
                    message_id,
                    msg.role.clone(),
                    content,
                    created_timestamp,
                    thread_metadata
                ],
            )
            .map_err(|e| format!("Failed to insert message: {e}"))?;
        }

        conn.execute(
            "UPDATE threads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
            params![thread_id],
        )
        .map_err(|e| format!("Failed to update thread timestamp: {e}"))?;

        Ok(())
    })();

    match result {
        Ok(()) => {
            conn.execute_batch("COMMIT")
                .map_err(|e| format!("Failed to commit: {e}"))?;
            Ok(())
        }
        Err(e) => {
            let _ = conn.execute_batch("ROLLBACK");
            Err(e)
        }
    }
}

/// Update a session's name in the database.
pub fn update_session_name(
    db_path: &PathBuf,
    db_session_id: &str,
    name: &str,
) -> Result<(), String> {
    let conn = open_readwrite(db_path)?;
    let now = Utc::now().to_rfc3339();
    conn.execute_batch("BEGIN IMMEDIATE")
        .map_err(|e| format!("Failed to begin transaction: {e}"))?;

    let result = (|| -> Result<(), String> {
        conn.execute(
            "UPDATE sessions
             SET name = ?1, user_set_name = TRUE, updated_at = ?2
             WHERE id = ?3",
            params![name, now, db_session_id],
        )
        .map_err(|e| format!("Failed to update session name: {e}"))?;

        conn.execute(
            "UPDATE threads
             SET name = ?1, user_set_name = TRUE, updated_at = CURRENT_TIMESTAMP
             WHERE id = (SELECT thread_id FROM sessions WHERE id = ?2)",
            params![name, db_session_id],
        )
        .map_err(|e| format!("Failed to update thread name: {e}"))?;

        Ok(())
    })();

    match result {
        Ok(()) => {
            conn.execute_batch("COMMIT")
                .map_err(|e| format!("Failed to commit: {e}"))?;
        }
        Err(e) => {
            let _ = conn.execute_batch("ROLLBACK");
            return Err(e);
        }
    }

    Ok(())
}

/// Repair imported sessions created by the hybrid path before `thread_messages`
/// were populated.
pub fn backfill_thread_messages_if_missing(
    db_path: &PathBuf,
    thread_id: &str,
) -> Result<(), String> {
    let conn = open_readwrite(db_path)?;
    conn.execute_batch("BEGIN IMMEDIATE")
        .map_err(|e| format!("Failed to begin transaction: {e}"))?;

    let result = (|| -> Result<(), String> {
        let thread_message_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM thread_messages WHERE thread_id = ?1",
                params![thread_id],
                |row| row.get(0),
            )
            .map_err(|e| format!("Failed to count thread messages: {e}"))?;

        if thread_message_count > 0 {
            return Ok(());
        }

        let session_row: Option<(String, Option<String>, Option<bool>)> = conn
            .query_row(
                "SELECT id, name, user_set_name
                 FROM sessions
                 WHERE thread_id = ?1
                 ORDER BY created_at DESC
                 LIMIT 1",
                params![thread_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .optional()
            .map_err(|e| format!("Failed to find session for thread '{thread_id}': {e}"))?;

        let Some((db_session_id, session_name, user_set_name)) = session_row else {
            return Ok(());
        };

        let mut stmt = conn
            .prepare(
                "SELECT message_id, role, content_json, created_timestamp, metadata_json
                 FROM messages
                 WHERE session_id = ?1
                 ORDER BY created_timestamp ASC, id ASC",
            )
            .map_err(|e| format!("Failed to prepare backfill query: {e}"))?;

        let rows = stmt
            .query_map(params![&db_session_id], |row| {
                Ok((
                    row.get::<_, Option<String>>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<i64>>(3)?,
                    row.get::<_, Option<String>>(4)?,
                ))
            })
            .map_err(|e| format!("Failed to query session messages: {e}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to read session messages: {e}"))?;

        if rows.is_empty() {
            return Ok(());
        }

        for (message_id, role, content_json, created_timestamp, metadata_json) in rows {
            conn.execute(
                "INSERT INTO thread_messages (
                    thread_id, session_id, message_id, role, content_json, created_timestamp, metadata_json
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    thread_id,
                    db_session_id,
                    message_id.unwrap_or_else(|| format!("msg_{}_{}", thread_id, Uuid::new_v4())),
                    role,
                    content_json.unwrap_or_else(|| "[]".to_string()),
                    created_timestamp.unwrap_or(0),
                    metadata_json.unwrap_or_else(|| "{}".to_string()),
                ],
            )
            .map_err(|e| format!("Failed to backfill thread message: {e}"))?;
        }

        if user_set_name.unwrap_or(false) {
            let name = session_name.unwrap_or_else(|| "New Chat".to_string());
            conn.execute(
                "UPDATE threads
                 SET name = ?1, user_set_name = ?2, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?3",
                params![name, true, thread_id],
            )
            .map_err(|e| format!("Failed to sync thread name: {e}"))?;
        }

        Ok(())
    })();

    match result {
        Ok(()) => {
            conn.execute_batch("COMMIT")
                .map_err(|e| format!("Failed to commit: {e}"))?;
            Ok(())
        }
        Err(e) => {
            let _ = conn.execute_batch("ROLLBACK");
            Err(e)
        }
    }
}

// ---------------------------------------------------------------------------
// Read session from DB
// ---------------------------------------------------------------------------

/// Read a session and its messages from the database.
///
/// Tries the `sessions` table first (by `id` or `thread_id`). If not found,
/// falls back to the `threads` + `thread_messages` tables, which the goose
/// binary uses for newer sessions.
pub fn read_session(
    db_path: &PathBuf,
    session_id: &str,
) -> Result<(SessionRow, Vec<MessageRow>), String> {
    let conn = open_readonly(db_path)?;

    // Try sessions table first
    let session_result = conn.query_row(
        "SELECT id, name, description, user_set_name, session_type,
                working_dir, created_at, updated_at, extension_data,
                total_tokens, input_tokens, output_tokens,
                accumulated_total_tokens, accumulated_input_tokens,
                accumulated_output_tokens, schedule_id, recipe_json,
                user_recipe_values_json, provider_name, model_config_json,
                project_id, goose_mode, thread_id
         FROM sessions WHERE id = ?1 OR thread_id = ?1",
        params![session_id],
        |row| {
            Ok(SessionRow {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                user_set_name: row.get(3)?,
                session_type: row.get(4)?,
                working_dir: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
                extension_data: row.get(8)?,
                total_tokens: row.get(9)?,
                input_tokens: row.get(10)?,
                output_tokens: row.get(11)?,
                accumulated_total_tokens: row.get(12)?,
                accumulated_input_tokens: row.get(13)?,
                accumulated_output_tokens: row.get(14)?,
                schedule_id: row.get(15)?,
                recipe_json: row.get(16)?,
                user_recipe_values_json: row.get(17)?,
                provider_name: row.get(18)?,
                model_config_json: row.get(19)?,
                project_id: row.get(20)?,
                goose_mode: row.get(21)?,
                thread_id: row.get(22)?,
            })
        },
    );

    if let Ok(session) = session_result {
        // Found in sessions table — read messages from messages table
        let mut stmt = conn
            .prepare(
                "SELECT id, message_id, session_id, role, content_json,
                        created_timestamp, timestamp, tokens, metadata_json
                 FROM messages
                 WHERE session_id = ?1
                 ORDER BY created_timestamp ASC, id ASC",
            )
            .map_err(|e| format!("Failed to prepare message query: {e}"))?;

        let messages = stmt
            .query_map(params![&session.id], |row| {
                Ok(MessageRow {
                    id: row.get(0)?,
                    message_id: row.get(1)?,
                    session_id: row.get(2)?,
                    role: row.get(3)?,
                    content_json: row.get(4)?,
                    created_timestamp: row.get(5)?,
                    timestamp: row.get(6)?,
                    tokens: row.get(7)?,
                    metadata_json: row.get(8)?,
                })
            })
            .map_err(|e| format!("Failed to query messages: {e}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to read message rows: {e}"))?;

        return Ok((session, messages));
    }

    // Fallback: read from threads + thread_messages tables
    let thread = conn
        .query_row(
            "SELECT id, name, created_at, updated_at, user_set_name
             FROM threads WHERE id = ?1",
            params![session_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<bool>>(4)?,
                ))
            },
        )
        .map_err(|e| format!("Session '{session_id}' not found in sessions or threads: {e}"))?;

    let (thread_id, name, created_at, updated_at, user_set_name) = thread;

    // Build a SessionRow from thread data (with sensible defaults for missing fields)
    let session = SessionRow {
        id: thread_id.clone(),
        name,
        description: None,
        user_set_name: Some(user_set_name.unwrap_or(false)),
        session_type: Some("acp".to_string()),
        working_dir: None,
        created_at,
        updated_at,
        extension_data: Some("{}".to_string()),
        total_tokens: None,
        input_tokens: None,
        output_tokens: None,
        accumulated_total_tokens: None,
        accumulated_input_tokens: None,
        accumulated_output_tokens: None,
        schedule_id: None,
        recipe_json: None,
        user_recipe_values_json: None,
        provider_name: None,
        model_config_json: None,
        project_id: None,
        goose_mode: None,
        thread_id: Some(thread_id.clone()),
    };

    // Read messages from thread_messages
    let mut stmt = conn
        .prepare(
            "SELECT 0, message_id, session_id, role, content_json,
                    created_timestamp, NULL, NULL, metadata_json
             FROM thread_messages
             WHERE thread_id = ?1
             ORDER BY created_timestamp ASC",
        )
        .map_err(|e| format!("Failed to prepare thread_messages query: {e}"))?;

    let messages = stmt
        .query_map(params![&thread_id], |row| {
            Ok(MessageRow {
                id: row.get(0)?,
                message_id: row.get(1)?,
                session_id: row.get(2)?,
                role: row.get(3)?,
                content_json: row.get(4)?,
                created_timestamp: row.get(5)?,
                timestamp: row.get(6)?,
                tokens: row.get(7)?,
                metadata_json: row.get(8)?,
            })
        })
        .map_err(|e| format!("Failed to query thread_messages: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read thread_messages: {e}"))?;

    Ok((session, messages))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn session_db_path_returns_expected_location() {
        let result = session_db_path();
        match result {
            Ok(path) => {
                let path_str = path.to_string_lossy();
                assert!(
                    path_str.contains("goose/sessions/sessions.db"),
                    "Path should contain goose/sessions/sessions.db, got: {}",
                    path_str
                );
            }
            Err(msg) => {
                assert!(
                    msg.contains("goose/sessions/sessions.db")
                        || msg.contains("local data directory"),
                    "Error should reference expected path, got: {}",
                    msg
                );
            }
        }
    }
}
