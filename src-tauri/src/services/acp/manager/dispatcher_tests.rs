use super::*;

#[test]
fn extract_user_message_strips_xml_wrapper() {
    let wrapped = "<persona-instructions>\nYou are a helpful assistant.\n</persona-instructions>\n\n<user-message>\nhello\n</user-message>";
    assert_eq!(extract_user_message(wrapped), "hello");
}

#[test]
fn extract_user_message_multiline() {
    let wrapped = "<persona-instructions>\nstuff\n</persona-instructions>\n\n<user-message>\nline one\nline two\n</user-message>";
    assert_eq!(extract_user_message(wrapped), "line one\nline two");
}

#[test]
fn extract_user_message_no_wrapper() {
    assert_eq!(extract_user_message("plain text"), "plain text");
}
