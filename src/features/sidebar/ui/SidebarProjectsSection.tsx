import { useState, useEffect, useRef } from "react";
import {
  ChevronDown,
  ChevronRight,
  MessageSquare,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import type { AppView } from "@/app/AppShell";
import type { ProjectInfo } from "@/features/projects/api/projects";
import { SessionActivityIndicator } from "@/shared/ui/SessionActivityIndicator";
import { SidebarChatRow } from "./SidebarChatRow";

const MAX_VISIBLE_CHATS = 3;
const PROJECT_ROW_TEXT_CLASS =
  "text-foreground-subtle group-hover:text-foreground hover:bg-transparent";

interface TabInfo {
  id: string;
  title: string;
  sessionId: string;
  projectId?: string;
  updatedAt?: string;
  isRunning?: boolean;
  hasUnread?: boolean;
}

interface SidebarProjectsSectionProps {
  projects: ProjectInfo[];
  projectSessions: {
    byProject: Record<string, TabInfo[]>;
    standalone: TabInfo[];
  };
  expandedProjects: Record<string, boolean>;
  toggleProject: (projectId: string) => void;
  collapsed: boolean;
  labelTransition: string;
  labelVisible: boolean;
  activeSessionId?: string | null;
  onNavigate?: (view: AppView) => void;
  onSelectSession?: (sessionId: string) => void;
  onNewChatInProject?: (projectId: string) => void;
  onCreateProject?: () => void;
  onEditProject?: (projectId: string) => void;
  onArchiveProject?: (projectId: string) => void;
  onArchiveChat?: (sessionId: string) => void;
  onRenameChat?: (sessionId: string, nextTitle: string) => void;
}

function ItemMenu({
  label,
  onEdit,
  onArchive,
}: {
  label: string;
  onEdit?: () => void;
  onArchive?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={`Options for ${label}`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className={cn(
          "size-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50",
          open
            ? "visible opacity-100"
            : "invisible group-hover:visible opacity-0 group-hover:opacity-100",
        )}
      >
        <MoreHorizontal className="size-3.5" />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-10 mt-1 w-28 rounded-lg border border-border bg-background py-1 shadow-popover"
        >
          {onEdit && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
              className="w-full justify-start"
            >
              Edit
            </Button>
          )}
          {onArchive && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onArchive();
              }}
              className="w-full justify-start"
            >
              Archive
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function ProjectSection({
  project,
  projectChats,
  isExpanded,
  toggleProject,
  activeSessionId,
  onSelectSession,
  onNewChatInProject,
  onNavigate,
  onEditProject,
  onArchiveProject,
  onArchiveChat,
  onRenameChat,
}: {
  project: ProjectInfo;
  projectChats: TabInfo[];
  isExpanded: boolean;
  toggleProject: (projectId: string) => void;
  activeSessionId?: string | null;
  onSelectSession?: (sessionId: string) => void;
  onNewChatInProject?: (projectId: string) => void;
  onNavigate?: (view: AppView) => void;
  onEditProject?: (projectId: string) => void;
  onArchiveProject?: (projectId: string) => void;
  onArchiveChat?: (sessionId: string) => void;
  onRenameChat?: (sessionId: string, nextTitle: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleChats = showAll
    ? projectChats
    : projectChats.slice(0, MAX_VISIBLE_CHATS);
  const hasMore = projectChats.length > MAX_VISIBLE_CHATS;

  return (
    <div>
      {/* Project row */}
      <div className="flex items-center group rounded-md transition-colors duration-150 hover:bg-accent/50">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => toggleProject(project.id)}
          className={cn(
            "flex-1 min-w-0 justify-start gap-1.5 rounded-md px-2.5 py-1.5 text-[13px]",
            PROJECT_ROW_TEXT_CLASS,
          )}
        >
          <span className="relative flex h-3 w-3 flex-shrink-0 items-center justify-center">
            <span
              className="absolute inline-block h-2 w-2 rounded-full transition-opacity duration-150 group-hover:opacity-0"
              style={{ backgroundColor: project.color }}
            />
            {isExpanded ? (
              <ChevronDown className="absolute h-3 w-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
            ) : (
              <ChevronRight className="absolute h-3 w-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
            )}
          </span>
          <span className="flex-1 min-w-0 truncate text-left">
            {project.name}
          </span>
        </Button>
        <ItemMenu
          label={project.name}
          onEdit={() => onEditProject?.(project.id)}
          onArchive={() => onArchiveProject?.(project.id)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={(e) => {
            e.stopPropagation();
            onNewChatInProject?.(project.id);
          }}
          title="New chat in project"
          className={cn(
            "mr-1 size-6 flex-shrink-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50",
            "invisible group-hover:visible opacity-0 group-hover:opacity-100",
          )}
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      {/* Nested chats */}
      {isExpanded && (
        <div className="mt-0.5 space-y-0.5">
          {visibleChats.map((session) => {
            const isActive = activeSessionId === session.id;
            return (
              <SidebarChatRow
                key={session.id}
                id={session.id}
                title={session.title}
                isActive={isActive}
                isRunning={session.isRunning ?? false}
                hasUnread={session.hasUnread ?? false}
                className="pl-5"
                onSelect={onSelectSession}
                onRename={onRenameChat}
                onArchive={onArchiveChat}
              />
            );
          })}
          {hasMore && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => {
                if (showAll) {
                  setShowAll(false);
                } else {
                  if (projectChats.length > 8) {
                    onNavigate?.("projects");
                  } else {
                    setShowAll(true);
                  }
                }
              }}
              className="h-auto w-full justify-start gap-1.5 rounded-md py-1 pl-8 pr-3 text-[11px] text-muted-foreground hover:text-muted-foreground"
            >
              {showAll ? (
                <>
                  <ChevronDown className="size-3" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronRight className="size-3" />
                  {projectChats.length > 8
                    ? `View all ${projectChats.length} chats`
                    : `${projectChats.length - MAX_VISIBLE_CHATS} more`}
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function SidebarProjectsSection({
  projects,
  projectSessions,
  expandedProjects,
  toggleProject,
  collapsed,
  labelTransition,
  labelVisible,
  activeSessionId,
  onNavigate,
  onSelectSession,
  onNewChatInProject,
  onCreateProject,
  onEditProject,
  onArchiveProject,
  onArchiveChat,
  onRenameChat,
}: SidebarProjectsSectionProps) {
  return (
    <div
      className={cn(
        labelTransition,
        labelVisible
          ? "opacity-100 max-h-[2000px]"
          : collapsed
            ? "opacity-100 max-h-[2000px]"
            : "opacity-0 max-h-0 overflow-hidden",
      )}
    >
      {/* --- PROJECTS (always visible) --- */}
      {/* Section header with [+] button */}
      <div
        className={cn(
          "flex items-center transition-all duration-300",
          collapsed ? "px-0 pt-0 pb-1 justify-center" : "pt-2 pb-1",
        )}
      >
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex-1 pl-1.5",
            labelTransition,
            labelVisible
              ? "opacity-100 w-auto"
              : "opacity-0 w-0 overflow-hidden",
          )}
        >
          Projects
        </span>
        {!collapsed && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onCreateProject}
            title="New project"
            className="mr-1 size-6 flex-shrink-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50"
          >
            <Plus className="size-3.5" />
          </Button>
        )}
      </div>

      {collapsed ? (
        <div className="flex flex-col items-center gap-1">
          {projects.map((project) => (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              key={project.id}
              title={project.name}
              onClick={() => onNavigate?.("projects")}
              className="rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50"
            >
              <span
                className="inline-block size-2.5 rounded-full"
                style={{ backgroundColor: project.color }}
              />
            </Button>
          ))}
        </div>
      ) : (
        <div className="space-y-0.5">
          {projects.map((project) => (
            <ProjectSection
              key={project.id}
              project={project}
              projectChats={projectSessions.byProject[project.id] ?? []}
              isExpanded={expandedProjects[project.id] ?? false}
              toggleProject={toggleProject}
              activeSessionId={activeSessionId}
              onSelectSession={onSelectSession}
              onNewChatInProject={onNewChatInProject}
              onNavigate={onNavigate}
              onEditProject={onEditProject}
              onArchiveProject={onArchiveProject}
              onArchiveChat={onArchiveChat}
              onRenameChat={onRenameChat}
            />
          ))}
        </div>
      )}

      {/* --- RECENTS (standalone chats from all sessions) --- */}
      {projectSessions.standalone.length > 0 && (
        <>
          {/* Section header (expanded only) */}
          <div
            className={cn(
              "flex items-center transition-all duration-300",
              collapsed ? "px-0 pt-0 pb-1 justify-center" : "pt-2 pb-1",
            )}
          >
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pl-1.5",
                labelTransition,
                labelVisible
                  ? "opacity-100 w-auto"
                  : "opacity-0 w-0 overflow-hidden",
              )}
            >
              Recents
            </span>
          </div>

          {collapsed ? (
            <div className="flex flex-col items-center gap-1">
              {projectSessions.standalone.map((session) => (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  key={session.id}
                  title={session.title}
                  onClick={() => onSelectSession?.(session.id)}
                  className={cn(
                    "relative rounded-lg",
                    activeSessionId === session.id
                      ? "bg-accent/70 text-foreground hover:bg-accent/70"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                  )}
                >
                  <MessageSquare className="size-4" />
                  <SessionActivityIndicator
                    isRunning={session.isRunning}
                    hasUnread={session.hasUnread}
                    variant="overlay"
                  />
                </Button>
              ))}
            </div>
          ) : (
            <div className="space-y-0.5">
              {projectSessions.standalone.map((session) => {
                const isActive = activeSessionId === session.id;
                return (
                  <SidebarChatRow
                    key={session.id}
                    id={session.id}
                    title={session.title}
                    isActive={isActive}
                    isRunning={session.isRunning ?? false}
                    hasUnread={session.hasUnread ?? false}
                    onSelect={onSelectSession}
                    onRename={onRenameChat}
                    onArchive={onArchiveChat}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
