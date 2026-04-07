import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "@/features/sidebar/ui/Sidebar";
import { StatusBar } from "@/features/status/ui/StatusBar";
import { HomeScreen } from "@/features/home/ui/HomeScreen";
import { ChatView } from "@/features/chat/ui/ChatView";
import type { PastedImage } from "@/shared/types/messages";
import { SkillsView } from "@/features/skills/ui/SkillsView";
import { AgentsView } from "@/features/agents/ui/AgentsView";
import { ProjectsView } from "@/features/projects/ui/ProjectsView";
import { CreateProjectDialog } from "@/features/projects/ui/CreateProjectDialog";
import { archiveProject } from "@/features/projects/api/projects";
import type { ProjectInfo } from "@/features/projects/api/projects";
import { SettingsModal } from "@/features/settings/ui/SettingsModal";
import { TopBar } from "./ui/TopBar";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { useChatSessionStore } from "@/features/chat/stores/chatSessionStore";
import { useAcpStream } from "@/features/chat/hooks/useAcpStream";
import { useAgentStore } from "@/features/agents/stores/agentStore";
import { useProjectStore } from "@/features/projects/stores/projectStore";
import { findExistingDraft } from "@/features/chat/lib/newChat";
import { getSessionMessages } from "@/shared/api/chat";
import { useAppStartup } from "./hooks/useAppStartup";

export type AppView = "home" | "chat" | "skills" | "agents" | "projects";

const SIDEBAR_DEFAULT_WIDTH = 240;
const SIDEBAR_MIN_WIDTH = 180;
const SIDEBAR_MAX_WIDTH = 380;
const SIDEBAR_SNAP_COLLAPSE_THRESHOLD = 100;
const SIDEBAR_COLLAPSED_WIDTH = 48;

