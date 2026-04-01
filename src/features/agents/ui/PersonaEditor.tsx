import { useState, useEffect, useCallback } from "react";
import { Copy } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
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

  const initials = displayName.charAt(0).toUpperCase() || "?";

  // For new personas, use a temporary ID for the avatar upload
  const avatarPersonaId = persona?.id ?? "new-persona";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 px-5 py-4">
          <DialogTitle className="text-sm">
            {isReadOnly
              ? persona?.displayName
              : isEditing
                ? "Edit Persona"
                : "New Persona"}
          </DialogTitle>
        </DialogHeader>

        <form
          id="persona-form"
          onSubmit={handleSubmit}
          className="min-h-0 flex-1 overflow-y-auto space-y-4 px-5 pb-5"
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
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">
              Display Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              readOnly={isReadOnly}
              required
              placeholder="e.g. Code Reviewer"
              className={cn(isReadOnly && "opacity-70 cursor-not-allowed")}
            />
          </div>

          {/* System Prompt */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground">
                System Prompt <span className="text-destructive">*</span>
              </Label>
              <span className="text-[10px] text-muted-foreground">
                {systemPrompt.length} chars
              </span>
            </div>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              readOnly={isReadOnly}
              required
              rows={6}
              placeholder="You are a helpful assistant that..."
              className={cn(
                "leading-relaxed",
                isReadOnly && "opacity-70 cursor-not-allowed",
              )}
            />
          </div>

          {/* Provider */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">
              Provider
            </Label>
            <Select
              value={provider || "__none__"}
              onValueChange={(v) =>
                setProvider(
                  v === "__none__"
                    ? ("" as ProviderType | "")
                    : (v as ProviderType),
                )
              }
              disabled={isReadOnly}
            >
              <SelectTrigger
                className={cn(
                  "w-full",
                  isReadOnly && "opacity-70 cursor-not-allowed",
                )}
              >
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {PROVIDER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Model */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">
              Model
            </Label>
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              readOnly={isReadOnly}
              placeholder="e.g. claude-sonnet-4-20250514"
              className={cn(isReadOnly && "opacity-70 cursor-not-allowed")}
            />
          </div>
        </form>

        <DialogFooter className="shrink-0 border-t px-5 py-4">
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
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
