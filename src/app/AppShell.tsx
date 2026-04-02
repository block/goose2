import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TabBar } from "@/features/tabs/ui/TabBar";
import { Sidebar } from "@/features/sidebar/ui/Sidebar";
import { StatusBar } from "@/features/status/ui/StatusBar";
import { HomeScreen } from "@/features/home/ui/HomeScreen";
import { ChatView } from "@/features/chat/ui/ChatView";
import { SkillsView } from "@/features/skills/ui/SkillsView";
import { AgentsView } from "@/features/agents/ui/AgentsView";
import { ProjectsView } from "@/features/projects/ui/ProjectsView";
import { CreateProjectDialog } from "@/features/projects/ui/CreateProjectDialog";
import { archiveProject } from "@/features/projects/api/projects";
import type { ProjectInfo } from "@/features/projects/api/projects";
import { SettingsModal } from "@/features/settings/ui/SettingsModal";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { useChatSessionStore } from "@/features/chat/stores/chatSessionStore";
import { useAcpStream } from "@/features/chat/hooks/useAcpStream";
import { isSessionRunning } from "@/features/chat/lib/sessionActivity";
import { useAgentStore } from "@/features/agents/stores/agentStore";
import { useProjectStore } from "@/features/projects/stores/projectStore";
import { findReusableNewChatSession } from "@/features/chat/lib/newChat";
import { getSessionMessages } from "@/shared/api/chat";
import type { Tab } from "@/features/tabs/types";
import { useAppStartup } from "./hooks/useAppStartup";

export type AppView = "home" | "chat" | "skills" | "agents" | "projects";

const SIDEBAR_WIDTH = 240;
const SIDEBAR_COLLAPSED_WIDTH = 48;

