import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";

import { Button } from "@/shared/ui/button";

export function App() {
  useEffect(() => {
    getCurrentWindow().show();
  }, []);

  return (
    <div className="flex h-screen flex-col">
      <header
        className="flex h-12 shrink-0 items-center px-4 pl-20"
        data-tauri-drag-region
      />
      <main className="flex flex-1 items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">Goose</h1>
          <p className="text-muted-foreground">Your app shell is ready.</p>
          <Button variant="outline">Get Started</Button>
        </div>
      </main>
    </div>
  );
}
