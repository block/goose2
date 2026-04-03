import { useState, useEffect, useCallback, useRef } from "react";
import {
  MessageSquare,
  Plus,
  Trash2,
  MoreHorizontal,
  Pencil,
  FolderKanban,
} from "lucide-react";
import { SearchBar } from "@/shared/ui/SearchBar";
import { Button, buttonVariants } from "@/shared/ui/button";
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
import { CreateProjectDialog } from "./CreateProjectDialog";
import { deleteProject, type ProjectInfo } from "../api/projects";
import { useProjectStore } from "../stores/projectStore";

function ProjectCardMenu({
  project,
  onStartChat,
  onEdit,
  onDelete,
}: {
  project: ProjectInfo;
  onStartChat?: (project: ProjectInfo) => void;
  onEdit: (project: ProjectInfo) => void;
  onDelete: (project: ProjectInfo) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <div ref={menuRef} className="relative shrink-0">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={`Options for ${project.name}`}
        aria-haspopup="true"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((prev) => !prev)}
        className="size-6 rounded-md text-muted-foreground hover:text-foreground"
      >
        <MoreHorizontal className="size-3.5" />
      </Button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-10 mt-1 w-36 rounded-lg border border-border bg-background py-1 shadow-popover"
        >
          {onStartChat && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onStartChat(project);
              }}
              className="w-full justify-start"
            >
              <MessageSquare className="size-3.5" />
              Start Chat
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="xs"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onEdit(project);
            }}
            className="w-full justify-start"
          >
            <Pencil className="size-3.5" />
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onDelete(project);
            }}
            className="w-full justify-start text-destructive hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </div>
      )}
    </div>
  );
}

interface ProjectsViewProps {
  onStartChat?: (project: ProjectInfo) => void;
}

export function ProjectsView({ onStartChat }: ProjectsViewProps) {
  const fetchProjects = useProjectStore((s) => s.fetchProjects);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<
    | {
        id: string;
        name: string;
        description: string;
        prompt: string;
        icon: string;
        color: string;
        preferredProvider: string | null;
        preferredModel: string | null;
        workingDirs: string[];
        useWorktrees: boolean;
      }
    | undefined
  >(undefined);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingProject, setDeletingProject] = useState<ProjectInfo | null>(
    null,
  );

  const loadProjects = useCallback(async () => {
    try {
      await fetchProjects();
      setProjects(useProjectStore.getState().projects);
    } catch {
      // projects may not exist yet
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [fetchProjects]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleDelete = (project: ProjectInfo) => {
    setDeletingProject(project);
  };

  const handleConfirmDeleteProject = async () => {
    if (!deletingProject) return;
    try {
      await deleteProject(deletingProject.id);
      await loadProjects();
    } catch {
      // best-effort
    }
    setDeletingProject(null);
  };

  const handleEdit = (project: ProjectInfo) => {
    setEditingProject({
      id: project.id,
      name: project.name,
      description: project.description,
      prompt: project.prompt,
      icon: project.icon,
      color: project.color,
      preferredProvider: project.preferredProvider,
      preferredModel: project.preferredModel,
      workingDirs: project.workingDirs,
      useWorktrees: project.useWorktrees,
    });
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingProject(undefined);
  };

  const handleNewProject = () => {
    setEditingProject(undefined);
    setDialogOpen(true);
  };

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-1 flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-5xl mx-auto w-full px-6 py-8 space-y-5 page-transition">
          {/* Header */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold font-display tracking-tight">
                Projects
              </h1>
              <p className="text-xs text-muted-foreground">
                Organize your work into focused project contexts
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={handleNewProject}
              >
                <Plus className="size-3.5" />
                New Project
              </Button>
            </div>
          </div>

          {/* Search */}
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search projects by name or description..."
          />

          {/* Projects list */}
          {!loading && filtered.length > 0 && (
            <div className="space-y-2">
              {filtered.map((project) => (
                <div
                  key={project.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border px-4 py-3"
                >
                  <div className="min-w-0 flex-1 flex items-start gap-3">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{project.name}</p>
                      {project.prompt && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {project.prompt}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <ProjectCardMenu
                      project={project}
                      onStartChat={onStartChat}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  </div>
                </div>
              ))}

              {/* New Project card */}
              <Button
                type="button"
                variant="ghost"
                onClick={handleNewProject}
                className="h-auto w-full rounded-lg border border-dashed border-border px-4 py-3 text-muted-foreground hover:border-border hover:bg-accent/50"
              >
                <Plus className="size-4" />
                <span className="text-sm">New Project</span>
              </Button>
            </div>
          )}

          {/* Empty state */}
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground rounded-lg border border-dashed border-transparent">
              <FolderKanban className="h-10 w-10 opacity-30" />
              <div className="text-center">
                <p className="text-sm font-medium">
                  {projects.length === 0
                    ? "No projects yet"
                    : "No matching projects"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {projects.length === 0
                    ? "Create a project to organize your work."
                    : "Try a different search term."}
                </p>
              </div>
              {projects.length === 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={handleNewProject}
                  className="mt-2"
                >
                  <Plus className="size-3.5" />
                  New Project
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit dialog */}
      <CreateProjectDialog
        isOpen={dialogOpen}
        onClose={handleDialogClose}
        onCreated={loadProjects}
        editingProject={editingProject}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deletingProject}
        onOpenChange={(open) => !open && setDeletingProject(null)}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingProject?.name}
              &quot;? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={handleConfirmDeleteProject}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
