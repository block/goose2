import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";

import { AppShell } from "@/app/AppShell";

export function App() {
  useEffect(() => {
    if (window.__TAURI_INTERNALS__) {
      getCurrentWindow()
        .show()
        .catch(() => {});
    }
  }, []);

  return <AppShell />;
}
