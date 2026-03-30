import { useCallback, useEffect, useState } from "react";
import { TabBar } from "@/features/tabs/ui/TabBar";
import { Sidebar } from "@/features/sidebar/ui/Sidebar";
import { StatusBar } from "@/features/status/ui/StatusBar";
import { HomeScreen } from "@/features/home/ui/HomeScreen";
import { ChatView } from "@/features/chat/ui/ChatView";
import { SkillsView } from "@/features/skills/ui/SkillsView";
import { AgentsView } from "@/features/agents/ui/AgentsView";
import { ProjectsView } from "@/features/projects/ui/ProjectsView";
import type { ProjectInfo } from "@/features/projects/api/projects";
import { SettingsModal } from "@/features/settings/ui/SettingsModal";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { useAgentStore } from "@/features/agents/stores/agentStore";
import type { Tab } from "@/features/tabs/types";

export type AppView = "home" | "chat" | "skills" | "agents" | "projects";

const SIDEBAR_WIDTH = 240;
const SIDEBAR_COLLAPSED_WIDTH = 48;

export function AppShell({ children }: { children?: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<AppView>("home");

  const chatStore = useChatStore();
  const agentStore = useAgentStore();

  const isHome = activeTabId === null && activeView === "home";
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  // Derive status bar values from stores
  const activeAgent = agentStore.getActiveAgent();
  const modelName = activeAgent?.model ?? "Claude Sonnet 4";
  const tokenCount = chatStore.tokenState.totalTokens;
  const connectionStatus = chatStore.isConnected
    ? ("connected" as const)
    : ("disconnected" as const);

  const createNewTab = useCallback(
    (title = "New Chat", project?: ProjectInfo) => {
      const id = crypto.randomUUID();
      const sessionId = crypto.randomUUID();
      const agentId = agentStore.activeAgentId ?? undefined;

      const tab: Tab = {
        id,
        title,
        sessionId,
        agentId,
        projectId: project?.id,
      };
      setTabs((prev) => [...prev, tab]);
      setActiveTabId(id);
      setActiveView("chat");

      // Set the active session in chatStore
      chatStore.setActiveSession(sessionId);

      // Inject project context as a system message if starting from a project
      if (project?.prompt) {
        chatStore.addMessage(sessionId, {
          id: crypto.randomUUID(),
          role: "system",
          created: Date.now(),
          content: [
            {
              type: "systemNotification",
              notificationType: "info",
              text: `Project: ${project.name}\n\n${project.prompt}`,
            },
          ],
          metadata: { userVisible: true, agentVisible: true },
        });
      }

      return tab;
    },
    [chatStore, agentStore.activeAgentId],
  );

  const handleStartChatFromProject = useCallback(
    (project: ProjectInfo) => {
      createNewTab(project.name, project);
    },
    [createNewTab],
  );

  const handleNewTab = useCallback(() => {
    createNewTab();
  }, [createNewTab]);

  const handleHomeStartChat = useCallback(
    (initialMessage?: string) => {
      const tab = createNewTab(initialMessage?.slice(0, 40) || "New Chat");
      // The ChatView will handle sending the initial message via its own input
      // We just need to create the tab and session
      void tab; // tab is used for side effects in createNewTab
    },
    [createNewTab],
  );

  const handleTabClose = (id: string) => {
    setTabs((prev) => {
      const closingTab = prev.find((t) => t.id === id);
      const next = prev.filter((t) => t.id !== id);

      // Cleanup session data when closing tab
      if (closingTab) {
        chatStore.cleanupSession(closingTab.sessionId);
      }

      if (activeTabId === id) {
        const nextTab = next[0] ?? null;
        setActiveTabId(nextTab?.id ?? null);
        if (nextTab) {
          chatStore.setActiveSession(nextTab.sessionId);
          setActiveView("chat");
        } else {
          setActiveView("home");
        }
      }
      return next;
    });
  };

  const handleTabSelect = useCallback(
    (id: string) => {
      setActiveTabId(id);
      setActiveView("chat");
      const tab = tabs.find((t) => t.id === id);
      if (tab) {
        chatStore.setActiveSession(tab.sessionId);
      }
    },
    [tabs, chatStore],
  );

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
      case "projects":
        return <ProjectsView onStartChat={handleStartChatFromProject} />;
      case "chat":
        return activeTab ? (
          <ChatView sessionId={activeTab.sessionId} />
        ) : (
          <HomeScreen onStartChat={handleHomeStartChat} />
        );
      case "home":
        return activeTab ? (
          <ChatView sessionId={activeTab.sessionId} />
        ) : (
          <HomeScreen onStartChat={handleHomeStartChat} />
        );
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Tab bar — full width across the top */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabSelect={handleTabSelect}
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
          modelName={modelName}
          tokenCount={tokenCount}
          status={connectionStatus}
        />
      </div>

      {/* Settings modal */}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
