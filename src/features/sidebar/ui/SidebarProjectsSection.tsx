import { useState, useEffect, useRef } from "react";
import {
  ChevronDown,
  ChevronRight,
  MessageSquare,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { cn } from "@/shared/lib/cn";
import type { AppView } from "@/app/AppShell";
import type { ProjectInfo } from "@/features/projects/api/projects";
import { SidebarChatRow } from "./SidebarChatRow";

const MAX_VISIBLE_CHATS = 3;
const PROJECT_ROW_TEXT_CLASS =
  "text-foreground-subtle group-hover:text-foreground";

interface TabInfo {
  id: string;
  title: string;
  sessionId: string;
  projectId?: string;
  isOpenTab?: boolean;
  updatedAt?: string;
}

interface SidebarProjectsSectionProps {
  projects: ProjectInfo[];
  projectTabs: {
    byProject: Record<string, TabInfo[]>;
    standalone: TabInfo[];
  };
  expandedProjects: Record<string, boolean>;
  toggleProject: (projectId: string) => void;
  collapsed: boolean;
  labelTransition: string;
  labelVisible: boolean;
  activeTabId?: string | null;
  onNavigate?: (view: AppView) => void;
  onSelectTab?: (tabId: string) => void;
  onNewChatInProject?: (projectId: string) => void;
  onCreateProject?: () => void;
  onEditProject?: (projectId: string) => void;
  onArchiveProject?: (projectId: string) => void;
  onArchiveChat?: (tabId: string) => void;
  onRenameChat?: (tabId: string, nextTitle: string) => void;
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
      <button
        type="button"
        aria-label={`Options for ${label}`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className={cn(
          "flex items-center justify-center w-6 h-6 rounded-md",
          "text-foreground-secondary/40 hover:text-foreground",
          open
            ? "visible opacity-100"
            : "invisible group-hover:visible opacity-0 group-hover:opacity-100",
        )}
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-10 mt-1 w-28 rounded-lg border border-border bg-background py-1 shadow-lg"
        >
          {onEdit && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-background-secondary transition-colors"
            >
              Edit
            </button>
          )}
          {onArchive && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onArchive();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-background-secondary transition-colors"
            >
              Archive
            </button>
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
  activeTabId,
  onSelectTab,
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
  activeTabId?: string | null;
  onSelectTab?: (tabId: string) => void;
  onNewChatInProject?: (projectId: string) => void;
  onNavigate?: (view: AppView) => void;
  onEditProject?: (projectId: string) => void;
  onArchiveProject?: (projectId: string) => void;
  onArchiveChat?: (tabId: string) => void;
  onRenameChat?: (tabId: string, nextTitle: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleChats = showAll
    ? projectChats
    : projectChats.slice(0, MAX_VISIBLE_CHATS);
  const hasMore = projectChats.length > MAX_VISIBLE_CHATS;

  return (
    <div>
      {/* Project row */}
      <div className="flex items-center group rounded-md transition-colors duration-150 hover:bg-accent">
        <button
          type="button"
          onClick={() => toggleProject(project.id)}
          className={cn(
            "flex items-center flex-1 min-w-0 gap-1.5 py-1.5 px-2.5 text-[13px]",
            "transition-colors duration-150",
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
        </button>
        <ItemMenu
          label={project.name}
          onEdit={() => onEditProject?.(project.id)}
          onArchive={() => onArchiveProject?.(project.id)}
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNewChatInProject?.(project.id);
          }}
          title="New chat in project"
          className={cn(
            "flex items-center justify-center w-6 h-6 rounded-md mr-1 flex-shrink-0",
            "text-foreground-secondary/50 hover:text-foreground",
            "invisible group-hover:visible opacity-0 group-hover:opacity-100",
          )}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Nested chats */}
      {isExpanded && (
        <div className="mt-0.5 space-y-0.5">
          {visibleChats.map((tab) => {
            const isActive = activeTabId === tab.id;
            const isOpen = tab.isOpenTab ?? false;
            return (
              <SidebarChatRow
                key={tab.id}
                id={tab.id}
                title={tab.title}
                isActive={isActive}
                isOpen={isOpen}
                className="pl-5"
                onSelect={onSelectTab}
                onRename={onRenameChat}
                onArchive={onArchiveChat}
              />
            );
          })}
          {hasMore && (
            <button
              type="button"
              onClick={() => {
                if (showAll) {
                  setShowAll(false);
                } else {
                  // If more than 8 items, navigate to full view instead
                  if (projectChats.length > 8) {
                    onNavigate?.("projects");
                  } else {
                    setShowAll(true);
                  }
                }
              }}
              className={cn(
                "flex items-center gap-1.5 w-full pl-8 pr-3 py-1 text-[11px]",
                "text-foreground-secondary/60 hover:text-foreground-secondary transition-colors duration-150",
              )}
            >
              {showAll ? (
                <>
                  <ChevronDown className="w-3 h-3" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronRight className="w-3 h-3" />
                  {projectChats.length > 8
                    ? `View all ${projectChats.length} chats`
                    : `${projectChats.length - MAX_VISIBLE_CHATS} more`}
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function SidebarProjectsSection({
  projects,
  projectTabs,
  expandedProjects,
  toggleProject,
  collapsed,
  labelTransition,
  labelVisible,
  activeTabId,
  onNavigate,
  onSelectTab,
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
            "text-[10px] font-semibold uppercase tracking-wider text-foreground-secondary/70 flex-1 pl-1.5",
            labelTransition,
            labelVisible
              ? "opacity-100 w-auto"
              : "opacity-0 w-0 overflow-hidden",
          )}
        >
          Projects
        </span>
        {!collapsed && (
          <button
            type="button"
            onClick={onCreateProject}
            title="New project"
            className={cn(
              "flex items-center justify-center w-6 h-6 rounded-md flex-shrink-0 mr-1",
              "text-foreground-secondary/50 hover:text-foreground hover:bg-background-tertiary/50",
              "transition-opacity duration-150",
            )}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {collapsed ? (
        <div className="flex flex-col items-center gap-1">
          {projects.map((project) => (
            <button
              type="button"
              key={project.id}
              title={project.name}
              onClick={() => onNavigate?.("projects")}
              className={cn(
                "flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200",
                "text-foreground-secondary hover:text-foreground hover:bg-background-tertiary/50",
              )}
            >
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: project.color }}
              />
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-0.5">
          {projects.map((project) => (
            <ProjectSection
              key={project.id}
              project={project}
              projectChats={projectTabs.byProject[project.id] ?? []}
              isExpanded={expandedProjects[project.id] ?? false}
              toggleProject={toggleProject}
              activeTabId={activeTabId}
              onSelectTab={onSelectTab}
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
      {projectTabs.standalone.length > 0 && (
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
                "text-[10px] font-semibold uppercase tracking-wider text-foreground-secondary/70 pl-1.5",
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
              {projectTabs.standalone.map((tab) => (
                <button
                  type="button"
                  key={tab.id}
                  title={tab.title}
                  onClick={() => onSelectTab?.(tab.id)}
                  className={cn(
                    "flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200",
                    activeTabId === tab.id
                      ? "bg-background-tertiary/70 text-foreground"
                      : "text-foreground-secondary hover:text-foreground hover:bg-background-tertiary/50",
                  )}
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-0.5">
              {projectTabs.standalone.map((tab) => {
                const isActive = activeTabId === tab.id;
                const isOpen = tab.isOpenTab ?? false;
                return (
                  <SidebarChatRow
                    key={tab.id}
                    id={tab.id}
                    title={tab.title}
                    isActive={isActive}
                    isOpen={isOpen}
                    onSelect={onSelectTab}
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
