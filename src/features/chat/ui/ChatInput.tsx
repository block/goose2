import { useState, useRef, useCallback, useEffect } from "react";
import {
  ArrowUp,
  Square,
  Paperclip,
  Mic,
  ChevronDown,
  Bot,
  FolderOpen,
  Check,
} from "lucide-react";
import type { AcpProvider } from "@/shared/api/acp";
import { cn } from "@/shared/lib/cn";
import { ContextRing } from "./ContextRing";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/shared/ui/dropdown-menu";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/shared/ui/tooltip";

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
  onSend: (text: string) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  // Provider
  providers?: AcpProvider[];
  selectedProvider?: string;
  onProviderChange?: (providerId: string) => void;
  // Model
  currentModel?: string;
  availableModels?: ModelOption[];
  onModelChange?: (modelId: string) => void;
  // Folder
  folder?: string | null;
  availableFolders?: Array<{ id: string; name: string }>;
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
  // Provider
  providers = [],
  selectedProvider = "goose",
  onProviderChange,
  // Model
  currentModel = "Claude Sonnet 4",
  availableModels = [],
  onModelChange,
  // Folder
  folder = null,
  availableFolders = [],
  onFolderChange,
  // Context
  contextTokens = 0,
  contextLimit = 0,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const [isCompact, setIsCompact] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const canSend = text.trim().length > 0 && !isStreaming && !disabled;

  // -----------------------------------------------------------------------
  // Responsive: detect container width
  // -----------------------------------------------------------------------

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsCompact(entry.contentRect.width < 580);
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleProviderChange = useCallback(
    (providerId: string) => {
      onProviderChange?.(providerId);
    },
    [onProviderChange],
  );

  const handleSend = useCallback(() => {
    if (!canSend) return;
    onSend(text.trim());
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [canSend, text, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };

  // -----------------------------------------------------------------------
  // Derived
  // -----------------------------------------------------------------------

  const activeProvider = providers.find((p) => p.id === selectedProvider);
  const providerLabel = activeProvider?.label ?? selectedProvider;
  const selectedFolder = availableFolders.find((f) => f.id === folder);
  const folderLabel = selectedFolder?.name ?? "Folder";

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn("px-4 pb-6 pt-2", className)} ref={containerRef}>
        <div className="mx-auto max-w-3xl">
          <div className="relative rounded-2xl border border-border bg-background-secondary px-4 pb-3 pt-4 shadow-lg">
            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || isStreaming}
              rows={1}
              className="mb-3 min-h-[36px] max-h-[200px] w-full resize-none bg-transparent px-1 text-[14px] leading-relaxed text-foreground placeholder:text-foreground-tertiary/60 focus:outline-none disabled:opacity-60"
              aria-label="Chat message input"
            />

            {/* Bottom bar */}
            <div className="flex items-center justify-between gap-2">
              {/* Left side: pickers */}
              <div className="flex items-center gap-0.5">
                {/* Provider picker */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-background-tertiary"
                      aria-label="Select provider"
                    >
                      <Bot className="h-3.5 w-3.5" />
                      {!isCompact && <span>{providerLabel}</span>}
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel>Provider</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {providers.length > 0 ? (
                      providers.map((provider) => (
                        <DropdownMenuItem
                          key={provider.id}
                          onSelect={() => handleProviderChange(provider.id)}
                          className="flex items-center justify-between"
                        >
                          <span className="text-sm font-medium">
                            {provider.label}
                          </span>
                          {provider.id === selectedProvider && (
                            <Check className="h-4 w-4 shrink-0 text-foreground-secondary" />
                          )}
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <DropdownMenuItem disabled>
                        <span className="text-xs text-foreground-tertiary">
                          No providers detected
                        </span>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Model picker */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-foreground-tertiary transition-colors hover:bg-background-tertiary hover:text-foreground"
                      aria-label="Select model"
                    >
                      {!isCompact && <span>{currentModel}</span>}
                      {isCompact && (
                        <span className="max-w-[60px] truncate">
                          {currentModel}
                        </span>
                      )}
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel>Model</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {availableModels.length > 0 ? (
                      availableModels.map((model) => (
                        <DropdownMenuItem
                          key={model.id}
                          onSelect={() => onModelChange?.(model.id)}
                          className="flex items-center justify-between"
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm">
                              {model.displayName ?? model.name}
                            </span>
                            {model.provider && (
                              <span className="text-xs text-foreground-tertiary">
                                {model.provider}
                              </span>
                            )}
                          </div>
                          {model.id === currentModel && (
                            <Check className="h-4 w-4 shrink-0 text-foreground-secondary" />
                          )}
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <DropdownMenuItem disabled>
                        <span className="text-xs text-foreground-tertiary">
                          {currentModel}
                        </span>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Divider */}
                <div className="mx-0.5 h-4 w-px bg-border" />

                {/* Folder picker */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-foreground-tertiary transition-colors hover:bg-background-tertiary hover:text-foreground"
                      aria-label="Select folder"
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                      {!isCompact && <span>{folderLabel}</span>}
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel>Working Directory</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {availableFolders.length > 0 ? (
                      availableFolders.map((f) => (
                        <DropdownMenuItem
                          key={f.id}
                          onSelect={() => onFolderChange?.(f.id)}
                          className="flex items-center justify-between"
                        >
                          <span className="text-sm">{f.name}</span>
                          {f.id === folder && (
                            <Check className="h-4 w-4 shrink-0 text-foreground-secondary" />
                          )}
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <DropdownMenuItem disabled>
                        <span className="text-xs text-foreground-tertiary">
                          No folders available
                        </span>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Right side: actions */}
              <div className="flex items-center gap-1">
                {/* Context ring */}
                {contextLimit > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="rounded-lg p-2 text-foreground-tertiary transition-colors hover:bg-background-tertiary hover:text-foreground"
                        aria-label="Context usage"
                      >
                        <ContextRing
                          tokens={contextTokens}
                          limit={contextLimit}
                        />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {contextTokens.toLocaleString()} /{" "}
                      {contextLimit.toLocaleString()} tokens
                    </TooltipContent>
                  </Tooltip>
                )}

                {/* Voice button (disabled) */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="cursor-not-allowed rounded-lg p-2 text-foreground-tertiary/50 transition-colors"
                      disabled
                      aria-label="Voice input (coming soon)"
                    >
                      <Mic className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Voice input (coming soon)</TooltipContent>
                </Tooltip>

                {/* Attach file */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="rounded-lg p-2 text-foreground-tertiary transition-colors hover:bg-background-tertiary hover:text-foreground"
                      aria-label="Attach file"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Attach file</TooltipContent>
                </Tooltip>

                {/* Stop / Send */}
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={onStop}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-background-danger/10 text-foreground-danger transition-colors hover:bg-background-danger/20"
                    aria-label="Stop generation"
                  >
                    <Square className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!canSend}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                      canSend
                        ? "bg-foreground text-background-primary hover:opacity-90"
                        : "cursor-default bg-foreground/10 text-foreground-tertiary",
                    )}
                    aria-label="Send message"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
