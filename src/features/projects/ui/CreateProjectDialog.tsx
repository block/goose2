import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { createProject, updateProject } from "../api/projects";

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
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [icon, setIcon] = useState("\u{1F4C1}");
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [preferredProvider, setPreferredProvider] = useState("");
  const [preferredModel, setPreferredModel] = useState("");
  const [workingDir, setWorkingDir] = useState("");
  const [useWorktrees, setUseWorktrees] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!editingProject;

  // Pre-fill fields when editing, reset to defaults for new
  useEffect(() => {
    if (isOpen && editingProject) {
      setName(editingProject.name);
      setDescription(editingProject.description);
      setPrompt(editingProject.prompt);
      setIcon(editingProject.icon);
      setColor(editingProject.color);
      setPreferredProvider(editingProject.preferredProvider ?? "");
      setPreferredModel(editingProject.preferredModel ?? "");
      setWorkingDir(editingProject.workingDir ?? "");
      setUseWorktrees(editingProject.useWorktrees);
      setError(null);
    } else if (isOpen) {
      setName("");
      setDescription("");
      setPrompt("");
      setIcon("\u{1F4C1}");
      setColor(COLOR_OPTIONS[0]);
      setPreferredProvider("");
      setPreferredModel("");
      setWorkingDir("");
      setUseWorktrees(false);
      setError(null);
    }
  }, [isOpen, editingProject]);

  const canSave = name.trim().length > 0 && !saving;

  const handleClose = () => {
    setName("");
    setDescription("");
    setPrompt("");
    setIcon("\u{1F4C1}");
    setColor(COLOR_OPTIONS[0]);
    setPreferredProvider("");
    setPreferredModel("");
    setWorkingDir("");
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
          description.trim(),
          prompt,
          icon,
          color,
          preferredProvider.trim() || null,
          preferredModel.trim() || null,
          workingDir.trim() || null,
          useWorktrees,
        );
      } else {
        await createProject(
          name.trim(),
          description.trim(),
          prompt,
          icon,
          color,
          preferredProvider.trim() || null,
          preferredModel.trim() || null,
          workingDir.trim() || null,
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

          {/* Description */}
          <label className="block space-y-1">
            <span className="text-xs font-medium text-foreground-secondary">
              Description
            </span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of this project..."
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

          {/* Icon & Color row */}
          <div className="flex gap-4">
            {/* Icon */}
            <label className="block space-y-1">
              <span className="text-xs font-medium text-foreground-secondary">
                Icon
              </span>
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className={cn(
                  "w-16 rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm text-center",
                  "focus:outline-none focus:ring-1 focus:ring-ring transition-colors",
                )}
              />
            </label>

            {/* Color */}
            <div className="block space-y-1 flex-1">
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
          </div>

          {/* Preferred Provider */}
          <label className="block space-y-1">
            <span className="text-xs font-medium text-foreground-secondary">
              Preferred Provider
            </span>
            <input
              type="text"
              value={preferredProvider}
              onChange={(e) => setPreferredProvider(e.target.value)}
              placeholder="e.g. anthropic, openai"
              className={cn(
                "w-full rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm",
                "placeholder:text-foreground-secondary/40",
                "focus:outline-none focus:ring-1 focus:ring-ring transition-colors",
              )}
            />
          </label>

          {/* Preferred Model */}
          <label className="block space-y-1">
            <span className="text-xs font-medium text-foreground-secondary">
              Preferred Model
            </span>
            <input
              type="text"
              value={preferredModel}
              onChange={(e) => setPreferredModel(e.target.value)}
              placeholder="e.g. claude-sonnet-4-20250514"
              className={cn(
                "w-full rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm",
                "placeholder:text-foreground-secondary/40",
                "focus:outline-none focus:ring-1 focus:ring-ring transition-colors",
              )}
            />
          </label>

          {/* Working Directory */}
          <label className="block space-y-1">
            <span className="text-xs font-medium text-foreground-secondary">
              Working Directory
            </span>
            <input
              type="text"
              value={workingDir}
              onChange={(e) => setWorkingDir(e.target.value)}
              placeholder="/path/to/project"
              className={cn(
                "w-full rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm font-mono",
                "placeholder:text-foreground-secondary/40",
                "focus:outline-none focus:ring-1 focus:ring-ring transition-colors",
              )}
            />
          </label>

          {/* Use Worktrees */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useWorktrees}
              onChange={(e) => setUseWorktrees(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-foreground"
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
