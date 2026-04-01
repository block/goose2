import { useState, useRef, useCallback, useEffect, useMemo } from "react";
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
import { PersonaAvatar } from "./PersonaPicker";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModelOption {
  id: string;
  name: string;
  displayName?: string;
  provider?: string;
}

export interface ProjectOption {
  id: string;
  name: string;
  workingDir?: string | null;
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
  onPersonaChange?: (personaId: string | null) => void;
  onCreatePersona?: () => void;
  // Provider (secondary -- auto-set by persona but overridable)
  providers?: AcpProvider[];
  providersLoading?: boolean;
  selectedProvider?: string;
  onProviderChange?: (providerId: string) => void;
  // Model
  currentModel?: string;
  availableModels?: ModelOption[];
  onModelChange?: (modelId: string) => void;
  // Project
  selectedProjectId?: string | null;
  availableProjects?: ProjectOption[];
  onProjectChange?: (projectId: string | null) => void;
  onCreateProject?: (options?: {
    onCreated?: (projectId: string) => void;
  }) => void;
  onCreateProjectFromFolder?: (options?: {
    onCreated?: (projectId: string) => void;
  }) => void;
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
  providersLoading = false,
  selectedProvider = "goose",
  onProviderChange,
  currentModel = "Claude Sonnet 4",
  availableModels = [],
  onModelChange,
  selectedProjectId = null,
  availableProjects = [],
  onProjectChange,
  onCreateProject,
  onCreateProjectFromFolder,
  contextTokens = 0,
  contextLimit = 0,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const [isCompact, setIsCompact] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activePersona = useMemo(
    () => personas.find((persona) => persona.id === selectedPersonaId) ?? null,
    [personas, selectedPersonaId],
  );
  const stickyPersona = activePersona;

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
    onSend(text.trim(), selectedPersonaId ?? undefined);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [canSend, text, onSend, selectedPersonaId]);

  const handleMentionSelect = useCallback(
    (persona: Persona) => {
      const before = text.slice(0, mentionStartIndex);
      const after = text.slice(mentionStartIndex + 1 + mentionQuery.length);
      const newText = `${before}${after}`.replace(/\s{2,}/g, " ");
      setText(newText);
      closeMention();
      onPersonaChange?.(persona.id);

      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.focus();
          ta.style.height = "auto";
          ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
          const cursorPos = Math.min(before.length, newText.length);
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

  const personaDisplayName = activePersona?.displayName ?? "Goose";
  const effectivePlaceholder =
    placeholder === "Message Goose..."
      ? `Message ${personaDisplayName}... (type @ to mention)`
      : placeholder;

  const handleClearStickyPersona = useCallback(() => {
    onPersonaChange?.(null);
  }, [onPersonaChange]);

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn("px-4 pb-6 pt-2", className)} ref={containerRef}>
        <div className="mx-auto max-w-3xl">
          <div className="relative rounded-2xl border border-border bg-background px-4 pb-3 pt-4">
            <MentionAutocomplete
              personas={personas}
              query={mentionQuery}
              isOpen={mentionOpen}
              onSelect={handleMentionSelect}
              onClose={closeMention}
              selectedIndex={mentionSelectedIndex}
            />

            {stickyPersona && (
              <div className="mb-2 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-medium text-brand">
                  <PersonaAvatar persona={stickyPersona} size="sm" />
                  <span>@{stickyPersona.displayName}</span>
                  <button
                    type="button"
                    className="ml-0.5 inline-flex items-center opacity-60 hover:opacity-100"
                    onClick={handleClearStickyPersona}
                    aria-label="Clear active assistant"
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
              className="mb-3 min-h-[36px] max-h-[200px] w-full resize-none bg-transparent px-1 text-[14px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-60"
              aria-label="Chat message input"
            />

            <ChatInputToolbar
              personas={personas}
              selectedPersonaId={selectedPersonaId}
              onPersonaChange={onPersonaChange}
              onCreatePersona={onCreatePersona}
              providers={providers}
              providersLoading={providersLoading}
              selectedProvider={selectedProvider}
              onProviderChange={(id) => onProviderChange?.(id)}
              currentModel={currentModel}
              availableModels={availableModels}
              onModelChange={onModelChange}
              selectedProjectId={selectedProjectId}
              availableProjects={availableProjects}
              onProjectChange={onProjectChange}
              onCreateProject={onCreateProject}
              onCreateProjectFromFolder={onCreateProjectFromFolder}
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
