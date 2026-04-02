import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Bot,
  PanelLeft,
  PanelLeftClose,
  Plus,
  Search,
  User,
} from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { GooseIcon } from "@/shared/ui/icons/GooseIcon";
import type { AppView } from "@/app/AppShell";
import type { ProjectInfo } from "@/features/projects/api/projects";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { useChatSessionStore } from "@/features/chat/stores/chatSessionStore";
import { isSessionRunning } from "@/features/chat/lib/sessionActivity";
import { SidebarProjectsSection } from "./SidebarProjectsSection";

interface SidebarProps {
  collapsed: boolean;
  width?: number;
  onCollapse: () => void;
  onSettingsClick?: () => void;
  onSearchClick?: () => void;
  onNewChat?: () => void;
  onNewChatInProject?: (projectId: string) => void;
  onCreateProject?: () => void;
  onEditProject?: (projectId: string) => void;
  onArchiveProject?: (projectId: string) => void;
  onArchiveChat?: (sessionId: string) => void;
  onRenameChat?: (sessionId: string, nextTitle: string) => void;
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
];

const SIDEBAR_NAV_TEXT_CLASS =
  "text-foreground-subtle hover:text-foreground hover:bg-accent/50";
const EXPANDED_PROJECTS_STORAGE_KEY = "goose:sidebar:expanded-projects";

export function Sidebar({
  collapsed,
  width = 240,
  onCollapse,
  onSettingsClick,
  onSearchClick,
  onNewChat,
  onNewChatInProject,
  onCreateProject,
  onEditProject,
  onArchiveProject,
  onArchiveChat,
  onRenameChat,
  onNavigate,
  onSelectSession,
  activeView,
  activeSessionId,
  className,
  projects,
}: SidebarProps) {
  const [expanded, setExpanded] = useState(!collapsed);
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

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  return (
    <div
      className={cn(
        "relative h-full overflow-hidden bg-background border border-border",
        "transition-[width] duration-300 ease-in-out",
        className,
      )}
      style={{ width: collapsed ? 48 : width }}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div
          className={cn(
            "flex items-center px-3 py-3 border-b border-border flex-shrink-0",
            collapsed ? "justify-center" : "justify-between",
          )}
          data-tauri-drag-region
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => onNavigate?.("home")}
            className="flex shrink-0 items-center justify-center transition-opacity hover:opacity-70"
            aria-label="Home"
            title="Home"
          >
            <GooseIcon className="h-[18px] w-[18px]" />
          </Button>

          {!collapsed && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onCollapse}
              className={cn(
                "rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50",
                "transition-opacity duration-200",
              )}
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="size-4" />
            </Button>
          )}
        </div>

        {/* Expand button (collapsed only) */}
        <div
          className={cn(
            "flex justify-center py-1.5 flex-shrink-0 transition-all duration-300",
            collapsed
              ? "opacity-100 h-auto"
              : "opacity-0 h-0 overflow-hidden pointer-events-none",
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onCollapse}
            className="rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50"
            aria-label="Expand sidebar"
          >
            <PanelLeft className="size-4" />
          </Button>
        </div>

        {/* Search bar */}
        <div
          className={cn(
            "flex-shrink-0 transition-all duration-300 ease-out",
            collapsed ? "px-0 py-1.5 flex justify-center" : "px-3 py-2",
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size={collapsed ? "icon-xs" : "sm"}
            onClick={onSearchClick}
            className={cn(
              "rounded-md transition-all duration-300 ease-out",
              collapsed
                ? "mx-auto gap-0 text-muted-foreground hover:text-foreground hover:bg-accent/50"
                : "w-full gap-2 border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-border hover:bg-transparent",
            )}
            title={collapsed ? "Search ⌘K" : undefined}
          >
            <Search className="size-3.5 flex-shrink-0" />
            <span
              className={cn(
                labelTransition,
                labelVisible
                  ? "opacity-100 w-auto flex-1 text-left"
                  : "opacity-0 w-0 overflow-hidden",
              )}
            >
              Search...
            </span>
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
          </Button>
        </div>

        {/* Navigation (scrollable) */}
        <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-1.5 py-1">
          <div className="space-y-0.5">
            {/* New Chat */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onNewChat}
              title={collapsed ? "New Chat" : undefined}
              className={cn(
                "w-full rounded-md text-[13px]",
                SIDEBAR_NAV_TEXT_CLASS,
                collapsed
                  ? "justify-center gap-0 px-0 py-1.5"
                  : "justify-start gap-2.5 px-3 py-1.5",
              )}
            >
              <Plus className="size-4 flex-shrink-0" />
              <span
                className={cn(
                  labelTransition,
                  labelVisible
                    ? "opacity-100 w-auto"
                    : "opacity-0 w-0 overflow-hidden",
                )}
              >
                New Chat
              </span>
            </Button>

            {/* Nav items */}
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <Button
                  key={item.id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigate?.(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "w-full rounded-md text-[13px] transition-all duration-200",
                    collapsed
                      ? "justify-center gap-0 px-0 py-1.5"
                      : "justify-start gap-2.5 px-3 py-1.5",
                    isActive
                      ? "bg-muted text-foreground hover:bg-muted"
                      : SIDEBAR_NAV_TEXT_CLASS,
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="size-4 flex-shrink-0" />
                  <span
                    className={cn(
                      labelTransition,
                      labelVisible
                        ? "opacity-100 w-auto"
                        : "opacity-0 w-0 overflow-hidden",
                    )}
                  >
                    {item.label}
                  </span>
                </Button>
              );
            })}
          </div>

          {/* Divider */}
          <div
            className={cn(
              "my-2 mx-auto bg-border transition-all duration-300",
              collapsed ? "w-5 h-px" : "w-full h-px mx-1.5",
            )}
          />

          {/* Projects + Chats section */}
          <SidebarProjectsSection
            projects={projects}
            projectSessions={projectSessions}
            expandedProjects={expandedProjects}
            toggleProject={toggleProject}
            collapsed={collapsed}
            labelTransition={labelTransition}
            labelVisible={labelVisible}
            activeSessionId={activeSessionId}
            onNavigate={onNavigate}
            onSelectSession={onSelectSession}
            onNewChatInProject={onNewChatInProject}
            onCreateProject={onCreateProject}
            onEditProject={onEditProject}
            onArchiveProject={onArchiveProject}
            onArchiveChat={onArchiveChat}
            onRenameChat={onRenameChat}
          />
        </nav>

        {/* Footer */}
        <div
          className={cn(
            "flex items-center border-t border-border flex-shrink-0 transition-all duration-300",
            collapsed ? "justify-center px-0 py-2" : "px-3 py-2",
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onSettingsClick}
            className="bg-accent text-muted-foreground hover:bg-accent/80"
            title="Settings"
          >
            <User className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
