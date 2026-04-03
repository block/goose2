import { Mic, ChevronDown, Check, ArrowUp, Square } from "lucide-react";
import {
  formatProviderLabel,
  getProviderIcon,
} from "@/shared/ui/icons/ProviderIcons";
import { IconLibraryPlusFilled } from "@tabler/icons-react";
import type { AcpProvider } from "@/shared/api/acp";
import type { Persona } from "@/shared/types/agents";
import { cn } from "@/shared/lib/cn";
import { ChatInputSelector } from "./ChatInputSelector";
import { ContextRing } from "./ContextRing";
import { PersonaPicker } from "./PersonaPicker";
import type { ModelOption, ProjectOption } from "./ChatInput";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/shared/ui/dropdown-menu";
import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/shared/ui/tooltip";

const NO_PROJECT_VALUE = "__no_project__";
const CREATE_PROJECT_VALUE = "__create_project__";

function ProjectDot({ color }: { color?: string | null }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-2 rounded-full",
        color ? "" : "bg-muted-foreground/40",
      )}
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}

interface ChatInputToolbarProps {
  // Personas
  personas: Persona[];
  selectedPersonaId: string | null;
  onPersonaChange?: (personaId: string | null) => void;
  onCreatePersona?: () => void;
  // Provider
  providers: AcpProvider[];
  providersLoading?: boolean;
  selectedProvider: string;
  onProviderChange: (providerId: string) => void;
  // Model
  currentModel: string;
  availableModels: ModelOption[];
  onModelChange?: (modelId: string) => void;
  // Project
  selectedProjectId: string | null;
  availableProjects: ProjectOption[];
  onProjectChange?: (projectId: string | null) => void;
  onCreateProject?: (options?: {
    onCreated?: (projectId: string) => void;
  }) => void;
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
  providersLoading,
  selectedProvider,
  onProviderChange,
  currentModel,
  availableModels,
  onModelChange,
  selectedProjectId,
  availableProjects,
  onProjectChange,
  onCreateProject,
  contextTokens,
  contextLimit,
  canSend,
  isStreaming,
  onSend,
  onStop,
  isCompact,
}: ChatInputToolbarProps) {
  const availableProviderItems =
    providers.length > 0
      ? providers
      : selectedProvider
        ? [
            {
              id: selectedProvider,
              label: formatProviderLabel(selectedProvider),
            },
          ]
        : [];
  const selectedProject = availableProjects.find(
    (project) => project.id === selectedProjectId,
  );
  const projectLabel = selectedProject?.name ?? "No project";
  const projectTitle = selectedProject?.workingDir ?? undefined;
  const providerLabel =
    availableProviderItems.find((provider) => provider.id === selectedProvider)
      ?.label ?? formatProviderLabel(selectedProvider);

  const handleProjectValueChange = (value: string) => {
    if (value === CREATE_PROJECT_VALUE) {
      onCreateProject?.();
      return;
    }

    onProjectChange?.(value === NO_PROJECT_VALUE ? null : value);
  };

  return (
    <div className="flex items-center justify-between gap-2">
      {/* Left side: pickers */}
      <div className="flex items-center gap-0.5">
        {(availableProviderItems.length > 0 || providersLoading) && (
          <ChatInputSelector
            ariaLabel="Choose a provider"
            value={selectedProvider}
            triggerLabel={providersLoading ? "Loading..." : providerLabel}
            icon={getProviderIcon(selectedProvider, "size-3.5")}
            triggerVariant="toolbar"
            triggerSize="sm"
            menuLabel="Choose a provider"
            disabled={providersLoading}
            sections={[
              {
                items: availableProviderItems.map((provider) => ({
                  value: provider.id,
                  label: provider.label,
                  icon: getProviderIcon(provider.id, "size-4"),
                })),
              },
            ]}
            onValueChange={onProviderChange}
          />
        )}

        {availableModels.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                rightIcon={<ChevronDown className="opacity-50" />}
                className="gap-1.5 rounded-lg px-2.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Select model"
              >
                {!isCompact && <span>{currentModel}</span>}
                {isCompact && (
                  <span className="max-w-[60px] truncate">{currentModel}</span>
                )}
              </Button>
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
                      <span className="text-xs text-muted-foreground">
                        {model.provider}
                      </span>
                    )}
                  </div>
                  {model.id === currentModel && (
                    <Check className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <ChatInputSelector
          ariaLabel="Select project"
          value={selectedProjectId ?? NO_PROJECT_VALUE}
          triggerLabel={projectLabel}
          triggerTitle={projectTitle}
          icon={<ProjectDot color={selectedProject?.color} />}
          triggerVariant="toolbar"
          triggerSize="sm"
          menuLabel="Choose a project"
          contentWidth="wide"
          sections={[
            {
              items: [
                {
                  value: NO_PROJECT_VALUE,
                  label: "No project",
                  description: "General chat without project context",
                  icon: <ProjectDot />,
                },
                ...availableProjects.map((project) => ({
                  value: project.id,
                  label: project.name,
                  description: project.workingDir ?? undefined,
                  icon: <ProjectDot color={project.color} />,
                })),
              ],
            },
            {
              items: [
                ...(onCreateProject
                  ? [
                      {
                        value: CREATE_PROJECT_VALUE,
                        label: "Create project",
                        icon: (
                          <IconLibraryPlusFilled className="size-4 text-foreground" />
                        ),
                      },
                    ]
                  : []),
              ],
            },
          ].filter((section) => section.items.length > 0)}
          onValueChange={handleProjectValueChange}
        />
      </div>

      {/* Right side: actions */}
      <div className="flex items-center">
        <div className="flex items-center gap-px">
          {personas.length > 0 && (
            <PersonaPicker
              personas={personas}
              selectedPersonaId={selectedPersonaId}
              onPersonaChange={(id) => onPersonaChange?.(id)}
              onCreatePersona={onCreatePersona}
              triggerVariant="icon"
            />
          )}

          {contextLimit > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Context usage"
              title={`${contextTokens.toLocaleString()} / ${contextLimit.toLocaleString()} tokens`}
            >
              <ContextRing tokens={contextTokens} limit={contextLimit} />
            </Button>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled
                  aria-label="Voice input (coming soon)"
                >
                  <Mic />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Voice input (coming soon)</TooltipContent>
          </Tooltip>
        </div>

        <div className="ml-2">
          {isStreaming ? (
            <Button
              type="button"
              onClick={onStop}
              variant="ghost"
              size="icon-sm"
              className="rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
              aria-label="Stop generation"
              title="Stop generation"
            >
              <Square className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              size="icon-sm"
              className={cn(
                "rounded-full",
                canSend
                  ? "bg-foreground text-background shadow-none hover:bg-foreground/90"
                  : "cursor-default bg-foreground/10 text-muted-foreground disabled:opacity-100",
              )}
              aria-label="Send message"
              title={canSend ? "Send message" : undefined}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
