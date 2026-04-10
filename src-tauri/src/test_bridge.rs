#![allow(dead_code)]

use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, WebviewWindow};

/// A command sent from the test script over TCP
#[derive(Deserialize, Debug)]
struct TestCommand {
    action: String,
    selector: Option<String>,
    value: Option<String>,
}

/// The result sent back to the test script
#[derive(Serialize)]
struct TestResult {
    success: bool,
    data: Option<String>,
    error: Option<String>,
}

/// Tauri command that receives results from JS eval via invoke().
/// The injected JS calls this command with the eval result.
#[tauri::command]
pub fn bridge_result(state: tauri::State<'_, BridgeState>, value: String) {
    if let Ok(mut result) = state.pending_result.lock() {
        *result = Some(value);
    }
    state.notify.0.lock().unwrap().take();
    state.notify.1.notify_one();
}

/// Shared state for passing results from JS back to the TCP handler
pub struct BridgeState {
    pub pending_result: Mutex<Option<String>>,
    pub notify: (Mutex<Option<()>>, std::sync::Condvar),
}

impl BridgeState {
    pub fn new() -> Self {
        Self {
            pending_result: Mutex::new(None),
            notify: (Mutex::new(Some(())), std::sync::Condvar::new()),
        }
    }

    fn wait_for_result(&self) -> Option<String> {
        let (lock, cvar) = &self.notify;
        let guard = lock.lock().unwrap();
        let _result = cvar
            .wait_timeout(guard, std::time::Duration::from_secs(5))
            .unwrap();
        self.pending_result.lock().unwrap().take()
    }

    fn reset(&self) {
        *self.pending_result.lock().unwrap() = None;
        *self.notify.0.lock().unwrap() = Some(());
    }
}

/// Wrap an action in a retry loop that waits for an element to appear
fn with_wait_for(selector: &str, action_js: &str) -> String {
    format!(
        r#"(async function() {{
            const start = Date.now();
            while (Date.now() - start < 5000) {{
                const el = document.querySelector("{}");
                if (el) {{
                    {}
                }}
                await new Promise(r => setTimeout(r, 100));
            }}
            return "ERROR: timeout waiting for element: {}";
        }})()"#,
        selector, action_js, selector
    )
}

/// Build the JS to execute for each command, wrapped to send result back via invoke()
fn build_js(cmd: &TestCommand) -> String {
    let inner_js = match cmd.action.as_str() {
        "snapshot" => r#"
            (function() {
                const result = [];
                let eIdx = 0;
                let tIdx = 0;

                function isVisible(el) {
                    const style = window.getComputedStyle(el);
                    return style.display !== 'none'
                        && style.visibility !== 'hidden'
                        && style.opacity !== '0';
                }

                function isInteractive(tag) {
                    return ['INPUT','BUTTON','SELECT','TEXTAREA','A'].includes(tag);
                }

                function walk(node, depth) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const tag = node.tagName;
                        if (['SCRIPT','STYLE','META','LINK','NOSCRIPT'].includes(tag)) return;
                        if (!isVisible(node)) return;

                        const indent = '  '.repeat(depth);
                        const tagLower = tag.toLowerCase();

                        if (isInteractive(tag)) {
                            eIdx++;
                            node.setAttribute('data-tid', 'e' + eIdx);
                            let info = '[e' + eIdx + '] ' + tagLower;
                            if (node.type) info += ' type="' + node.type + '"';
                            if (node.placeholder) info += ' placeholder="' + node.placeholder + '"';
                            if (node.value) info += ' value="' + node.value + '"';
                            if (node.href) info += ' href="' + node.href + '"';
                            const text = node.innerText?.trim();
                            if (text && text.length < 100) info += ' "' + text + '"';
                            result.push(indent + info);
                        } else {
                            const directText = Array.from(node.childNodes)
                                .filter(n => n.nodeType === Node.TEXT_NODE)
                                .map(n => n.textContent.trim())
                                .join(' ')
                                .trim();
                            if (directText && directText.length > 0 && directText.length < 200) {
                                tIdx++;
                                result.push(indent + '[t' + tIdx + '] ' + tagLower + ' "' + directText + '"');
                            }
                        }

                        for (const child of node.children) {
                            walk(child, depth + 1);
                        }
                    }
                }

                walk(document.body, 0);
                return result.join('\n');
            })()
        "#.to_string(),

        "click" => {
            let sel = cmd.selector.as_deref().unwrap_or("body");
            with_wait_for(sel, r#"el.click(); return "clicked";"#)
        }

        "fill" => {
            let sel = cmd.selector.as_deref().unwrap_or("input");
            let val = cmd.value.as_deref().unwrap_or("");
            with_wait_for(sel, &format!(
                r#"const proto = el instanceof HTMLTextAreaElement
                    ? HTMLTextAreaElement.prototype
                    : HTMLInputElement.prototype;
                const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
                setter.call(el, "{}");
                el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                return "filled";"#,
                val
            ))
        }

        "getText" => {
            let sel = cmd.selector.as_deref().unwrap_or("body");
            with_wait_for(sel, "return el.innerText;")
        }

        "scroll" => {
            let direction = cmd.value.as_deref().unwrap_or("down");
            match direction {
                "up" => "window.scrollBy(0, -window.innerHeight); 'scrolled up'".to_string(),
                "top" => "window.scrollTo(0, 0); 'scrolled to top'".to_string(),
                "bottom" => "window.scrollTo(0, document.body.scrollHeight); 'scrolled to bottom'".to_string(),
                _ => "window.scrollBy(0, window.innerHeight); 'scrolled down'".to_string(),
            }
        }

        _ => format!("'unknown action: {}'", cmd.action),
    };

    format!(
        r#"
        (async function() {{
            try {{
                const result = await Promise.resolve({inner_js});
                await window.__TAURI_INTERNALS__.invoke('bridge_result', {{ value: String(result) }});
            }} catch(e) {{
                await window.__TAURI_INTERNALS__.invoke('bridge_result', {{ value: 'ERROR: ' + e.message }});
            }}
        }})();
        "#
    )
}