export function AppShell({ children }: { children?: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [createProjectInitialWorkingDir, setCreateProjectInitialWorkingDir] =
    useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<ProjectInfo | null>(
    null,
  );
  const [activeView, setActiveView] = useState<AppView>("home");
  const [homeSelectedProvider, setHomeSelectedProvider] = useState<
    string | undefined
  >();

  const chatStore = useChatStore();
  const sessionStore = useChatSessionStore();
  const agentStore = useAgentStore();
  const projectStore = useProjectStore();

  useAcpStream(true);

  const loadingSessionsRef = useRef<Set<string>>(new Set());
  const pendingProjectCreatedRef = useRef<((projectId: string) => void) | null>(
    null,
  );

  const loadSessionMessages = useCallback(async (sessionId: string) => {
    const { messagesBySession, setMessages } = useChatStore.getState();
    const existing = messagesBySession[sessionId];
    // Skip if messages are already loaded or currently being loaded
    if (
      (existing && existing.length > 0) ||
      loadingSessionsRef.current.has(sessionId)
    ) {
      return;
    }
    loadingSessionsRef.current.add(sessionId);
    try {
      const messages = await getSessionMessages(sessionId);
      // Only set if still empty (another path may have populated it)
      const current = useChatStore.getState().messagesBySession[sessionId];
      if (!current || current.length === 0) {
        setMessages(sessionId, messages);
      }
    } catch (err) {
      console.error(`Failed to load messages for session ${sessionId}:`, err);
    } finally {
      loadingSessionsRef.current.delete(sessionId);
    }
  }, []);

  useAppStartup();

  useEffect(() => {
    projectStore.fetchProjects();
  }, [projectStore.fetchProjects]);

  const { sessions, openTabIds, activeTabId } = sessionStore;

  useEffect(() => {
    if (activeView === "chat" && activeTabId) {
      useChatStore.getState().markSessionRead(activeTabId);
    }
  }, [activeTabId, activeView]);

  const tabs: Tab[] = useMemo(() => {
    const sessionMap = new Map(sessions.map((s) => [s.id, s]));
    return openTabIds.reduce<Tab[]>((acc, id) => {
      const session = sessionMap.get(id);
      if (session) {
        const runtime = chatStore.getSessionRuntime(session.id);
        const tab: Tab = {
          id: session.id,
          title: session.title,
          sessionId: session.id, // tab ID === session ID in new model
          isRunning: isSessionRunning(runtime.chatState),
          hasUnread: runtime.hasUnread,
        };
        if (session.agentId) tab.agentId = session.agentId;
        if (session.projectId) tab.projectId = session.projectId;
        acc.push(tab);
      }
      return acc;
    }, []);
  }, [chatStore, openTabIds, sessions]);

  const isHome = activeTabId === null && activeView === "home";
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  const activeSession = activeTabId
    ? sessionStore.getSession(activeTabId)
    : undefined;
  const modelName = activeSession?.modelName;
  const tokenCount = activeTabId
    ? chatStore.getSessionRuntime(activeTabId).tokenState.totalTokens
    : 0;

  const [pendingInitialMessage, setPendingInitialMessage] = useState<
    string | undefined
  >();
  const [homeSelectedPersonaId, setHomeSelectedPersonaId] = useState<
    string | undefined
  >();

  const createNewTab = useCallback(
    async (title = "New Chat", project?: ProjectInfo) => {
      const agentId = agentStore.activeAgentId ?? undefined;
      const providerId = project?.preferredProvider ?? homeSelectedProvider;
      const personaId = homeSelectedPersonaId;
      const sessionState = useChatSessionStore.getState();
      const reusableSession = findReusableNewChatSession({
        sessions: sessionState.sessions,
        activeTabId: sessionState.activeTabId,
        openTabIds: sessionState.openTabIds,
        messagesBySession: useChatStore.getState().messagesBySession,
        request: {
          title,
          projectId: project?.id,
          agentId,
          providerId,
          personaId,
        },
      });

      if (reusableSession) {
        sessionState.openTab(reusableSession.id);
        setActiveView("chat");
        chatStore.setActiveSession(reusableSession.id);
        return reusableSession;
      }

      const session = await sessionStore.createSession({
        title,
        projectId: project?.id,
        agentId,
        providerId,
        personaId,
      });

      sessionStore.openTab(session.id);
      setActiveView("chat");

      chatStore.setActiveSession(session.id);

      return session;
    },
    [
      chatStore,
      sessionStore,
      agentStore.activeAgentId,
      homeSelectedPersonaId,
      homeSelectedProvider,
    ],
  );

  const handleStartChatFromProject = useCallback(
    (project: ProjectInfo) => {
      setHomeSelectedProvider(undefined);
      createNewTab("New Chat", project);
    },
    [createNewTab],
  );

  const handleNewChatInProject = useCallback(
    (projectId: string) => {
      setHomeSelectedProvider(undefined);
      const project = projectStore.projects.find((p) => p.id === projectId);
      if (project) {
        createNewTab("New Chat", project);
      }
    },
    [createNewTab, projectStore.projects],
  );

  const handleArchiveProject = useCallback(
    async (projectId: string) => {
      try {
        await archiveProject(projectId);
        projectStore.fetchProjects();
      } catch {
        // best-effort
      }
    },
    [projectStore.fetchProjects],
  );

  const closeAndCleanupTab = useCallback(
    (tabId: string) => {
      chatStore.cleanupSession(tabId);
      sessionStore.closeTab(tabId);

      const { activeTabId: newActiveTabId } = useChatSessionStore.getState();
      if (newActiveTabId) {
        chatStore.setActiveSession(newActiveTabId);
        setActiveView("chat");
      } else {
        setActiveView("home");
      }
    },
    [chatStore, sessionStore],
  );

  const handleArchiveChat = useCallback(
    async (tabId: string) => {
      const { activeTabId: currentActiveTabId } =
        useChatSessionStore.getState();
      const wasActiveTab = currentActiveTabId === tabId;

      try {
        await sessionStore.archiveSession(tabId);
        chatStore.cleanupSession(tabId);

        if (!wasActiveTab) {
          return;
        }

        const { activeTabId: newActiveTabId } = useChatSessionStore.getState();
        if (newActiveTabId) {
          chatStore.setActiveSession(newActiveTabId);
          setActiveView("chat");
          loadSessionMessages(newActiveTabId);
        } else {
          setActiveView("home");
        }
      } catch {
        // best-effort
      }
    },
    [chatStore, loadSessionMessages, sessionStore],
  );

  const handleEditProject = useCallback(
    (projectId: string) => {
      const project = projectStore.projects.find((p) => p.id === projectId);
      if (project) {
        setEditingProject(project);
        setCreateProjectOpen(true);
      }
    },
    [projectStore.projects],
  );

  const handleRenameChat = useCallback(
    (tabId: string, nextTitle: string) => {
      sessionStore.updateSession(tabId, { title: nextTitle });
    },
    [sessionStore],
  );

  const handleNewTab = useCallback(() => {
    setHomeSelectedProvider(undefined);
    createNewTab();
  }, [createNewTab]);

  const openCreateProjectDialog = useCallback(
    (options?: {
      initialWorkingDir?: string | null;
      onCreated?: (projectId: string) => void;
    }) => {
      setEditingProject(null);
      setCreateProjectInitialWorkingDir(options?.initialWorkingDir ?? null);
      pendingProjectCreatedRef.current = options?.onCreated ?? null;
      setCreateProjectOpen(true);
    },
    [],
  );

  const handleCreateProjectFromFolder = useCallback(
    async (options?: { onCreated?: (projectId: string) => void }) => {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({
          directory: true,
          multiple: false,
          title: "Select Folder for New Project",
        });

        if (selected && typeof selected === "string") {
          openCreateProjectDialog({
            initialWorkingDir: selected,
            onCreated: options?.onCreated,
          });
        }
      } catch {
        openCreateProjectDialog({ onCreated: options?.onCreated });
      }
    },
    [openCreateProjectDialog],
  );

  const handleHomeStartChat = useCallback(
    (
      initialMessage?: string,
      providerId?: string,
      personaId?: string,
      projectId?: string | null,
    ) => {
      setHomeSelectedProvider(providerId);
      setHomeSelectedPersonaId(personaId);
      setPendingInitialMessage(initialMessage);
      const selectedProject =
        projectId != null
          ? projectStore.projects.find((project) => project.id === projectId)
          : undefined;

      createNewTab(
        initialMessage?.slice(0, 40) || "New Chat",
        selectedProject,
      ).catch(() => {
        setPendingInitialMessage(undefined);
        setHomeSelectedProvider(undefined);
        setHomeSelectedPersonaId(undefined);
      });
    },
    [createNewTab, projectStore.projects],
  );

  const handleTabClose = closeAndCleanupTab;

  const handleTabSelect = useCallback(
    (id: string) => {
      const { openTabIds: currentOpenTabIds } = useChatSessionStore.getState();
      if (!currentOpenTabIds.includes(id)) {
        sessionStore.openTab(id);
      } else {
        sessionStore.setActiveTab(id);
      }
      setActiveView("chat");
      chatStore.setActiveSession(id);
      useChatStore.getState().markSessionRead(id);
      loadSessionMessages(id);
    },
    [sessionStore, chatStore, loadSessionMessages],
  );

  const handleNavigate = (view: AppView) => {
    setActiveView(view);
    if (view !== "chat") {
      sessionStore.setActiveTab(null);
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
      // Cmd+W closes the active tab instead of the window
      if (e.key === "w" && e.metaKey) {
        e.preventDefault();
        const { activeTabId } = useChatSessionStore.getState();
        if (activeTabId) {
          closeAndCleanupTab(activeTabId);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeAndCleanupTab]);

  const activeSessionPersonaId = activeTab
    ? sessionStore.getSession(activeTab.sessionId)?.personaId
    : undefined;

  const renderContent = () => {
    switch (activeView) {
      case "skills":
        return <SkillsView />;
      case "agents":
        return <AgentsView />;
      case "projects":
        return <ProjectsView onStartChat={handleStartChatFromProject} />;
      case "chat":
      case "home":
        return activeTab ? (
          <ChatView
            key={activeTab.sessionId}
            sessionId={activeTab.sessionId}
            initialProvider={homeSelectedProvider}
            initialPersonaId={activeSessionPersonaId ?? homeSelectedPersonaId}
            initialMessage={pendingInitialMessage}
            onCreateProject={openCreateProjectDialog}
            onCreateProjectFromFolder={handleCreateProjectFromFolder}
            onInitialMessageConsumed={() => {
              setPendingInitialMessage(undefined);
              setHomeSelectedProvider(undefined);
              setHomeSelectedPersonaId(undefined);
            }}
          />
        ) : (
          <HomeScreen
            onStartChat={handleHomeStartChat}
            onCreateProject={openCreateProjectDialog}
            onCreateProjectFromFolder={handleCreateProjectFromFolder}
          />
        );
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabSelect={handleTabSelect}
        onTabClose={handleTabClose}
        onNewTab={handleNewTab}
        onHomeClick={() => handleNavigate("home")}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
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
            onNewChatInProject={handleNewChatInProject}
            onCreateProject={() => openCreateProjectDialog()}
            onEditProject={handleEditProject}
            onArchiveProject={handleArchiveProject}
            onArchiveChat={handleArchiveChat}
            onRenameChat={handleRenameChat}
            onSelectTab={handleTabSelect}
            activeView={activeView}
            activeTabId={activeTabId}
            projects={projectStore.projects}
            className="h-full rounded-xl"
          />
        </div>

        <main className="min-h-0 min-w-0 flex-1">
          {children ?? renderContent()}
        </main>
      </div>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isHome ? "max-h-0 opacity-0" : "max-h-8 opacity-100"
        }`}
      >
        <StatusBar
          modelName={modelName}
          sessionId={activeTabId ?? undefined}
          tokenCount={tokenCount}
        />
      </div>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}

      <CreateProjectDialog
        isOpen={createProjectOpen}
        onClose={() => {
          setCreateProjectOpen(false);
          setEditingProject(null);
          setCreateProjectInitialWorkingDir(null);
          pendingProjectCreatedRef.current = null;
        }}
        onCreated={(project) => {
          projectStore.fetchProjects();
          pendingProjectCreatedRef.current?.(project.id);
          pendingProjectCreatedRef.current = null;
          setCreateProjectInitialWorkingDir(null);
        }}
        initialWorkingDir={createProjectInitialWorkingDir}
        editingProject={
          editingProject
            ? {
                id: editingProject.id,
                name: editingProject.name,
                description: editingProject.description,
                prompt: editingProject.prompt,
                icon: editingProject.icon,
                color: editingProject.color,
                preferredProvider: editingProject.preferredProvider,
                preferredModel: editingProject.preferredModel,
                workingDirs: editingProject.workingDirs,
                useWorktrees: editingProject.useWorktrees,
              }
            : undefined
        }
      />
    </div>
  );
}
