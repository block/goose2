import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { X } from "lucide-react";
import type { AcpProvider } from "@/shared/api/acp";
import type { Persona } from "@/shared/types/agents";
import { cn } from "@/shared/lib/cn";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  MentionAutocomplete,
  useMentionDetection,
} from "./MentionAutocomplete";
import { ChatInputToolbar } from "./ChatInputToolbar";
import { formatProviderLabel } from "@/shared/ui/icons/ProviderIcons";
import { TooltipProvider } from "@/shared/ui/tooltip";
import { PersonaAvatar } from "./PersonaPicker";
import { ImageLightbox } from "@/shared/ui/ImageLightbox";
import type { PastedImage } from "@/shared/types/messages";
import { resizeImage } from "../lib/resizeImage";
import { useImageDropTarget } from "../hooks/useImageDropTarget";

export interface ModelOption {
  id: string;
  name: string;
  displayName?: string;
  provider?: string;
}

export interface ProjectOption {
  id: string;
  name: string;
  workingDirs: string[];
  color?: string | null;
}

interface ChatInputProps {
  onSend: (text: string, personaId?: string, images?: PastedImage[]) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
  queuedMessage?: { text: string } | null;
  onDismissQueue?: () => void;
  initialValue?: string;
  onDraftChange?: (text: string) => void;
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
  // Context
  contextTokens?: number;
  contextLimit?: number;
}

// ---------------------------------------------------------------------------
// PastedImageThumb
// ---------------------------------------------------------------------------

