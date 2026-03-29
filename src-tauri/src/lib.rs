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

/// Re-apply the traffic light position by sending Objective-C messages to the
/// native NSWindow. This forces macOS to redraw the buttons and keep them visible.
///
/// Uses raw `objc_msgSend` via the Objective-C runtime — no extra crate dependencies
/// needed beyond what Tauri already links.
#[cfg(target_os = "macos")]
fn reposition_traffic_lights(window: &tauri::WebviewWindow) {
    use std::ffi::c_void;

    // The traffic light position from tauri.conf.json
    const TRAFFIC_LIGHT_X: f64 = 12.0;
    const TRAFFIC_LIGHT_Y: f64 = 22.0;

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
        let sel_frame = sel_registerName(c"frame".as_ptr().cast());
        let sel_set_frame = sel_registerName(c"setFrameOrigin:".as_ptr().cast());
        let sel_superview = sel_registerName(c"superview".as_ptr().cast());

        // NSPoint struct for Objective-C interop
        #[repr(C)]
        #[derive(Clone, Copy)]
        struct NSPoint {
            x: f64,
            y: f64,
        }

        #[repr(C)]
        #[derive(Clone, Copy)]
        struct NSSize {
            width: f64,
            height: f64,
        }

        #[repr(C)]
        #[derive(Clone, Copy)]
        struct NSRect {
            origin: NSPoint,
            size: NSSize,
        }

        // Declare a version of objc_msgSend that returns NSRect (uses objc_msgSend_stret on some archs)
        #[cfg(target_arch = "x86_64")]
        extern "C" {
            fn objc_msgSend_stret(stret: *mut NSRect, obj: *mut c_void, sel: *mut c_void, ...);
        }

        // Helper to get frame rect
        #[cfg(target_arch = "x86_64")]
        unsafe fn get_frame(obj: *mut c_void, sel: *mut c_void) -> NSRect {
            let mut rect = NSRect {
                origin: NSPoint { x: 0.0, y: 0.0 },
                size: NSSize {
                    width: 0.0,
                    height: 0.0,
                },
            };
            objc_msgSend_stret(&mut rect, obj, sel);
            rect
        }

        #[cfg(target_arch = "aarch64")]
        unsafe fn get_frame(obj: *mut c_void, sel: *mut c_void) -> NSRect {
            // On ARM64, structs are returned in registers
            let func: unsafe extern "C" fn(*mut c_void, *mut c_void) -> NSRect =
                std::mem::transmute(objc_msgSend as *const c_void);
            func(obj, sel)
        }

        let buttons = [
            NS_WINDOW_CLOSE_BUTTON,
            NS_WINDOW_MINIATURIZE_BUTTON,
            NS_WINDOW_ZOOM_BUTTON,
        ];

        for (i, &button_type) in buttons.iter().enumerate() {
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

            // Get the button's frame to know its size
            let frame = get_frame(button, sel_frame);

            // Position each button: close at x, minimize at x+20, zoom at x+40
            let x = TRAFFIC_LIGHT_X + (i as f64) * 20.0;

            // Get the superview to calculate the correct y position
            let superview: *mut c_void = objc_msgSend(button, sel_superview);
            if !superview.is_null() {
                let superview_frame = get_frame(superview, sel_frame);
                // macOS uses flipped coordinates in the title bar area
                let y = superview_frame.size.height - TRAFFIC_LIGHT_Y - frame.size.height;

                let origin = NSPoint { x, y };
                let func_set_frame: unsafe extern "C" fn(
                    *mut c_void,
                    *mut c_void,
                    NSPoint,
                ) -> *mut c_void = std::mem::transmute(objc_msgSend as *const c_void);
                func_set_frame(button, sel_set_frame, origin);
            }
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
