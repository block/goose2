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

const MAX_VISIBLE_CHATS = 3;

interface TabInfo {
  id: string;
  title: string;
  sessionId: string;
  projectId?: string;
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
          "text-foreground-secondary/40 hover:text-foreground hover:bg-background-tertiary/50",
          open ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          "transition-opacity duration-150",
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
}) {
  const visibleChats = projectChats.slice(0, MAX_VISIBLE_CHATS);
  const hasMore = projectChats.length > MAX_VISIBLE_CHATS;

  return (
    <div>
      {/* Project row */}
      <div className="flex items-center group">
        <button
          type="button"
          onClick={() => toggleProject(project.id)}
          className={cn(
            "flex items-center flex-1 min-w-0 gap-2 py-1.5 px-2.5 rounded-md text-[13px]",
            "transition-colors duration-150",
            "text-foreground-secondary hover:text-foreground hover:bg-background-tertiary/50",
          )}
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 flex-shrink-0" />
          )}
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: project.color }}
          />
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
            "text-foreground-secondary/50 hover:text-foreground hover:bg-background-tertiary/50",
            "opacity-0 group-hover:opacity-100 transition-opacity duration-150",
          )}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Nested chats */}
      {isExpanded && (
        <div className="space-y-0.5">
          {visibleChats.map((tab) => {
            const isActive = activeTabId === tab.id;
            return (
              <div key={tab.id} className="flex items-center group">
                <button
                  type="button"
                  onClick={() => onSelectTab?.(tab.id)}
                  className={cn(
                    "flex items-center gap-2 flex-1 min-w-0 py-1.5 pl-8 pr-1 rounded-md text-[13px]",
                    "transition-colors duration-150",
                    isActive
                      ? "bg-background-tertiary/70 text-foreground"
                      : "text-foreground-secondary hover:text-foreground hover:bg-background-tertiary/50",
                  )}
                >
                  <span className="flex-1 min-w-0 truncate text-left">
                    {tab.title}
                  </span>
                </button>
                <ItemMenu
                  label={tab.title}
                  onArchive={() => onArchiveChat?.(tab.id)}
                />
              </div>
            );
          })}
          {hasMore && (
            <button
              type="button"
              onClick={() => onNavigate?.("projects")}
              className={cn(
                "flex items-center w-full py-1 pl-8 pr-2.5 rounded-md text-[11px]",
                "text-foreground-secondary/60 hover:text-foreground-secondary transition-colors duration-150",
              )}
            >
              View all {projectChats.length} chats
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
            />
          ))}
        </div>
      )}

      {/* --- STANDALONE CHATS --- */}
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
              Chats
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
                return (
                  <div key={tab.id} className="flex items-center group">
                    <button
                      type="button"
                      onClick={() => onSelectTab?.(tab.id)}
                      className={cn(
                        "flex items-center gap-2 flex-1 min-w-0 py-1.5 rounded-md text-[13px]",
                        "transition-colors duration-150 px-2.5",
                        isActive
                          ? "bg-background-tertiary/70 text-foreground"
                          : "text-foreground-secondary hover:text-foreground hover:bg-background-tertiary/50",
                      )}
                    >
                      <span className="flex-1 min-w-0 truncate text-left">
                        {tab.title}
                      </span>
                    </button>
                    <ItemMenu
                      label={tab.title}
                      onArchive={() => onArchiveChat?.(tab.id)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
