import { useState, useRef, useCallback, useEffect } from "react";
import { X } from "lucide-react";
import type { AcpProvider } from "@/shared/api/acp";
import type { Persona } from "@/shared/types/agents";
import { cn } from "@/shared/lib/cn";
import {
  MentionAutocomplete,
  useMentionDetection,
} from "./MentionAutocomplete";
import { ChatInputToolbar } from "./ChatInputToolbar";
import { TooltipProvider } from "@/shared/ui/tooltip";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModelOption {
  id: string;
  name: string;
  displayName?: string;
  provider?: string;
}

interface ChatInputProps {
  onSend: (text: string, personaId?: string) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  // Personas
  personas?: Persona[];
  selectedPersonaId?: string | null;
  onPersonaChange?: (personaId: string) => void;
  onCreatePersona?: () => void;
  // Provider (secondary -- auto-set by persona but overridable)
  providers?: AcpProvider[];
  selectedProvider?: string;
  onProviderChange?: (providerId: string) => void;
  // Model
  currentModel?: string;
  availableModels?: ModelOption[];
  onModelChange?: (modelId: string) => void;
  // Folder
  folder?: string | null;
  availableFolders?: Array<{ id: string; name: string; path?: string }>;
  onFolderChange?: (folderId: string | null) => void;
  // Context
  contextTokens?: number;
  contextLimit?: number;
}

// ---------------------------------------------------------------------------
// ChatInput
// ---------------------------------------------------------------------------

export function ChatInput({
  onSend,
  onStop,
  isStreaming = false,
  disabled = false,
  placeholder = "Message Goose...",
  className,
  personas = [],
  selectedPersonaId = null,
  onPersonaChange,
  onCreatePersona,
  providers = [],
  selectedProvider = "goose",
  onProviderChange,
  currentModel = "Claude Sonnet 4",
  availableModels = [],
  onModelChange,
  folder = null,
  availableFolders = [],
  onFolderChange,
  contextTokens = 0,
  contextLimit = 0,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const [isCompact, setIsCompact] = useState(false);
  const [mentionPersonaId, setMentionPersonaId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const canSend = text.trim().length > 0 && !isStreaming && !disabled;

  const {
    mentionOpen,
    mentionQuery,
    mentionStartIndex,
    mentionSelectedIndex,
    detectMention,
    closeMention,
    navigateMention,
    confirmMention,
  } = useMentionDetection(personas);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsCompact(entry.contentRect.width < 580);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleSend = useCallback(() => {
    if (!canSend) return;
    const effectivePersonaId =
      mentionPersonaId ?? selectedPersonaId ?? undefined;
    onSend(text.trim(), effectivePersonaId ?? undefined);
    setText("");
    setMentionPersonaId(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [canSend, text, onSend, mentionPersonaId, selectedPersonaId]);

  const handleMentionSelect = useCallback(
    (persona: Persona) => {
      const before = text.slice(0, mentionStartIndex);
      const after = text.slice(mentionStartIndex + 1 + mentionQuery.length);
      const newText = `${before}@${persona.displayName} ${after}`;
      setText(newText);
      setMentionPersonaId(persona.id);
      closeMention();
      onPersonaChange?.(persona.id);

      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.focus();
          const cursorPos = before.length + persona.displayName.length + 2;
          ta.setSelectionRange(cursorPos, cursorPos);
        }
      });
    },
    [text, mentionStartIndex, mentionQuery, closeMention, onPersonaChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mentionOpen) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeMention();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        navigateMention(e.key === "ArrowDown" ? "down" : "up");
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        const persona = confirmMention();
        if (persona) {
          e.preventDefault();
          handleMentionSelect(persona);
          return;
        }
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setText(value);
    const cursorPos = e.target.selectionStart ?? value.length;
    detectMention(value, cursorPos);
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };

  const activePersona = personas.find((p) => p.id === selectedPersonaId);
  const personaDisplayName = activePersona?.displayName ?? "Goose";
  const effectivePlaceholder =
    placeholder === "Message Goose..."
      ? `Message ${personaDisplayName}... (type @ to mention)`
      : placeholder;

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn("px-4 pb-6 pt-2", className)} ref={containerRef}>
        <div className="mx-auto max-w-3xl">
          <div className="relative rounded-2xl border border-border bg-background-secondary px-4 pb-3 pt-4 shadow-lg">
            <MentionAutocomplete
              personas={personas}
              query={mentionQuery}
              isOpen={mentionOpen}
              onSelect={handleMentionSelect}
              onClose={closeMention}
              selectedIndex={mentionSelectedIndex}
            />

            {mentionPersonaId && (
              <div className="mb-2 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-medium text-brand">
                  @
                  {personas.find((p) => p.id === mentionPersonaId)?.displayName}
                  <button
                    type="button"
                    className="ml-0.5 inline-flex items-center opacity-60 hover:opacity-100"
                    onClick={() => setMentionPersonaId(null)}
                    aria-label="Remove mention"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={effectivePlaceholder}
              disabled={disabled || isStreaming}
              rows={1}
              className="mb-3 min-h-[36px] max-h-[200px] w-full resize-none bg-transparent px-1 text-[14px] leading-relaxed text-foreground placeholder:text-foreground-tertiary/60 focus:outline-none disabled:opacity-60"
              aria-label="Chat message input"
            />

            <ChatInputToolbar
              personas={personas}
              selectedPersonaId={selectedPersonaId}
              onPersonaChange={onPersonaChange}
              onCreatePersona={onCreatePersona}
              providers={providers}
              selectedProvider={selectedProvider}
              onProviderChange={(id) => onProviderChange?.(id)}
              currentModel={currentModel}
              availableModels={availableModels}
              onModelChange={onModelChange}
              folder={folder}
              availableFolders={availableFolders}
              onFolderChange={onFolderChange}
              contextTokens={contextTokens}
              contextLimit={contextLimit}
              canSend={canSend}
              isStreaming={isStreaming}
              onSend={handleSend}
              onStop={onStop}
              isCompact={isCompact}
            />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
