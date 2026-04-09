use std::collections::{HashMap, HashSet};

use super::{needs_provider_update, ManagerState};
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
