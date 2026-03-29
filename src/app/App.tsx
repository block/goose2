import { useEffect } from "react";

import { AppShell } from "@/app/AppShell";

export function App() {
  useEffect(() => {
    // Dynamic import to avoid crash in non-Tauri environments (e.g., Playwright E2E)
    if (window.__TAURI_INTERNALS__) {
      import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
        getCurrentWindow()
          .show()
          .catch(() => {});
      });
    }
  }, []);

  return <AppShell />;
}