/// Get the macOS NSWindow number for screencapture -l
#[cfg(all(target_os = "macos", feature = "test-bridge"))]
fn get_ns_window_number(window: &WebviewWindow) -> Option<u32> {
    let ns_window_ptr = window.ns_window().ok()?;
    let ns_window = unsafe { &*(ns_window_ptr as *const objc2_app_kit::NSWindow) };
    Some(ns_window.windowNumber() as u32)
}

/// Take a screenshot of the app window using macOS screencapture
#[cfg(all(target_os = "macos", feature = "test-bridge"))]
fn take_screenshot(window: &WebviewWindow, path: &str) -> TestResult {
    if let Some(parent) = std::path::Path::new(path).parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let window_id = match get_ns_window_number(window) {
        Some(id) => id,
        None => {
            return TestResult {
                success: false,
                data: None,
                error: Some("Failed to get window ID".into()),
            };
        }
    };

    match std::process::Command::new("screencapture")
        .args(["-x", "-l", &window_id.to_string(), path])
        .output()
    {
        Ok(output) if output.status.success() => TestResult {
            success: true,
            data: Some(format!("Screenshot saved to {}", path)),
            error: None,
        },
        Ok(output) => TestResult {
            success: false,
            data: None,
            error: Some(format!(
                "screencapture failed: {}",
                String::from_utf8_lossy(&output.stderr)
            )),
        },
        Err(e) => TestResult {
            success: false,
            data: None,
            error: Some(format!("Failed to run screencapture: {}", e)),
        },
    }
}

/// Start the TCP server in a background thread
pub fn start_test_bridge(app_handle: AppHandle) {
    std::thread::spawn(move || {
        let listener = match TcpListener::bind("127.0.0.1:9999") {
            Ok(l) => l,
            Err(e) => {
                eprintln!("[test-bridge] Failed to bind: {}", e);
                return;
            }
        };
        log::info!("[test-bridge] Listening on 127.0.0.1:9999");

        for stream in listener.incoming() {
            let Ok(mut stream) = stream else { continue };
            let app = app_handle.clone();

            std::thread::spawn(move || {
                let reader = BufReader::new(stream.try_clone().unwrap());

                for line in reader.lines() {
                    let Ok(line) = line else { break };
                    if line.trim().is_empty() { continue; }

                    let cmd: TestCommand = match serde_json::from_str(&line) {
                        Ok(c) => c,
                        Err(e) => {
                            let resp = TestResult {
                                success: false,
                                data: None,
                                error: Some(format!("Invalid JSON: {}", e)),
                            };
                            let _ = writeln!(stream, "{}", serde_json::to_string(&resp).unwrap());
                            continue;
                        }
                    };

                    log::info!("[test-bridge] Received: {:?}", cmd);

                    let window: WebviewWindow = match app.get_webview_window("main") {
                        Some(w) => w,
                        None => {
                            let resp = TestResult {
                                success: false,
                                data: None,
                                error: Some("Main window not found".into()),
                            };
                            let _ = writeln!(stream, "{}", serde_json::to_string(&resp).unwrap());
                            continue;
                        }
                    };

                    // Screenshot is handled natively, not via JS eval
                    #[cfg(all(target_os = "macos", feature = "test-bridge"))]
                    if cmd.action == "screenshot" {
                        let path = cmd.value.as_deref().unwrap_or("screenshot.png");
                        let resp = take_screenshot(&window, path);
                        let _ = writeln!(stream, "{}", serde_json::to_string(&resp).unwrap());
                        continue;
                    }

                    let state = app.state::<BridgeState>();
                    state.reset();

                    let js = build_js(&cmd);
                    if let Err(e) = window.eval(&js) {
                        let resp = TestResult {
                            success: false,
                            data: None,
                            error: Some(format!("eval failed: {}", e)),
                        };
                        let _ = writeln!(stream, "{}", serde_json::to_string(&resp).unwrap());
                        continue;
                    }

                    let result = state.wait_for_result();
                    let resp = match result {
                        Some(data) if data.starts_with("ERROR:") => TestResult {
                            success: false,
                            data: None,
                            error: Some(data),
                        },
                        Some(data) => TestResult {
                            success: true,
                            data: Some(data),
                            error: None,
                        },
                        None => TestResult {
                            success: false,
                            data: None,
                            error: Some("Timeout waiting for result".into()),
                        },
                    };

                    let _ = writeln!(stream, "{}", serde_json::to_string(&resp).unwrap());
                }
            });
        }
    });
}
