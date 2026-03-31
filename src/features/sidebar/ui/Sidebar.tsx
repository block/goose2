import { useEffect, useMemo, useRef, useState } from "react";
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
import { GooseIcon } from "@/shared/ui/icons/GooseIcon";
import type { AppView } from "@/app/AppShell";
import type { ProjectInfo } from "@/features/projects/api/projects";
import { useChatSessionStore } from "@/features/chat/stores/chatSessionStore";
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
  onArchiveChat?: (tabId: string) => void;
  onNavigate?: (view: AppView) => void;
  onSelectTab?: (tabId: string) => void;
  activeView?: AppView;
  activeTabId?: string | null;
  className?: string;
  // Project & tab data
  projects: ProjectInfo[];
}

const NAV_ITEMS: readonly { id: AppView; label: string; icon: typeof Bot }[] = [
  { id: "agents", label: "Personas", icon: Bot },
  { id: "skills", label: "Skills", icon: BookOpen },
];

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
  onNavigate,
  onSelectTab,
  activeView,
  activeTabId,
  className,
  projects,
}: SidebarProps) {
  const [expanded, setExpanded] = useState(!collapsed);
  const prevCollapsed = useRef(collapsed);
  const [expandedProjects, setExpandedProjects] = useState<
    Record<string, boolean>
  >({});

  // Read all sessions and open tab IDs from the store
  const { sessions, openTabIds } = useChatSessionStore();
  const openTabIdSet = useMemo(() => new Set(openTabIds), [openTabIds]);

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

  const labelTransition = "transition-all duration-300 ease-out";
  const labelVisible = expanded && !collapsed;

  const MAX_RECENTS = 20;

  const projectTabs = useMemo(() => {
    type SessionItem = {
      id: string;
      title: string;
      sessionId: string;
      projectId?: string;
      isOpenTab: boolean;
      updatedAt: string;
    };
    const byProject: Record<string, SessionItem[]> = {};
    const standalone: SessionItem[] = [];
    for (const session of sessions) {
      const item: SessionItem = {
        id: session.id,
        title: session.title,
        sessionId: session.id,
        projectId: session.projectId,
        isOpenTab: openTabIdSet.has(session.id),
        updatedAt: session.updatedAt,
      };
      if (session.projectId) {
        if (!byProject[session.projectId]) byProject[session.projectId] = [];
        byProject[session.projectId].push(item);
      } else {
        standalone.push(item);
      }
    }
    // Sort standalone by updatedAt descending, limit to MAX_RECENTS
    standalone.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    const limitedStandalone = standalone.slice(0, MAX_RECENTS);
    return { byProject, standalone: limitedStandalone };
  }, [sessions, openTabIdSet]);

  // Auto-expand the project containing the active tab
  useEffect(() => {
    if (!activeTabId) return;
    const activeSession = sessions.find((s) => s.id === activeTabId);
    const projectId = activeSession?.projectId;
    if (projectId) {
      setExpandedProjects((prev) => {
        if (prev[projectId]) return prev;
        return { ...prev, [projectId]: true };
      });
    }
  }, [activeTabId, sessions]);

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  return (
    <div
      className={cn(
        "relative h-full overflow-hidden bg-background-secondary border border-border-secondary/50",
        "transition-[width] duration-300 ease-in-out",
        className,
      )}
      style={{ width: collapsed ? 48 : width }}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-3 border-b border-border-secondary flex-shrink-0"
          data-tauri-drag-region
        >
          <button
            type="button"
            onClick={() => onNavigate?.("home")}
            className="hover:opacity-70 transition-opacity flex-shrink-0"
            title="Home"
          >
            <GooseIcon className="w-[18px] h-[18px]" />
          </button>

          <button
            type="button"
            onClick={onCollapse}
            className={cn(
              "flex items-center justify-center w-7 h-7 rounded-md",
              "text-foreground-secondary hover:text-foreground hover:bg-background-tertiary/50",
              "transition-opacity duration-200",
              collapsed ? "opacity-0 pointer-events-none" : "opacity-100",
            )}
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
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
          <button
            type="button"
            onClick={onCollapse}
            className={cn(
              "flex items-center justify-center w-7 h-7 rounded-md",
              "text-foreground-secondary hover:text-foreground hover:bg-background-tertiary/50",
            )}
            aria-label="Expand sidebar"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Search bar */}
        <div
          className={cn(
            "flex-shrink-0 transition-all duration-300 ease-out",
            collapsed ? "px-0 py-1.5 flex justify-center" : "px-3 py-2",
          )}
        >
          <button
            type="button"
            onClick={onSearchClick}
            className={cn(
              "flex items-center rounded-md transition-all duration-300 ease-out",
              collapsed
                ? "justify-center w-7 h-7 mx-auto text-foreground-secondary hover:text-foreground hover:bg-background-tertiary/50"
                : "gap-2 w-full px-2.5 py-1.5 border border-border-secondary text-xs text-foreground-secondary hover:text-foreground hover:border-foreground-secondary/30",
            )}
            title={collapsed ? "Search ⌘K" : undefined}
          >
            <Search className="w-3.5 h-3.5 flex-shrink-0" />
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
                "text-[10px] text-foreground-tertiary px-1 py-0.5 rounded font-mono flex-shrink-0",
                labelTransition,
                labelVisible
                  ? "opacity-100 w-auto"
                  : "opacity-0 w-0 overflow-hidden px-0",
              )}
            >
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Navigation (scrollable) */}
        <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-1.5 py-1">
          <div className="space-y-0.5">
            {/* New Chat */}
            <button
              type="button"
              onClick={onNewChat}
              title={collapsed ? "New Chat" : undefined}
              className={cn(
                "flex items-center w-full rounded-md text-[13px] transition-all duration-200 text-foreground-secondary hover:text-foreground hover:bg-background-tertiary/50",
                collapsed
                  ? "justify-center px-0 py-1.5"
                  : "gap-2.5 px-3 py-1.5",
              )}
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
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
            </button>

            {/* Nav items */}
            {NAV_ITEMS.map((item, index) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate?.(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center w-full rounded-md text-[13px] transition-all duration-200",
                    collapsed
                      ? "justify-center px-0 py-1.5"
                      : "gap-2.5 px-3 py-1.5",
                    isActive
                      ? "bg-background-secondary text-foreground"
                      : "text-foreground-secondary hover:text-foreground hover:bg-background-tertiary/50",
                  )}
                  aria-current={isActive ? "page" : undefined}
                  style={{
                    transitionDelay:
                      !collapsed && expanded ? `${index * 30}ms` : "0ms",
                  }}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span
                    className={cn(
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

          {/* Divider */}
          <div
            className={cn(
              "my-2 mx-auto bg-border-secondary transition-all duration-300",
              collapsed ? "w-5 h-px" : "w-full h-px mx-1.5",
            )}
          />

          {/* Projects + Chats section */}
          <SidebarProjectsSection
            projects={projects}
            projectTabs={projectTabs}
            expandedProjects={expandedProjects}
            toggleProject={toggleProject}
            collapsed={collapsed}
            labelTransition={labelTransition}
            labelVisible={labelVisible}
            activeTabId={activeTabId}
            onNavigate={onNavigate}
            onSelectTab={onSelectTab}
            onNewChatInProject={onNewChatInProject}
            onCreateProject={onCreateProject}
            onEditProject={onEditProject}
            onArchiveProject={onArchiveProject}
            onArchiveChat={onArchiveChat}
          />
        </nav>

        {/* Footer */}
        <div
          className={cn(
            "flex items-center border-t border-border-secondary flex-shrink-0 transition-all duration-300",
            collapsed ? "justify-center px-0 py-2" : "px-3 py-2",
          )}
        >
          <button
            type="button"
            onClick={onSettingsClick}
            className="w-7 h-7 rounded-full bg-background-tertiary flex items-center justify-center overflow-hidden hover:bg-background-tertiary/80 transition-colors cursor-pointer"
            title="Settings"
          >
            <User className="w-3.5 h-3.5 text-foreground-secondary" />
          </button>
        </div>
      </div>
    </div>
  );
}
