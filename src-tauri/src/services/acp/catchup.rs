use crate::types::messages::{Message, MessageContent, MessageRole};

/// Build catch-up context for a persona from intervening messages.
///
/// When the user sends a message to persona X and there have been
/// intervening messages to/from other personas since persona X last
/// responded, this function produces a context block so persona X
/// stays informed.
///
/// Returns `None` if there are no intervening messages to summarize.
pub fn build_catchup_context(
    messages: &[Message],
    persona_id: &str,
    current_message_id: &str,
) -> Option<String> {
    // Algorithm:
    // 1. Find the index of the last assistant message FROM this persona
    // 2. Collect all messages after that point, excluding:
    //    - The current user prompt being sent now
    //    - Messages from this persona itself
    // 3. Format as catch-up text
    // 4. Return None if no intervening messages

    if messages.is_empty() {
        return None;
    }

    // Find last assistant message from this persona
    let last_own_idx = messages.iter().rposition(|m| {
        matches!(m.role, MessageRole::Assistant)
            && (m
                .metadata
                .as_ref()
                .and_then(|meta| meta.persona_id.as_deref())
                == Some(persona_id))
    });

    // Start collecting from after the last own message (or from beginning)
    let start_idx = match last_own_idx {
        Some(idx) => idx + 1,
        None => 0,
    };

    let mut lines = Vec::new();

    for msg in &messages[start_idx..] {
        if msg.id == current_message_id {
            continue;
        }

        // Skip assistant messages from this persona itself
        if matches!(msg.role, MessageRole::Assistant) {
            let msg_persona_id = msg
                .metadata
                .as_ref()
                .and_then(|meta| meta.persona_id.as_deref());
            if msg_persona_id == Some(persona_id) {
                continue;
            }
        }
        let text = extract_text(msg);
        if text.is_empty() {
            continue;
        }

        let truncated = truncate_text(&text, 200);

        match msg.role {
            MessageRole::User => {
                let target_name = msg
                    .metadata
                    .as_ref()
                    .and_then(|meta| meta.target_persona_name.as_deref())
                    .unwrap_or("Unknown");
                lines.push(format!("- User \u{2192} {}: {}", target_name, truncated));
            }
            MessageRole::Assistant => {
                let name = msg
                    .metadata
                    .as_ref()
                    .and_then(|meta| meta.persona_name.as_deref().or(meta.persona_id.as_deref()))
                    .unwrap_or("Unknown");
                lines.push(format!("- {}: {}", name, truncated));
            }
            MessageRole::System => {
                lines.push(format!("- System: {}", truncated));
            }
        }
    }

    if lines.is_empty() {
        return None;
    }

    Some(format!(
        "[Context from other participants since your last message]\n{}",
        lines.join("\n")
    ))
}

/// Extract concatenated text content from a message.
fn extract_text(msg: &Message) -> String {
    msg.content
        .iter()
        .filter_map(|c| match c {
            MessageContent::Text { text } => Some(text.as_str()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// Truncate text to `max_chars` characters, appending "..." if truncated.
fn truncate_text(text: &str, max_chars: usize) -> String {
    match text.char_indices().nth(max_chars) {
        Some((byte_idx, _)) => format!("{}...", &text[..byte_idx]),
        None => text.to_string(),
    }
}
