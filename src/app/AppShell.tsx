import { useEffect, useState } from "react";
import { TabBar } from "@/features/tabs/ui/TabBar";
import { Sidebar } from "@/features/sidebar/ui/Sidebar";
import { StatusBar } from "@/features/status/ui/StatusBar";
import { HomeScreen } from "@/features/home/ui/HomeScreen";
import { ChatView } from "@/features/chat/ui/ChatView";
import { SkillsView } from "@/features/skills/ui/SkillsView";
import { AgentsView } from "@/features/agents/ui/AgentsView";
import { SettingsModal } from "@/features/settings/ui/SettingsModal";
import type { Tab } from "@/features/tabs/types";

export type AppView = "home" | "chat" | "skills" | "agents";

const SIDEBAR_WIDTH = 240;
const SIDEBAR_COLLAPSED_WIDTH = 48;

export function AppShell({ children }: { children?: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<AppView>("home");
  const isHome = activeTabId === null && activeView === "home";

  const handleNewTab = () => {
    const id = String(Date.now());
    setTabs((prev) => [...prev, { id, title: "New Chat" }]);
    setActiveTabId(id);
    setActiveView("chat");
  };

  const handleTabClose = (id: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (activeTabId === id) {
        const nextId = next[0]?.id ?? null;
        setActiveTabId(nextId);
        if (!nextId) setActiveView("home");
      }
      return next;
    });
  };

  const handleNavigate = (view: AppView) => {
    setActiveView(view);
    if (view !== "chat") {
      setActiveTabId(null);
    }
  };

  const toggleSidebar = () => setSidebarCollapsed((prev) => !prev);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd+, for settings
      if (e.key === "," && e.metaKey) {
        e.preventDefault();
        setSettingsOpen((prev) => !prev);
      }
      // Cmd+B for sidebar toggle
      if (e.key === "b" && e.metaKey) {
        e.preventDefault();
        setSidebarCollapsed((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const renderContent = () => {
    switch (activeView) {
      case "skills":
        return <SkillsView />;
      case "agents":
        return <AgentsView />;
      case "chat":
        return <ChatView />;
      case "home":
        return activeTabId ? <ChatView /> : <HomeScreen />;
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Tab bar — full width across the top */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabSelect={setActiveTabId}
        onTabClose={handleTabClose}
        onNewTab={handleNewTab}
        onHomeClick={() => handleNavigate("home")}
      />

      {/* Main content area — sidebar + content as flex row */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar wrapper — padding creates the floating effect */}
        <div
          className="flex-shrink-0 h-full py-3 pl-3"
          style={{
            width: sidebarCollapsed
              ? SIDEBAR_COLLAPSED_WIDTH + 12
              : SIDEBAR_WIDTH + 12,
            transition: "width 200ms ease-out",
          }}
        >
          <Sidebar
            collapsed={sidebarCollapsed}
            width={SIDEBAR_WIDTH}
            onCollapse={toggleSidebar}
            onSettingsClick={() => setSettingsOpen(true)}
            onNavigate={handleNavigate}
            onNewChat={handleNewTab}
            activeView={activeView}
            className="h-full shadow-xl rounded-xl"
          />
        </div>

        {/* Content area */}
        <main className="min-h-0 min-w-0 flex-1">
          {children ?? renderContent()}
        </main>
      </div>

      {/* Status bar — conditional with animation */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isHome ? "max-h-0 opacity-0" : "max-h-8 opacity-100"
        }`}
      >
        <StatusBar
          modelName="Claude Sonnet 4"
          tokenCount={0}
          status="connected"
        />
      </div>

      {/* Settings modal */}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