export function AppShell({ children }: { children?: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
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
    const session = useChatSessionStore
      .getState()
      .sessions.find((s) => s.id === sessionId);
    if (session?.draft) return;
    const { messagesBySession, setMessages } = useChatStore.getState();
    const existing = messagesBySession[sessionId];
    if (
      (existing && existing.length > 0) ||
      loadingSessionsRef.current.has(sessionId)
    ) {
      return;
    }
    loadingSessionsRef.current.add(sessionId);
    try {
      const messages = await getSessionMessages(sessionId);
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

  const { activeSessionId } = sessionStore;

  useEffect(() => {
    if (activeView === "chat" && activeSessionId) {
      useChatStore.getState().markSessionRead(activeSessionId);
    }
  }, [activeSessionId, activeView]);

  const isHome = activeSessionId === null && activeView === "home";

  const activeSession = activeSessionId
    ? sessionStore.getSession(activeSessionId)
    : undefined;
  const modelName = activeSession?.modelName;
  const tokenCount = activeSessionId
    ? chatStore.getSessionRuntime(activeSessionId).tokenState.totalTokens
    : 0;

  const [pendingInitialMessage, setPendingInitialMessage] = useState<
    string | undefined
  >();
  const [pendingInitialImages, setPendingInitialImages] = useState<
    PastedImage[] | undefined
  >();
  const [homeSelectedPersonaId, setHomeSelectedPersonaId] = useState<
    string | undefined
  >();

  const cleanupEmptyDraft = useCallback(
    (sessionId: string | null) => {
      if (!sessionId) return;
      const state = useChatSessionStore.getState();
      const session = state.sessions.find((s) => s.id === sessionId);
      if (!session?.draft) return;
      const draft = useChatStore.getState().getDraft(sessionId);
      if (draft.length > 0) return;
      chatStore.cleanupSession(sessionId);
      state.removeDraft(sessionId);
    },
    [chatStore],
  );

  const createNewTab = useCallback(
    (title = "New Chat", project?: ProjectInfo) => {
      const agentId = agentStore.activeAgentId ?? undefined;
      const providerId = project?.preferredProvider ?? homeSelectedProvider;
      const personaId = homeSelectedPersonaId;
      const sessionState = useChatSessionStore.getState();
      const chatStoreState = useChatStore.getState();
      const existingDraft = findExistingDraft({
        sessions: sessionState.sessions,
        activeSessionId: sessionState.activeSessionId,
        draftsBySession: chatStoreState.draftsBySession,
        messagesBySession: chatStoreState.messagesBySession,
        request: {
          title,
          projectId: project?.id,
          agentId,
          providerId,
          personaId,
        },
      });

      if (existingDraft) {
        cleanupEmptyDraft(sessionState.activeSessionId);
        sessionState.setActiveSession(existingDraft.id);
        setActiveView("chat");
        chatStore.setActiveSession(existingDraft.id);
        return existingDraft;
      }

      cleanupEmptyDraft(sessionState.activeSessionId);

      const session = sessionStore.createDraftSession({
        title,
        projectId: project?.id,
        agentId,
        providerId,
        personaId,
      });

      sessionStore.setActiveSession(session.id);
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
      cleanupEmptyDraft,
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

  const clearActiveSession = useCallback(
    (sessionId: string) => {
      const session = useChatSessionStore
        .getState()
        .sessions.find((s) => s.id === sessionId);
      if (session?.draft) {
        const draft = useChatStore.getState().getDraft(sessionId);
        if (draft.length === 0) {
          chatStore.cleanupSession(sessionId);
          useChatSessionStore.getState().removeDraft(sessionId);
        }
      }
      sessionStore.setActiveSession(null);
      setActiveView("home");
    },
    [chatStore, sessionStore],
  );

  const handleArchiveChat = useCallback(
    async (sessionId: string) => {
      const { activeSessionId: currentActiveSessionId } =
        useChatSessionStore.getState();
      const wasActiveSession = currentActiveSessionId === sessionId;

      try {
        await sessionStore.archiveSession(sessionId);
        chatStore.cleanupSession(sessionId);

        if (!wasActiveSession) {
          return;
        }

        sessionStore.setActiveSession(null);
        setActiveView("home");
      } catch {
        // best-effort
      }
    },
    [chatStore, sessionStore],
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
    (sessionId: string, nextTitle: string) => {
      sessionStore.updateSession(sessionId, {
        title: nextTitle,
        userSetName: true,
      });
    },
    [sessionStore],
  );

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

  const handleHomeStartChat = useCallback(
    (
      initialMessage?: string,
      providerId?: string,
      personaId?: string,
      projectId?: string | null,
      images?: PastedImage[],
    ) => {
      setHomeSelectedProvider(providerId);
      setHomeSelectedPersonaId(personaId);
      setPendingInitialMessage(initialMessage);
      setPendingInitialImages(images);
      const selectedProject =
        projectId != null
          ? projectStore.projects.find((project) => project.id === projectId)
          : undefined;

      createNewTab(
        initialMessage?.slice(0, 100) || "New Chat",
        selectedProject,
      );
    },
    [createNewTab, projectStore.projects],
  );

  const handleSelectSession = useCallback(
    (id: string) => {
      cleanupEmptyDraft(useChatSessionStore.getState().activeSessionId);
      sessionStore.setActiveSession(id);
      setActiveView("chat");
      chatStore.setActiveSession(id);
      useChatStore.getState().markSessionRead(id);
      loadSessionMessages(id);
    },
    [sessionStore, chatStore, loadSessionMessages, cleanupEmptyDraft],
  );

  const handleNavigate = useCallback(
    (view: AppView) => {
      if (view !== "chat") {
        cleanupEmptyDraft(useChatSessionStore.getState().activeSessionId);
        sessionStore.setActiveSession(null);
      }
      setActiveView(view);
    },
    [sessionStore, cleanupEmptyDraft],
  );

  const toggleSidebar = () => setSidebarCollapsed((prev) => !prev);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      const startX = e.clientX;
      const startWidth = sidebarCollapsed
        ? SIDEBAR_COLLAPSED_WIDTH
        : sidebarWidth;
      let shouldCollapse = false;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const newWidth = startWidth + delta;

        if (newWidth < SIDEBAR_SNAP_COLLAPSE_THRESHOLD) {
          shouldCollapse = true;
          setSidebarWidth(SIDEBAR_MIN_WIDTH);
        } else {
          shouldCollapse = false;
          setSidebarCollapsed(false);
          setSidebarWidth(
            Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, newWidth)),
          );
        }
      };

      const cleanup = () => {
        setIsResizing(false);
        if (shouldCollapse) setSidebarCollapsed(true);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", cleanup);
        window.removeEventListener("blur", cleanup);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", cleanup);
      window.addEventListener("blur", cleanup);
    },
    [sidebarCollapsed, sidebarWidth],
  );

  const handleResizeDoubleClick = useCallback(() => {
    setSidebarCollapsed(false);
    setSidebarWidth(SIDEBAR_DEFAULT_WIDTH);
  }, []);

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
      // Cmd+W returns to home instead of closing the window
      if (e.key === "w" && e.metaKey) {
        e.preventDefault();
        const { activeSessionId } = useChatSessionStore.getState();
        if (activeSessionId) {
          clearActiveSession(activeSessionId);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [clearActiveSession]);

  const activeSessionPersonaId = activeSession?.personaId;

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
        return activeSession ? (
          <ChatView
            key={activeSession.id}
            sessionId={activeSession.id}
            initialProvider={homeSelectedProvider}
            initialPersonaId={activeSessionPersonaId ?? homeSelectedPersonaId}
            initialMessage={pendingInitialMessage}
            initialImages={pendingInitialImages}
            onCreateProject={openCreateProjectDialog}
            onInitialMessageConsumed={() => {
              setPendingInitialMessage(undefined);
              setPendingInitialImages(undefined);
              setHomeSelectedProvider(undefined);
              setHomeSelectedPersonaId(undefined);
            }}
          />
        ) : (
          <HomeScreen
            onStartChat={handleHomeStartChat}
            onCreateProject={openCreateProjectDialog}
          />
        );
    }
  };

  const editingProjectProp = useMemo(
    () =>
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
        : undefined,
    [editingProject],
  );

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <TopBar onSettingsClick={() => setSettingsOpen(true)} />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div
          className="flex-shrink-0 h-full py-3 pl-3"
          style={{
            width: sidebarCollapsed
              ? SIDEBAR_COLLAPSED_WIDTH + 12
              : sidebarWidth + 12,
            transition: isResizing ? "none" : "width 200ms ease-out",
          }}
        >
          <Sidebar
            collapsed={sidebarCollapsed}
            width={sidebarWidth}
            isResizing={isResizing}
            onCollapse={toggleSidebar}
            onNavigate={handleNavigate}
            onNewChatInProject={handleNewChatInProject}
            onNewChat={() => createNewTab()}
            onCreateProject={() => openCreateProjectDialog()}
            onEditProject={handleEditProject}
            onArchiveProject={handleArchiveProject}
            onArchiveChat={handleArchiveChat}
            onRenameChat={handleRenameChat}
            onSelectSession={handleSelectSession}
            activeView={activeView}
            activeSessionId={activeSessionId}
            projects={projectStore.projects}
            className="h-full rounded-xl"
          />
        </div>

        {/* Resize handle */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: drag handle for sidebar resize */}
        <div
          onMouseDown={handleResizeStart}
          onDoubleClick={handleResizeDoubleClick}
          className="flex-shrink-0 w-2 h-full cursor-col-resize group flex items-center justify-center"
        >
          <div className="w-px h-8 rounded-full bg-transparent group-hover:bg-border transition-colors" />
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
          sessionId={activeSessionId ?? undefined}
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
        editingProject={editingProjectProp}
      />
    </div>
  );
}
