use tauri::Manager;
use tauri_plugin_window_state::StateFlags;

/// Force macOS traffic light buttons (close/minimize/maximize) to stay visible
/// when the window loses focus. This is a workaround for a known Tauri v2 issue
/// where `titleBarStyle: "Overlay"` causes traffic lights to disappear on blur.
#[cfg(target_os = "macos")]
fn setup_traffic_light_fix(window: &tauri::WebviewWindow) {
    let win = window.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::Focused(_) = event {
            reposition_traffic_lights(&win);
        }
    });
}

/// Ensure macOS traffic light buttons remain visible by calling `[button setHidden:NO]`
/// on each standard window button. Tauri's `trafficLightPosition` in `tauri.conf.json`
/// already handles positioning — we only need to prevent the buttons from being hidden
/// when the window loses and regains focus.
///
/// Uses raw `objc_msgSend` via the Objective-C runtime — no extra crate dependencies
/// needed beyond what Tauri already links.
#[cfg(target_os = "macos")]
fn reposition_traffic_lights(window: &tauri::WebviewWindow) {
    use std::ffi::c_void;

    // NSWindowButton constants
    const NS_WINDOW_CLOSE_BUTTON: u64 = 0;
    const NS_WINDOW_MINIATURIZE_BUTTON: u64 = 1;
    const NS_WINDOW_ZOOM_BUTTON: u64 = 2;

    extern "C" {
        fn objc_msgSend(obj: *mut c_void, sel: *mut c_void, ...) -> *mut c_void;
        fn sel_registerName(name: *const u8) -> *mut c_void;
    }

    let ns_window = match window.ns_window() {
        Ok(w) => w,
        Err(_) => return,
    };

    unsafe {
        let sel_standard_window_button = sel_registerName(c"standardWindowButton:".as_ptr().cast());
        let sel_set_hidden = sel_registerName(c"setHidden:".as_ptr().cast());

        let buttons = [
            NS_WINDOW_CLOSE_BUTTON,
            NS_WINDOW_MINIATURIZE_BUTTON,
            NS_WINDOW_ZOOM_BUTTON,
        ];

        for &button_type in &buttons {
            // Get the button: [nsWindow standardWindowButton:buttonType]
            let button: *mut c_void = {
                let func: unsafe extern "C" fn(*mut c_void, *mut c_void, u64) -> *mut c_void =
                    std::mem::transmute(objc_msgSend as *const c_void);
                func(ns_window, sel_standard_window_button, button_type)
            };

            if button.is_null() {
                continue;
            }

            // Ensure the button is visible: [button setHidden:NO]
            let func_set_hidden: unsafe extern "C" fn(*mut c_void, *mut c_void, i8) -> *mut c_void =
                std::mem::transmute(objc_msgSend as *const c_void);
            func_set_hidden(button, sel_set_hidden, 0); // NO = 0
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::all() & !StateFlags::VISIBLE)
                .build(),
        )
        .setup(|app| {
            let window = app.get_webview_window("main").expect("main window");

            #[cfg(target_os = "macos")]
            setup_traffic_light_fix(&window);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
