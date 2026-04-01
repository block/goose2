import { useState, useEffect } from "react";
import { cn } from "@/shared/lib/cn";
import { buttonVariants } from "@/shared/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import {
  Palette,
  Settings2,
  FolderKanban,
  Info,
  MessageSquare,
  Stethoscope,
  X,
} from "lucide-react";
import { AppearanceSettings } from "./AppearanceSettings";
import { DoctorSettings } from "./DoctorSettings";
import {
  listArchivedProjects,
  restoreProject,
  deleteProject,
  type ProjectInfo,
} from "@/features/projects/api/projects";
import { useChatSessionStore } from "@/features/chat/stores/chatSessionStore";
import { useProjectStore } from "@/features/projects/stores/projectStore";
import { listArchivedSessions } from "@/shared/api/chat";
import type { Session } from "@/shared/types/chat";

const NAV_ITEMS = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "general", label: "General", icon: Settings2 },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "chats", label: "Chats", icon: MessageSquare },
  { id: "doctor", label: "Doctor", icon: Stethoscope },
  { id: "about", label: "About", icon: Info },
] as const;

type SectionId = (typeof NAV_ITEMS)[number]["id"];

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<SectionId>("appearance");
  const [isLoaded, setIsLoaded] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [archivedProjects, setArchivedProjects] = useState<ProjectInfo[]>([]);
  const [archivedChats, setArchivedChats] = useState<Session[]>([]);
  const [loadingArchived, setLoadingArchived] = useState(true);
  const [loadingArchivedChats, setLoadingArchivedChats] = useState(true);
  const [deletingProject, setDeletingProject] = useState<ProjectInfo | null>(
    null,
  );

  // Trigger entrance animations after mount
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Load archived projects on mount
  useEffect(() => {
    listArchivedProjects()
      .then(setArchivedProjects)
      .catch(() => setArchivedProjects([]))
      .finally(() => setLoadingArchived(false));
  }, []);

  // Load archived chats on mount
  useEffect(() => {
    listArchivedSessions()
      .then(setArchivedChats)
      .catch(() => setArchivedChats([]))
      .finally(() => setLoadingArchivedChats(false));
  }, []);

  const handleRestoreProject = async (id: string) => {
    try {
      await restoreProject(id);
      await useProjectStore.getState().fetchProjects();
      setArchivedProjects((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // best-effort
    }
  };

  const handleRestoreChat = async (id: string) => {
    try {
      await useChatSessionStore.getState().unarchiveSession(id);
      setArchivedChats((prev) => prev.filter((session) => session.id !== id));
    } catch {
      // best-effort
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProject(id);
      setArchivedProjects((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // best-effort
    }
  };

  // Content transition on section change
  // biome-ignore lint/correctness/useExhaustiveDependencies: activeSection triggers the transition effect intentionally
  useEffect(() => {
    setIsTransitioning(true);
    const timer = setTimeout(() => setIsTransitioning(false), 150);
    return () => clearTimeout(timer);
  }, [activeSection]);

  return (
    <div
      role="dialog"
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm transition-opacity duration-300",
        isLoaded ? "opacity-100" : "opacity-0",
      )}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation on inner container is not a meaningful interaction */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: click handler only prevents backdrop dismiss propagation */}
      <div
        className={cn(
          "flex h-[600px] w-full max-w-3xl overflow-hidden rounded-xl border bg-background shadow-modal transition-all duration-500 ease-out",
          isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95",
          isTransitioning ? "scale-[0.98]" : "scale-100",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar */}
        <div
          className={cn(
            "flex w-44 flex-col border-r bg-muted/50 transition-all duration-700 ease-out",
            isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2",
          )}
        >
          <div
            className={cn(
              "px-4 py-4 transition-all duration-500 ease-out",
              isLoaded
                ? "opacity-100 translate-x-0"
                : "opacity-0 -translate-x-2",
            )}
          >
            <h2 className="text-sm font-semibold">Settings</h2>
          </div>
          <nav className="flex flex-col gap-1 px-2">
            {NAV_ITEMS.map((item, index) => (
              <button
                type="button"
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all duration-600 ease-out",
                  activeSection === item.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground duration-300",
                  isLoaded
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 translate-x-4",
                )}
                style={{
                  transitionDelay: isLoaded ? "0ms" : `${index * 40 + 300}ms`,
                }}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="relative flex-1 overflow-y-auto">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>

          <div
            className={cn(
              "px-6 py-4 transition-all duration-400 ease-out",
              isTransitioning
                ? "opacity-0 translate-y-2"
                : "opacity-100 translate-y-0",
            )}
          >
            <div
              className={cn(
                "transition-all duration-600 ease-out",
                isLoaded
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4",
              )}
              style={{
                transitionDelay: isLoaded ? "400ms" : "0ms",
              }}
            >
              {activeSection === "appearance" && <AppearanceSettings />}
              {activeSection === "doctor" && <DoctorSettings />}
              {activeSection === "general" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold">General</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      General settings will appear here.
                    </p>
                  </div>
                </div>
              )}
              {activeSection === "projects" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold">Projects</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Manage your projects.
                    </p>
                  </div>

                  {/* Archived Projects */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">Archived Projects</h3>
                    {!loadingArchived && archivedProjects.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No archived projects.
                      </p>
                    )}
                    {archivedProjects.map((project) => (
                      <div
                        key={project.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: project.color }}
                          />
                          <span className="text-sm truncate">
                            {project.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleRestoreProject(project.id)}
                            className="px-2 py-1 text-xs font-medium rounded-md border border-border hover:bg-accent/50 transition-colors"
                          >
                            Restore
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingProject(project)}
                            className="px-2 py-1 text-xs font-medium rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {activeSection === "chats" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold">Chats</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Restore archived chats.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">Archived Chats</h3>
                    {!loadingArchivedChats && archivedChats.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No archived chats.
                      </p>
                    )}
                    {archivedChats.map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm">
                            {session.title}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {session.projectId
                              ? "Project chat"
                              : "Standalone chat"}{" "}
                            -{" "}
                            {session.messageCount === 1
                              ? "1 message"
                              : `${session.messageCount} messages`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRestoreChat(session.id)}
                          className="flex-shrink-0 rounded-md border border-border px-2 py-1 text-xs font-medium transition-colors hover:bg-accent/50"
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {activeSection === "about" && (
                <div>
                  <h3 className="text-lg font-semibold">About</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    About information will appear here.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AlertDialog
        open={!!deletingProject}
        onOpenChange={(open) => !open && setDeletingProject(null)}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete &quot;
              {deletingProject?.name}&quot;? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => {
                if (deletingProject) {
                  handleDelete(deletingProject.id);
                  setDeletingProject(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
