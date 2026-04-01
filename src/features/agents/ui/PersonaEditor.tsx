import { useState, useEffect, useCallback } from "react";
import { X, Copy } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import type {
  Persona,
  ProviderType,
  Avatar,
  CreatePersonaRequest,
  UpdatePersonaRequest,
} from "@/shared/types/agents";
import { AvatarDropZone } from "./AvatarDropZone";

interface PersonaEditorProps {
  persona?: Persona;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreatePersonaRequest | UpdatePersonaRequest) => void;
  onDuplicate?: (persona: Persona) => void;
  isPending?: boolean;
}

const PROVIDER_OPTIONS: { value: ProviderType; label: string }[] = [
  { value: "goose", label: "Goose" },
  { value: "claude", label: "Claude" },
  { value: "openai", label: "OpenAI" },
  { value: "ollama", label: "Ollama" },
  { value: "custom", label: "Custom" },
];

export function PersonaEditor({
  persona,
  isOpen,
  onClose,
  onSave,
  onDuplicate,
  isPending = false,
}: PersonaEditorProps) {
  const isEditing = !!persona;
  const isReadOnly = persona?.isBuiltin ?? false;

  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [provider, setProvider] = useState<ProviderType | "">("");
  const [model, setModel] = useState("");

  useEffect(() => {
    if (isOpen && persona) {
      setDisplayName(persona.displayName);
      setAvatar(persona.avatar ?? null);
      setSystemPrompt(persona.systemPrompt);
      setProvider(persona.provider ?? "");
      setModel(persona.model ?? "");
    } else if (isOpen) {
      setDisplayName("");
      setAvatar(null);
      setSystemPrompt("");
      setProvider("");
      setModel("");
    }
  }, [isOpen, persona]);

  const isValid =
    displayName.trim().length > 0 && systemPrompt.trim().length > 0;

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!isValid || isReadOnly) return;

      const data: CreatePersonaRequest | UpdatePersonaRequest = {
        displayName: displayName.trim(),
        avatar: avatar ?? undefined,
        systemPrompt: systemPrompt.trim(),
        provider: provider || undefined,
        model: model.trim() || undefined,
      };
      onSave(data);
    },
    [
      isValid,
      isReadOnly,
      displayName,
      avatar,
      systemPrompt,
      provider,
      model,
      onSave,
    ],
  );

  if (!isOpen) return null;

  const initials = displayName.charAt(0).toUpperCase() || "?";

  // For new personas, use a temporary ID for the avatar upload
  const avatarPersonaId = persona?.id ?? "new-persona";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        isEditing ? `Edit persona ${persona?.displayName}` : "Create persona"
      }
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 motion-safe:animate-in motion-safe:fade-in"
        onClick={onClose}
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
            {isReadOnly
              ? persona?.displayName
              : isEditing
                ? "Edit Persona"
                : "New Persona"}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          id="persona-form"
          onSubmit={handleSubmit}
          className="min-h-0 flex-1 overflow-y-auto space-y-4 p-5"
        >
          {/* Avatar drop zone */}
          <div className="flex justify-center">
            {isReadOnly ? (
              avatar ? (
                <img
                  src={avatar.type === "url" ? avatar.value : undefined}
                  alt="Avatar preview"
                  className="h-16 w-16 rounded-full object-cover border border-border"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-lg font-semibold text-muted-foreground"
                >
                  {initials}
                </div>
              )
            ) : (
              <AvatarDropZone
                personaId={avatarPersonaId}
                avatar={avatar}
                onChange={setAvatar}
                disabled={isReadOnly}
              />
            )}
          </div>

          {/* Display Name */}
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              Display Name <span className="text-destructive">*</span>
            </span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              readOnly={isReadOnly}
              required
              placeholder="e.g. Code Reviewer"
              className={cn(
                "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm",
                "placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-1 focus:ring-ring transition-colors",
                isReadOnly && "opacity-70 cursor-not-allowed",
              )}
            />
          </label>

          {/* System Prompt */}
          <label className="block space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                System Prompt <span className="text-destructive">*</span>
              </span>
              <span className="text-[10px] text-muted-foreground">
                {systemPrompt.length} chars
              </span>
            </div>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              readOnly={isReadOnly}
              required
              rows={6}
              placeholder="You are a helpful assistant that..."
              className={cn(
                "w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm leading-relaxed",
                "placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-1 focus:ring-ring transition-colors",
                isReadOnly && "opacity-70 cursor-not-allowed",
              )}
            />
          </label>

          {/* Provider */}
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              Provider
            </span>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as ProviderType | "")}
              disabled={isReadOnly}
              className={cn(
                "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm",
                "focus:outline-none focus:ring-1 focus:ring-ring transition-colors",
                isReadOnly && "opacity-70 cursor-not-allowed",
              )}
            >
              <option value="">None</option>
              {PROVIDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          {/* Model */}
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              Model
            </span>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              readOnly={isReadOnly}
              placeholder="e.g. claude-sonnet-4-20250514"
              className={cn(
                "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm",
                "placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-1 focus:ring-ring transition-colors",
                isReadOnly && "opacity-70 cursor-not-allowed",
              )}
            />
          </label>
        </form>

        {/* Footer actions */}
        <div className="shrink-0 border-t border-border px-5 py-4">
          <div className="flex items-center justify-end gap-2">
            {isReadOnly && onDuplicate && persona ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onDuplicate(persona)}
              >
                <Copy className="h-3.5 w-3.5" />
                Duplicate
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="persona-form"
                  size="sm"
                  disabled={!isValid || isPending}
                >
                  {isPending
                    ? "Saving..."
                    : isEditing
                      ? "Save Changes"
                      : "Create"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
