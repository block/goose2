import { useCallback, useEffect, useRef, useState } from "react";
import {
  IconLayoutSidebar,
  IconLayoutSidebarFilled,
} from "@tabler/icons-react";
import { BookOpen, Bot, History, Home, Search } from "lucide-react";
import { GooseIcon } from "@/shared/ui/icons/GooseIcon";
import { cn } from "@/shared/lib/cn";
import type { AppView } from "@/app/AppShell";
import type { ProjectInfo } from "@/features/projects/api/projects";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { useChatSessionStore } from "@/features/chat/stores/chatSessionStore";
import { isSessionRunning } from "@/features/chat/lib/sessionActivity";
import { filterSessions } from "@/features/sessions/lib/filterSessions";
import { useAgentStore } from "@/features/agents/stores/agentStore";
import { useProjectStore } from "@/features/projects/stores/projectStore";
import { Button } from "@/shared/ui/button";
import { SidebarProjectsSection } from "./SidebarProjectsSection";
import { useSidebarHighlight } from "./useSidebarHighlight";

interface SidebarProps {
  collapsed: boolean;
  width?: number;
  isResizing?: boolean;
  onCollapse: () => void;
  onNewChatInProject?: (projectId: string) => void;
  onNewChat?: () => void;
  onCreateProject?: () => void;
  onEditProject?: (projectId: string) => void;
  onArchiveProject?: (projectId: string) => void;
  onArchiveChat?: (sessionId: string) => void;
  onRenameChat?: (sessionId: string, nextTitle: string) => void;
  onMoveToProject?: (sessionId: string, projectId: string | null) => void;
  onNavigate?: (view: AppView) => void;
  onSelectSession?: (sessionId: string) => void;
  activeView?: AppView;
  activeSessionId?: string | null;
  className?: string;
  // Project & session data
  projects: ProjectInfo[];
}

const NAV_ITEMS: readonly { id: AppView; label: string; icon: typeof Bot }[] = [
  { id: "agents", label: "Personas", icon: Bot },
  { id: "skills", label: "Skills", icon: BookOpen },
  { id: "session-history", label: "Session History", icon: History },
];

const EXPANDED_PROJECTS_STORAGE_KEY = "goose:sidebar:expanded-projects";

