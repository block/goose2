import { useState, useEffect } from "react";
import { X, FolderOpen } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { createProject, updateProject } from "../api/projects";
import { discoverAcpProviders, type AcpProvider } from "@/shared/api/acp";

const COLOR_OPTIONS = [
  "#64748b",
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#22c55e",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#ec4899",
  "#f43f5e",
];

interface CreateProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  editingProject?: {
    id: string;
    name: string;
    description: string;
    prompt: string;
    icon: string;
    color: string;
    preferredProvider: string | null;
    preferredModel: string | null;
    workingDir: string | null;
    useWorktrees: boolean;
  };
}

export function CreateProjectDialog({
  isOpen,
  onClose,
  onCreated,
  editingProject,
}: CreateProjectDialogProps) {
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const icon = "\u{1F4C1}";
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [preferredProvider, setPreferredProvider] = useState<string | null>(
    null,
  );
  const preferredModel: string | null = null;
  const [workingDir, setWorkingDir] = useState<string | null>(null);
  const [useWorktrees, setUseWorktrees] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acpProviders, setAcpProviders] = useState<AcpProvider[]>([]);

  const isEditing = !!editingProject;

  useEffect(() => {
    discoverAcpProviders()
      .then(setAcpProviders)
      .catch(() => setAcpProviders([]));
  }, []);

  const handleBrowseFolder = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Working Directory",
      });
      if (selected && typeof selected === "string") {
        setWorkingDir(selected);
      }
    } catch {
      // Dialog plugin not available — user can type manually
    }
  };

  // Pre-fill fields when editing, reset to defaults for new
  useEffect(() => {
    if (isOpen && editingProject) {
      setName(editingProject.name);
      setPrompt(editingProject.prompt);
      setColor(editingProject.color);
      setPreferredProvider(editingProject.preferredProvider ?? null);
      setWorkingDir(editingProject.workingDir ?? null);
      setUseWorktrees(editingProject.useWorktrees);
      setError(null);
    } else if (isOpen) {
      setName("");
      setPrompt("");
      setColor(COLOR_OPTIONS[0]);
      setPreferredProvider(null);
      setWorkingDir(null);
      setUseWorktrees(false);
      setError(null);
    }
  }, [isOpen, editingProject]);

  const canSave = name.trim().length > 0 && !saving;

  const handleClose = () => {
    setName("");
    setPrompt("");
    setColor(COLOR_OPTIONS[0]);
    setPreferredProvider(null);
    setWorkingDir(null);
    setUseWorktrees(false);
    setError(null);
    onClose();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      if (isEditing) {
        await updateProject(
          editingProject.id,
          name.trim(),
          "",
          prompt,
          icon,
          color,
          preferredProvider || null,
          preferredModel,
          workingDir?.trim() || null,
          useWorktrees,
        );
      } else {
        await createProject(
          name.trim(),
          "",
          prompt,
          icon,
          color,
          preferredProvider || null,
          preferredModel,
          workingDir?.trim() || null,
          useWorktrees,
        );
      }
      onCreated();
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? "Edit Project" : "New Project"}
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 motion-safe:animate-in motion-safe:fade-in"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={cn(
          "relative z-10 w-full max-w-lg rounded-xl border border-border bg-background shadow-xl",
          "max-h-[85vh] flex flex-col",
          "motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95",
        )}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">
            {isEditing ? "Edit Project" : "New Project"}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={handleClose}
            className="rounded-md p-1 text-foreground-secondary hover:bg-background-secondary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <form
          id="project-form"
          onSubmit={handleSave}
          className="min-h-0 flex-1 overflow-y-auto space-y-4 p-5"
        >
          {/* Name */}
          <label className="block space-y-1">
            <span className="text-xs font-medium text-foreground-secondary">
              Name <span className="text-foreground-danger">*</span>
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="My Project"
              className={cn(
                "w-full rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm",
                "placeholder:text-foreground-secondary/40",
                "focus:outline-none focus:ring-1 focus:ring-ring transition-colors",
              )}
            />
          </label>

          {/* Prompt */}
          <label className="block space-y-1">
            <span className="text-xs font-medium text-foreground-secondary">
              Prompt
            </span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={8}
              placeholder="System prompt or context for agents working in this project..."
              className={cn(
                "w-full resize-y rounded-lg border border-border bg-background-secondary px-3 py-2 text-xs font-mono leading-relaxed",
                "placeholder:text-foreground-secondary/40",
                "focus:outline-none focus:ring-1 focus:ring-ring transition-colors",
              )}
            />
          </label>

          {/* Color */}
          <div className="block space-y-1">
            <span className="text-xs font-medium text-foreground-secondary">
              Color
            </span>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-6 w-6 rounded-full border-2 transition-transform",
                    color === c
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-105",
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>

          {/* Provider */}
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-foreground-secondary">
              Provider
            </span>
            <select
              value={preferredProvider ?? ""}
              onChange={(e) => setPreferredProvider(e.target.value || null)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">None (use default)</option>
              {acpProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          {/* Working Directory */}
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-foreground-secondary">
              Working Directory
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                value={workingDir ?? ""}
                onChange={(e) => setWorkingDir(e.target.value || null)}
                placeholder="/path/to/project"
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-foreground-tertiary focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                type="button"
                onClick={handleBrowseFolder}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-border hover:bg-background-tertiary transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Browse
              </button>
            </div>
          </label>

          {/* Use Worktrees */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useWorktrees}
              onChange={(e) => setUseWorktrees(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-brand"
            />
            <span className="text-xs font-medium text-foreground-secondary">
              Use git worktrees for branch isolation
            </span>
          </label>

          {/* Error */}
          {error && <p className="text-xs text-foreground-danger">{error}</p>}
        </form>

        {/* Footer */}
        <div className="shrink-0 border-t border-border px-5 py-4 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="project-form"
            size="sm"
            disabled={!canSave}
          >
            {saving
              ? isEditing
                ? "Saving..."
                : "Creating..."
              : isEditing
                ? "Save Changes"
                : "Create Project"}
          </Button>
        </div>
      </div>
    </div>
  );
}
