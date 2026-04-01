import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { createSkill, updateSkill } from "../api/skills";

const KEBAB_CASE_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

interface CreateSkillDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
  editingSkill?: { name: string; description: string; instructions: string };
}

export function CreateSkillDialog({
  isOpen,
  onClose,
  onCreated,
  editingSkill,
}: CreateSkillDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!editingSkill;

  // Pre-fill fields when editing
  useEffect(() => {
    if (isOpen && editingSkill) {
      setName(editingSkill.name);
      setDescription(editingSkill.description);
      setInstructions(editingSkill.instructions);
      setError(null);
    } else if (isOpen) {
      setName("");
      setDescription("");
      setInstructions("");
      setError(null);
    }
  }, [isOpen, editingSkill]);

  const nameValid = name.length > 0 && KEBAB_CASE_REGEX.test(name);
  const canSave = nameValid && description.trim().length > 0 && !saving;

  const handleNameChange = (raw: string) => {
    if (isEditing) return; // name is read-only in edit mode
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
      if (isEditing) {
        await updateSkill(name, description.trim(), instructions);
      } else {
        await createSkill(name, description.trim(), instructions);
      }
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
      aria-label={isEditing ? "Edit Skill" : "New Skill"}
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
          "relative z-10 w-full max-w-lg rounded-xl border border-border bg-background shadow-card",
          "max-h-[85vh] flex flex-col",
          "motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95",
        )}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">
            {isEditing ? "Edit Skill" : "New Skill"}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={handleClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <form
          id="skill-form"
          onSubmit={handleSave}
          className="min-h-0 flex-1 overflow-y-auto space-y-4 p-5"
        >
          {/* Name */}
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              Name <span className="text-destructive">*</span>
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="my-skill-name"
              readOnly={isEditing}
              className={cn(
                "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono",
                "placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-1 focus:ring-ring transition-colors",
                isEditing && "opacity-60 cursor-not-allowed",
              )}
            />
            {name.length > 0 && !nameValid && (
              <p className="text-xs text-destructive">
                Must be kebab-case (e.g. code-review)
              </p>
            )}
          </label>

          {/* Description */}
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              Description <span className="text-destructive">*</span>
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
                "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm",
                "placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-1 focus:ring-ring transition-colors",
              )}
            />
          </label>

          {/* Instructions */}
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              Instructions
            </span>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={10}
              placeholder="Markdown instructions the agent will follow..."
              className={cn(
                "w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono leading-relaxed",
                "placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-1 focus:ring-ring transition-colors",
              )}
            />
          </label>

          {/* Error */}
          {error && <p className="text-xs text-destructive">{error}</p>}
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
          <Button type="submit" form="skill-form" size="sm" disabled={!canSave}>
            {saving
              ? isEditing
                ? "Saving..."
                : "Creating..."
              : isEditing
                ? "Save Changes"
                : "Create Skill"}
          </Button>
        </div>
      </div>
    </div>
  );
}
