import {
  Paperclip,
  Mic,
  ChevronDown,
  FolderOpen,
  Check,
  ArrowUp,
  Square,
} from "lucide-react";
import type { AcpProvider } from "@/shared/api/acp";
import type { Persona } from "@/shared/types/agents";
import { cn } from "@/shared/lib/cn";
import { ContextRing } from "./ContextRing";
import { PersonaPicker } from "./PersonaPicker";
import type { ModelOption } from "./ChatInput";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/shared/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/shared/ui/tooltip";

interface ChatInputToolbarProps {
  // Personas
  personas: Persona[];
  selectedPersonaId: string | null;
  onPersonaChange?: (personaId: string) => void;
  onCreatePersona?: () => void;
  // Provider
  providers: AcpProvider[];
  selectedProvider: string;
  onProviderChange: (providerId: string) => void;
  // Model
  currentModel: string;
  availableModels: ModelOption[];
  onModelChange?: (modelId: string) => void;
  // Folder
  folder: string | null;
  availableFolders: Array<{ id: string; name: string }>;
  onFolderChange?: (folderId: string | null) => void;
  // Context
  contextTokens: number;
  contextLimit: number;
  // Actions
  canSend: boolean;
  isStreaming: boolean;
  onSend: () => void;
  onStop?: () => void;
  // Layout
  isCompact: boolean;
}

export function ChatInputToolbar({
  personas,
  selectedPersonaId,
  onPersonaChange,
  onCreatePersona,
  providers,
  selectedProvider,
  onProviderChange,
  currentModel,
  availableModels,
  onModelChange,
  folder,
  availableFolders,
  onFolderChange,
  contextTokens,
  contextLimit,
  canSend,
  isStreaming,
  onSend,
  onStop,
  isCompact,
}: ChatInputToolbarProps) {
  const selectedFolder = availableFolders.find((f) => f.id === folder);
  const folderLabel = selectedFolder?.name ?? "Folder";

  return (
    <div className="flex items-center justify-between gap-2">
      {/* Left side: pickers */}
      <div className="flex items-center gap-0.5">
        {personas.length > 0 && (
          <PersonaPicker
            personas={personas}
            selectedPersonaId={selectedPersonaId}
            onPersonaChange={(id) => onPersonaChange?.(id)}
            onCreatePersona={onCreatePersona}
            compact={isCompact}
          />
        )}

        {providers.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] text-foreground-tertiary transition-colors hover:bg-background-tertiary hover:text-foreground"
                aria-label="Override provider"
              >
                {!isCompact && (
                  <span>
                    {providers.find((p) => p.id === selectedProvider)?.label ??
                      selectedProvider}
                  </span>
                )}
                <ChevronDown className="h-2.5 w-2.5 opacity-50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Provider Override</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {providers.map((provider) => (
                <DropdownMenuItem
                  key={provider.id}
                  onSelect={() => onProviderChange(provider.id)}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm font-medium">{provider.label}</span>
                  {provider.id === selectedProvider && (
                    <Check className="h-4 w-4 shrink-0 text-foreground-secondary" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {availableModels.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-foreground-tertiary transition-colors hover:bg-background-tertiary hover:text-foreground"
                aria-label="Select model"
              >
                {!isCompact && <span>{currentModel}</span>}
                {isCompact && (
                  <span className="max-w-[60px] truncate">{currentModel}</span>
                )}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Model</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {availableModels.map((model) => (
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
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="mx-0.5 h-4 w-px bg-border" />

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
        {contextLimit > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="rounded-lg p-2 text-foreground-tertiary transition-colors hover:bg-background-tertiary hover:text-foreground"
                aria-label="Context usage"
              >
                <ContextRing tokens={contextTokens} limit={contextLimit} />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {contextTokens.toLocaleString()} / {contextLimit.toLocaleString()}{" "}
              tokens
            </TooltipContent>
          </Tooltip>
        )}

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
            onClick={onSend}
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
  );
}
