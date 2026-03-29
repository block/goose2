import { useState } from "react";
import { TabBar } from "@/features/tabs/ui/TabBar";
import { Sidebar } from "@/features/sidebar/ui/Sidebar";
import { StatusBar } from "@/features/status/ui/StatusBar";

interface Tab {
  id: string;
  title: string;
}

export function AppShell({ children }: { children?: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [tabs, setTabs] = useState<Tab[]>([
    { id: "1", title: "New Chat" },
  ]);
  const [activeTabId, setActiveTabId] = useState<string | null>("1");

  const handleNewTab = () => {
    const id = String(Date.now());
    setTabs((prev) => [...prev, { id, title: "New Chat" }]);
    setActiveTabId(id);
  };

  const handleTabClose = (id: string) => {
    setTabs((prev) => prev.filter((t) => t.id !== id));
    if (activeTabId === id) {
      setActiveTabId(tabs[0]?.id ?? null);
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabSelect={setActiveTabId}
        onTabClose={handleTabClose}
        onNewTab={handleNewTab}
        onHomeClick={() => setActiveTabId(null)}
        onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      <div className="flex min-h-0 flex-1">
        <Sidebar isOpen={sidebarOpen} />
        <main className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
          {children ?? (
            <div className="text-center space-y-4">
              <h1 className="text-4xl font-bold">Goose</h1>
              <p className="text-muted-foreground">Your app shell is ready.</p>
            </div>
          )}
        </main>
      </div>
      <StatusBar modelName="Claude Sonnet 4" tokenCount={0} status="connected" />
    </div>
  );
}
