import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { X } from "lucide-react";
import type { AcpProvider } from "@/shared/api/acp";
import type { Persona } from "@/shared/types/agents";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import {
  MentionAutocomplete,
  useMentionDetection,
} from "./MentionAutocomplete";
import { ChatInputToolbar } from "./ChatInputToolbar";
import { TooltipProvider } from "@/shared/ui/tooltip";
import { PersonaAvatar } from "./PersonaPicker";
import { ImageLightbox } from "@/shared/ui/ImageLightbox";
import type { PastedImage } from "@/shared/types/messages";

// ---------------------------------------------------------------------------
// Image resizing
// ---------------------------------------------------------------------------

const MAX_IMAGE_DIMENSION = 2048;
const JPEG_QUALITY = 0.85;

function resizeImage(
  file: File,
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDim = Math.max(img.width, img.height);

      if (maxDim <= MAX_IMAGE_DIMENSION) {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const [header, b64] = dataUrl.split(",");
          const mime = header.replace("data:", "").replace(";base64", "");
          resolve({ base64: b64, mimeType: mime });
        };
        reader.onerror = () => reject(new Error("Failed to read image"));
        reader.readAsDataURL(file);
        return;
      }

      const scale = MAX_IMAGE_DIMENSION / maxDim;
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      const outputType =
        file.type === "image/png" ? "image/png" : "image/jpeg";
      const quality = outputType === "image/jpeg" ? JPEG_QUALITY : undefined;
      const dataUrl = canvas.toDataURL(outputType, quality);
      const [header, b64] = dataUrl.split(",");
      const mime = header.replace("data:", "").replace(";base64", "");
      resolve({ base64: b64, mimeType: mime });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

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
  color?: string | null;
}

interface ChatInputProps {
  onSend: (text: string, personaId?: string, images?: PastedImage[]) => void;
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
          className="block cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
  const [images, setImages] = useState<PastedImage[]>([]);
  const [isCompact, setIsCompact] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activePersona = useMemo(
    () => personas.find((persona) => persona.id === selectedPersonaId) ?? null,
    [personas, selectedPersonaId],
  );
  const stickyPersona = activePersona;

  const canSend =
    (text.trim().length > 0 || images.length > 0) && !isStreaming && !disabled;

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
  }, [canSend, text, images, onSend, selectedPersonaId]);

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
          setImages((prev) => [...prev, { base64: b64, mimeType: mime, objectUrl }]);
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

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    const hasImages = Array.from(e.dataTransfer.items).some((item) =>
      item.type.startsWith("image/"),
    );
    if (hasImages) e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (files.length === 0) return;
      e.preventDefault();
      for (const file of files) {
        addImageFile(file);
      }
    },
    [addImageFile],
  );

  const removeImage = useCallback((index: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].objectUrl);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

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
          {/* biome-ignore lint/a11y/noStaticElementInteractions: drop zone for image files */}
          <div
            className="relative rounded-2xl border border-border bg-background px-4 pb-3 pt-4"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
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

            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={effectivePlaceholder}
              disabled={disabled || isStreaming}
              rows={1}
              className="mb-3 min-h-[36px] max-h-[200px] w-full resize-none bg-transparent px-1 text-[14px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-60"
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
