use std::collections::{HashMap, HashSet};

use std::path::PathBuf;

use super::{
    needs_provider_update, prepared_session_for_key, register_prepared_session_keys, ManagerState,
    PreparedSession,
};
use crate::services::acp::split_composite_key;

#[test]
fn provider_update_detects_switch_back_to_goose() {
    assert!(needs_provider_update(Some("openai"), "goose"));
    assert!(needs_provider_update(Some("claude-acp"), "goose"));
    assert!(!needs_provider_update(Some("goose"), "goose"));
    assert!(needs_provider_update(None, "goose"));
}

#[test]
fn pending_cancel_is_consumed_once() {
    let mut state = ManagerState {
        sessions: HashMap::new(),
        op_locks: HashMap::new(),
        pending_cancels: HashSet::new(),
        preparing_sessions: HashSet::new(),
    };

    state.mark_cancel_requested("session-1");

    assert!(state.take_cancel_requested("session-1"));
    assert!(!state.take_cancel_requested("session-1"));
}

#[test]
fn split_composite_key_extracts_local_session_id() {
    assert_eq!(
        split_composite_key("session-1__persona-1"),
        ("session-1", Some("persona-1"))
    );
    assert_eq!(split_composite_key("session-1"), ("session-1", None));
}

#[test]
fn prepared_session_lookup_falls_back_to_local_session_id() {
    let mut sessions = HashMap::new();
    sessions.insert(
        "session-1".to_string(),
        PreparedSession {
            goose_session_id: "goose-1".to_string(),
            provider_id: "goose".to_string(),
            working_dir: PathBuf::from("/tmp/project"),
        },
    );

    let prepared = prepared_session_for_key(&sessions, "session-1__persona-1", "session-1")
        .expect("prepared session");

    assert_eq!(prepared.goose_session_id, "goose-1");
    assert_eq!(prepared.provider_id, "goose");
    assert_eq!(prepared.working_dir, PathBuf::from("/tmp/project"));
}

#[test]
fn register_prepared_session_keys_preserves_composite_and_local_entries() {
    let mut sessions = HashMap::new();
    let prepared = PreparedSession {
        goose_session_id: "goose-1".to_string(),
        provider_id: "goose".to_string(),
        working_dir: PathBuf::from("/tmp/project"),
    };

    register_prepared_session_keys(&mut sessions, "session-1__persona-1", "session-1", prepared);

    assert!(sessions.contains_key("session-1__persona-1"));
    assert!(sessions.contains_key("session-1"));
    assert_eq!(
        sessions
            .get("session-1__persona-1")
            .expect("composite session")
            .goose_session_id,
        "goose-1"
    );
}
