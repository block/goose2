import { useEffect, useState } from "react";
import { TabBar } from "@/features/tabs/ui/TabBar";
import { Sidebar } from "@/features/sidebar/ui/Sidebar";
import { StatusBar } from "@/features/status/ui/StatusBar";
import { HomeScreen } from "@/features/home/ui/HomeScreen";
import { ChatView } from "@/features/chat/ui/ChatView";
import { SettingsModal } from "@/features/settings/ui/SettingsModal";
import type { Tab } from "@/features/tabs/types";

export function AppShell({ children }: { children?: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>([
    { id: "1", title: "New Chat" },
  ]);
  const [activeTabId, setActiveTabId] = useState<string | null>("1");
  const isHome = activeTabId === null;

  const handleNewTab = () => {
    const id = String(Date.now());
    setTabs((prev) => [...prev, { id, title: "New Chat" }]);
    setActiveTabId(id);
  };

  const handleTabClose = (id: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (activeTabId === id) {
        setActiveTabId(next[0]?.id ?? null);
      }
      return next;
    });
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "," && e.metaKey) {
        e.preventDefault();
        setSettingsOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabSelect={setActiveTabId}
        onTabClose={handleTabClose}
        onNewTab={handleNewTab}
        onHomeClick={() => setActiveTabId(null)}
        onSidebarToggle={() => setSidebarOpen(prev => !prev)}
      />
      <div className="flex min-h-0 flex-1">
        <Sidebar isOpen={sidebarOpen} onSettingsClick={() => setSettingsOpen(true)} />
        <main className="min-h-0 min-w-0 flex-1">
          {children ?? (isHome ? <HomeScreen /> : <ChatView />)}
        </main>
      </div>
      {!isHome && (
        <StatusBar modelName="Claude Sonnet 4" tokenCount={0} status="connected" />
      )}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
