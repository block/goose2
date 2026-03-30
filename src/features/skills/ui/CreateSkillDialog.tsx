import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { createSkill } from "../api/skills";

const KEBAB_CASE_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

interface CreateSkillDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export function CreateSkillDialog({
  isOpen,
  onClose,
  onCreated,
}: CreateSkillDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameValid = name.length > 0 && KEBAB_CASE_REGEX.test(name);
  const canSave = nameValid && description.trim().length > 0 && !saving;

  const handleNameChange = (raw: string) => {
    const formatted = raw
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-/, "");
    setName(formatted);
    setError(null);
  };

  const handleClose = () => {
    setName("");
    setDescription("");
    setInstructions("");
    setError(null);
    onClose();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await createSkill(name, description.trim(), instructions);
      setName("");
      setDescription("");
      setInstructions("");
      onCreated?.();
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
      aria-label="New Skill"
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
          "max-h-[85vh] overflow-y-auto",
          "motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">New Skill</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={handleClose}
            className="rounded-md p-1 text-foreground-secondary hover:bg-background-secondary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 p-5">
          {/* Name */}
          <label className="block space-y-1">
            <span className="text-xs font-medium text-foreground-secondary">
              Name <span className="text-foreground-danger">*</span>
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="my-skill-name"
              className={cn(
                "w-full rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm font-mono",
                "placeholder:text-foreground-secondary/40",
                "focus:outline-none focus:ring-1 focus:ring-ring transition-colors",
              )}
            />
            {name.length > 0 && !nameValid && (
              <p className="text-xs text-foreground-danger">
                Must be kebab-case (e.g. code-review)
              </p>
            )}
          </label>

          {/* Description */}
          <label className="block space-y-1">
            <span className="text-xs font-medium text-foreground-secondary">
              Description <span className="text-foreground-danger">*</span>
            </span>
            <input
              type="text"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setError(null);
              }}
              placeholder="What it does and when to use it..."
              className={cn(
                "w-full rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm",
                "placeholder:text-foreground-secondary/40",
                "focus:outline-none focus:ring-1 focus:ring-ring transition-colors",
              )}
            />
          </label>

          {/* Instructions */}
          <label className="block space-y-1">
            <span className="text-xs font-medium text-foreground-secondary">
              Instructions
            </span>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={10}
              placeholder="Markdown instructions the agent will follow..."
              className={cn(
                "w-full resize-y rounded-lg border border-border bg-background-secondary px-3 py-2 text-xs font-mono leading-relaxed",
                "placeholder:text-foreground-secondary/40",
                "focus:outline-none focus:ring-1 focus:ring-ring transition-colors",
              )}
            />
          </label>

          {/* Error */}
          {error && <p className="text-xs text-foreground-danger">{error}</p>}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!canSave}>
              {saving ? "Creating..." : "Create Skill"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