export function Sidebar({
  collapsed,
  width = 240,
  isResizing = false,
  onCollapse,
  onNewChatInProject,
  onNewChat,
  onCreateProject,
  onEditProject,
  onArchiveProject,
  onArchiveChat,
  onRenameChat,
  onMoveToProject,
  onNavigate,
  onSelectSession,
  activeView,
  activeSessionId,
  className,
  projects,
}: SidebarProps) {
  const [expanded, setExpanded] = useState(!collapsed);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const prevCollapsed = useRef(collapsed);
  const [expandedProjects, setExpandedProjects] = useState<
    Record<string, boolean>
  >(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = window.localStorage.getItem(EXPANDED_PROJECTS_STORAGE_KEY);
      if (!stored) return {};
      const parsed = JSON.parse(stored);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  });

  const chatStore = useChatStore();
  const { sessions } = useChatSessionStore();

  useEffect(() => {
    if (collapsed) {
      setExpanded(false);
    } else if (prevCollapsed.current && !collapsed) {
      const timer = setTimeout(() => setExpanded(true), 60);
      return () => clearTimeout(timer);
    } else {
      setExpanded(true);
    }
    prevCollapsed.current = collapsed;
  }, [collapsed]);

  const labelTransition = "transition-[opacity,width] duration-300 ease-out";
  const labelVisible = expanded && !collapsed;

  const MAX_RECENTS = 20;

  const projectSessions = (() => {
    type SessionItem = {
      id: string;
      title: string;
      sessionId: string;
      projectId?: string;
      updatedAt: string;
      isRunning: boolean;
      hasUnread: boolean;
    };
    const byProject: Record<string, SessionItem[]> = {};
    const standalone: SessionItem[] = [];
    for (const session of sessions) {
      if (session.draft) continue;
      const runtime = chatStore.getSessionRuntime(session.id);
      const item: SessionItem = {
        id: session.id,
        title: session.title,
        sessionId: session.id,
        projectId: session.projectId ?? undefined,
        updatedAt: session.updatedAt,
        isRunning: isSessionRunning(runtime.chatState),
        hasUnread: runtime.hasUnread,
      };
      if (session.projectId) {
        if (!byProject[session.projectId]) byProject[session.projectId] = [];
        byProject[session.projectId].push(item);
      } else {
        standalone.push(item);
      }
    }
    // Sort project chats by updatedAt descending (newest first)
    for (const chats of Object.values(byProject)) {
      chats.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    }

    // Sort standalone by updatedAt descending, limit to MAX_RECENTS
    standalone.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    const limitedStandalone = standalone.slice(0, MAX_RECENTS);
    return { byProject, standalone: limitedStandalone };
  })();

  const agentStoreState = useAgentStore();
  const projectStoreState = useProjectStore();

  const sidebarResolvers = {
    getPersonaName: (personaId: string) =>
      agentStoreState.getPersonaById(personaId)?.displayName,
    getProjectName: (projectId: string) =>
      projectStoreState.projects.find((p: { id: string }) => p.id === projectId)
        ?.name,
  };

  const filteredProjectSessions = (() => {
    if (!sidebarSearch.trim()) return projectSessions;

    const allSessionItems = [
      ...Object.values(projectSessions.byProject).flat(),
      ...projectSessions.standalone,
    ];
    const matchingIds = new Set(
      filterSessions(
        allSessionItems.map((item) => ({
          id: item.id,
          title: item.title,
          projectId: item.projectId,
          createdAt: item.updatedAt,
          updatedAt: item.updatedAt,
          messageCount: 0,
        })),
        sidebarSearch,
        sidebarResolvers,
      ).map((s) => s.id),
    );

    const filteredByProject: Record<string, typeof projectSessions.standalone> =
      {};
    for (const [projectId, items] of Object.entries(
      projectSessions.byProject,
    )) {
      const matching = items.filter((item) => matchingIds.has(item.id));
      const projectNameMatches = sidebarResolvers
        .getProjectName(projectId)
        ?.toLowerCase()
        .includes(sidebarSearch.trim().toLowerCase());
      if (matching.length > 0 || projectNameMatches) {
        filteredByProject[projectId] = matching.length > 0 ? matching : items;
      }
    }

    return {
      byProject: filteredByProject,
      standalone: projectSessions.standalone.filter((item) =>
        matchingIds.has(item.id),
      ),
    };
  })();

  // Auto-expand the project containing the active session
  useEffect(() => {
    if (!activeSessionId) return;
    const activeSession = sessions.find((s) => s.id === activeSessionId);
    const projectId = activeSession?.projectId;
    if (projectId) {
      setExpandedProjects((prev) => {
        if (prev[projectId]) return prev;
        return { ...prev, [projectId]: true };
      });
    }
  }, [activeSessionId, sessions]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        EXPANDED_PROJECTS_STORAGE_KEY,
        JSON.stringify(expandedProjects),
      );
    } catch {
      // localStorage may be unavailable
    }
  }, [expandedProjects]);

  useEffect(() => {
    if (projects.length === 0) return;
    const validProjectIds = new Set(projects.map((project) => project.id));
    setExpandedProjects((prev) => {
      const next = Object.fromEntries(
        Object.entries(prev).filter(([projectId]) =>
          validProjectIds.has(projectId),
        ),
      );
      return Object.keys(next).length === Object.keys(prev).length
        ? prev
        : next;
    });
  }, [projects]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "k" && e.metaKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  const navRef = useRef<HTMLElement>(null);
  const homeRef = useRef<HTMLButtonElement>(null);
  const navItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const {
    currentRect,
    isHovering,
    onItemMouseEnter,
    onNavMouseLeave,
    updateActiveRect,
  } = useSidebarHighlight(navRef);

  // Update active rect when activeView/activeSessionId changes
  useEffect(() => {
    if (activeSessionId) {
      return;
    }

    if (activeView === "home") {
      updateActiveRect(homeRef.current);
    } else if (activeView && navItemRefs.current[activeView]) {
      updateActiveRect(navItemRefs.current[activeView]);
    } else {
      updateActiveRect(null);
    }
  }, [activeSessionId, activeView, updateActiveRect]);

  // Callback for SidebarProjectsSection to register active session refs
  const activeSessionRefCallback = useCallback(
    (el: HTMLElement | null) => {
      if (activeSessionId && el) {
        updateActiveRect(el);
      }
    },
    [activeSessionId, updateActiveRect],
  );

  return (
    <div
      className={cn(
        "relative h-full",
        !isResizing && "transition-[width] duration-300 ease-in-out",
        className,
      )}
      style={{ width: collapsed ? 54 : width }}
    >
      <div className="flex flex-col h-full overflow-hidden bg-background border border-border rounded-xl">
        {/* Goose logo — pinned top */}
        <div
          className={cn(
            "flex-shrink-0 pt-3",
            collapsed ? "px-1.5 pb-1.5" : "px-3 pb-1",
          )}
        >
          <div
            className={cn(
              "flex items-center",
              collapsed ? "justify-center" : "justify-between",
            )}
          >
            <GooseIcon className="text-muted-foreground" />
            {!collapsed && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onCollapse}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
              >
                <IconLayoutSidebarFilled className="size-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Navigation (scrollable) */}
        <nav
          ref={navRef}
          className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-1.5 py-1 pt-1.5 scrollbar-none"
          onMouseLeave={onNavMouseLeave}
        >
          {/* Sliding highlight — hidden when collapsed */}
          {currentRect && !collapsed && (
            <div
              className="absolute left-1.5 right-1.5 rounded-lg bg-accent/50 pointer-events-none z-0"
              style={{
                top: currentRect.top,
                height: currentRect.height,
                transition: isHovering
                  ? "top 0ms, height 0ms"
                  : "top 200ms ease, height 200ms ease, opacity 200ms ease",
              }}
            />
          )}

          <div className="relative z-10 space-y-0.5">
            {collapsed && (
              <button
                type="button"
                onClick={onCollapse}
                title="Expand sidebar"
                className="flex w-full items-center gap-2.5 rounded-md p-3 text-[13px] text-muted-foreground transition-colors duration-200 hover:text-foreground"
                aria-label="Expand sidebar"
              >
                <IconLayoutSidebar className="size-4 flex-shrink-0" />
                <span className="sr-only">Expand sidebar</span>
              </button>
            )}

            {/* Search bar */}
            <div
              className={cn(
                "flex items-center w-full rounded-md transition-all duration-300 ease-out",
                collapsed
                  ? "justify-center p-3 text-muted-foreground"
                  : "gap-2 border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-transparent",
              )}
            >
              <Search className="size-3.5 flex-shrink-0" />
              {!collapsed && (
                <>
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={sidebarSearch}
                    onChange={(e) => setSidebarSearch(e.target.value)}
                    placeholder="Search..."
                    className={cn(
                      "bg-transparent border-none outline-none text-xs flex-1 min-w-0 placeholder:text-muted-foreground",
                      labelTransition,
                      labelVisible
                        ? "opacity-100 w-auto"
                        : "opacity-0 w-0 overflow-hidden",
                    )}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <kbd
                    className={cn(
                      "text-[10px] text-muted-foreground px-1 py-0.5 rounded font-mono flex-shrink-0",
                      labelTransition,
                      labelVisible
                        ? "opacity-100 w-auto"
                        : "opacity-0 w-0 overflow-hidden px-0",
                    )}
                  >
                    ⌘K
                  </kbd>
                </>
              )}
            </div>

            {/* Home */}
            <button
              ref={homeRef}
              type="button"
              onClick={() => onNavigate?.("home")}
              onMouseEnter={onItemMouseEnter}
              title={collapsed ? "Home" : undefined}
              className={cn(
                "flex items-center w-full text-[13px] transition-colors duration-200 rounded-md",
                "gap-2.5 p-3",
                activeView === "home"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Home className="size-4 flex-shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap",
                  labelTransition,
                  labelVisible
                    ? "opacity-100 w-auto"
                    : "opacity-0 w-0 overflow-hidden",
                )}
              >
                Home
              </span>
            </button>

            {/* New Chat — hidden for now; project-scoped "+" covers the primary use case */}
            {/* <button
              type="button"
              onClick={onNewChat}
              onMouseEnter={onItemMouseEnter}
              title={collapsed ? "New Chat" : undefined}
              className={cn(
                "flex items-center w-full text-[13px] transition-colors duration-200 rounded-md text-muted-foreground hover:text-foreground",
                "gap-2.5 p-3",
              )}
            >
              <Plus className="size-4 flex-shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap",
                  labelTransition,
                  labelVisible
                    ? "opacity-100 w-auto"
                    : "opacity-0 w-0 overflow-hidden",
                )}
              >
                New Chat
              </span>
            </button> */}

            {/* Nav items */}
            {NAV_ITEMS.map((item, index) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  ref={(el) => {
                    navItemRefs.current[item.id] = el;
                  }}
                  type="button"
                  onClick={() => onNavigate?.(item.id)}
                  onMouseEnter={onItemMouseEnter}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center w-full text-[13px] transition-colors duration-200 rounded-md",
                    "gap-2.5 p-3",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-current={isActive ? "page" : undefined}
                  style={{
                    transitionDelay:
                      !collapsed && expanded ? `${index * 30}ms` : "0ms",
                  }}
                >
                  <Icon className="size-4 flex-shrink-0" />
                  <span
                    className={cn(
                      "whitespace-nowrap",
                      labelTransition,
                      labelVisible
                        ? "opacity-100 w-auto"
                        : "opacity-0 w-0 overflow-hidden",
                    )}
                    style={{
                      transitionDelay: labelVisible
                        ? `${index * 30 + 60}ms`
                        : "0ms",
                    }}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>

          {!collapsed && (
            <>
              {/* Divider */}
              <div className="relative z-10 my-2 -mx-1.5 bg-border h-px" />

              {/* Projects + Chats section */}
              <SidebarProjectsSection
                projects={projects}
                projectSessions={filteredProjectSessions}
                expandedProjects={expandedProjects}
                toggleProject={toggleProject}
                collapsed={collapsed}
                labelTransition={labelTransition}
                labelVisible={labelVisible}
                activeSessionId={activeSessionId}
                onNavigate={onNavigate}
                onSelectSession={onSelectSession}
                onNewChatInProject={onNewChatInProject}
                onNewChat={onNewChat}
                onCreateProject={onCreateProject}
                onEditProject={onEditProject}
                onArchiveProject={onArchiveProject}
                onArchiveChat={onArchiveChat}
                onRenameChat={onRenameChat}
                onMoveToProject={onMoveToProject}
                onItemMouseEnter={onItemMouseEnter}
                activeSessionRefCallback={activeSessionRefCallback}
              />
            </>
          )}
        </nav>
      </div>
    </div>
  );
}