function PastedImageThumb({
  objectUrl,
  index,
  onRemove,
}: {
  objectUrl: string;
  index: number;
  onRemove: (index: number) => void;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <>
      <div className="group relative inline-block">
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="block cursor-pointer rounded-lg"
          aria-label={`View attachment ${index + 1}`}
        >
          <img
            src={objectUrl}
            alt={`Attachment ${index + 1}`}
            className="h-16 w-16 rounded-lg object-cover border border-border"
          />
        </button>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-background opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          aria-label="Remove image"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      </div>
      <ImageLightbox
        src={objectUrl}
        alt={`Attachment ${index + 1}`}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// ChatInput
// ---------------------------------------------------------------------------

export function ChatInput({
  onSend,
  onStop,
  isStreaming = false,
  disabled = false,
  queuedMessage = null,
  onDismissQueue,
  initialValue = "",
  onDraftChange,
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
  contextTokens = 0,
  contextLimit = 0,
}: ChatInputProps) {
  const [text, setTextRaw] = useState(initialValue);
  const setText = useCallback(
    (value: string) => {
      setTextRaw(value);
      onDraftChange?.(value);
    },
    [onDraftChange],
  );
  const [images, setImages] = useState<PastedImage[]>([]);
  const [isCompact, setIsCompact] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activePersona = useMemo(
    () => personas.find((persona) => persona.id === selectedPersonaId) ?? null,
    [personas, selectedPersonaId],
  );
  const stickyPersona = activePersona;

  const hasQueuedMessage = queuedMessage !== null;
  const canSend =
    (text.trim().length > 0 || images.length > 0) &&
    !hasQueuedMessage &&
    !disabled;

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

  // Keep a ref to latest images so the unmount cleanup always sees current state
  // without needing images as a dependency (which would revoke still-active URLs
  // on every add/remove).
  const imagesRef = useRef(images);
  imagesRef.current = images;

  useEffect(() => {
    return () => {
      for (const img of imagesRef.current) {
        URL.revokeObjectURL(img.objectUrl);
      }
    };
  }, []);

  const handleSend = useCallback(() => {
    if (!canSend) return;
    onSend(
      text.trim(),
      selectedPersonaId ?? undefined,
      images.length > 0 ? images : undefined,
    );
    setText("");
    setImages((prev) => {
      for (const img of prev) URL.revokeObjectURL(img.objectUrl);
      return [];
    });
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [canSend, text, images, onSend, selectedPersonaId, setText]);

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
    [
      text,
      mentionStartIndex,
      mentionQuery,
      closeMention,
      onPersonaChange,
      setText,
    ],
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
    if (e.key === "Enter" && !e.shiftKey && !e.altKey) {
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

  const addImageFile = useCallback((file: File) => {
    const objectUrl = URL.createObjectURL(file);
    resizeImage(file)
      .then(({ base64, mimeType }) => {
        setImages((prev) => [...prev, { base64, mimeType, objectUrl }]);
      })
      .catch(() => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const [header, b64] = dataUrl.split(",");
          const mime = header.replace("data:", "").replace(";base64", "");
          setImages((prev) => [
            ...prev,
            { base64: b64, mimeType: mime, objectUrl },
          ]);
        };
        reader.onerror = () => {
          URL.revokeObjectURL(objectUrl);
        };
        reader.readAsDataURL(file);
      });
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = Array.from(e.clipboardData.items);
      const imageItems = items.filter((item) => item.type.startsWith("image/"));
      if (imageItems.length === 0) return;

      e.preventDefault();
      for (const item of imageItems) {
        const file = item.getAsFile();
        if (!file) continue;
        addImageFile(file);
      }
    },
    [addImageFile],
  );

  const {
    isImageDragOver,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useImageDropTarget({
    disabled,
    isStreaming,
    onDropFile: addImageFile,
  });

  const removeImage = useCallback((index: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].objectUrl);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const providerDisplayName =
    providers.find((p) => p.id === selectedProvider)?.label ??
    formatProviderLabel(selectedProvider);
  const agentDisplayName = activePersona?.displayName ?? providerDisplayName;
  const effectivePlaceholder = `Message ${agentDisplayName}, @ to mention personas`;

  const handleClearStickyPersona = useCallback(() => {
    onPersonaChange?.(null);
  }, [onPersonaChange]);

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn("px-4 pb-6 pt-2", className)} ref={containerRef}>
        <div className="mx-auto max-w-3xl">
          {/* biome-ignore lint/a11y/noStaticElementInteractions: drop zone for image files */}
          <div
            className={cn(
              "relative rounded-2xl border border-border bg-background px-4 pb-3 pt-4 transition-colors",
              isImageDragOver && "bg-muted/20",
            )}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isImageDragOver && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl border border-dashed border-border bg-background/70">
                <Badge
                  variant="secondary"
                  className="px-3 py-1 text-sm shadow-sm"
                >
                  Drop images to attach
                </Badge>
              </div>
            )}
            <MentionAutocomplete
              personas={personas}
              query={mentionQuery}
              isOpen={mentionOpen}
              onSelect={handleMentionSelect}
              onClose={closeMention}
              selectedIndex={mentionSelectedIndex}
            />

            {images.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {images.map((img, i) => (
                  <PastedImageThumb
                    key={img.objectUrl}
                    objectUrl={img.objectUrl}
                    index={i}
                    onRemove={removeImage}
                  />
                ))}
              </div>
            )}

            {stickyPersona && (
              <div className="mb-2 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-medium text-brand">
                  <PersonaAvatar persona={stickyPersona} size="sm" />
                  <span>@{stickyPersona.displayName}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="ml-0.5 size-auto p-0 opacity-60 hover:bg-transparent hover:opacity-100"
                    onClick={handleClearStickyPersona}
                    aria-label="Clear active assistant"
                  >
                    <X className="size-3" />
                  </Button>
                </span>
              </div>
            )}

            {queuedMessage && (
              <div className="mb-2 flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-1.5">
                <span className="flex-1 truncate text-xs text-muted-foreground">
                  Queued: {queuedMessage.text}
                </span>
                <button
                  type="button"
                  onClick={onDismissQueue}
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
                  aria-label="Dismiss queued message"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={effectivePlaceholder}
              disabled={disabled}
              rows={1}
              className="mb-3 min-h-[36px] max-h-[200px] w-full resize-none bg-transparent px-1 text-[14px] leading-relaxed text-foreground placeholder:font-light placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-60"
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
              contextTokens={contextTokens}
              contextLimit={contextLimit}
              canSend={canSend}
              isStreaming={isStreaming}
              hasQueuedMessage={hasQueuedMessage}
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
