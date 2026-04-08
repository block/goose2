import { Mic, ChevronDown, Check, ArrowUp, Square } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocaleFormatting } from "@/shared/i18n";
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
  hasQueuedMessage: boolean;
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
  hasQueuedMessage,
  onSend,
  onStop,
  isCompact,
}: ChatInputToolbarProps) {
  const { t } = useTranslation("chat");
  const { formatNumber } = useLocaleFormatting();
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
  const projectLabel = selectedProject?.name ?? t("toolbar.noProject");
  const projectTitle = selectedProject?.workingDirs.length
    ? selectedProject.workingDirs.join(", ")
    : undefined;
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
            ariaLabel={t("toolbar.chooseProvider")}
            value={selectedProvider}
            triggerLabel={
              providersLoading ? t("toolbar.loading") : providerLabel
            }
            icon={getProviderIcon(selectedProvider, "size-3.5")}
            triggerVariant="toolbar"
            triggerSize="sm"
            menuLabel={t("toolbar.chooseProvider")}
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
                aria-label={t("toolbar.selectModel")}
              >
                {!isCompact && <span>{currentModel}</span>}
                {isCompact && (
                  <span className="max-w-[60px] truncate">{currentModel}</span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>{t("toolbar.model")}</DropdownMenuLabel>
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
          ariaLabel={t("toolbar.selectProject")}
          value={selectedProjectId ?? NO_PROJECT_VALUE}
          triggerLabel={projectLabel}
          triggerTitle={projectTitle}
          icon={<ProjectDot color={selectedProject?.color} />}
          triggerVariant="toolbar"
          triggerSize="sm"
          menuLabel={t("toolbar.chooseProject")}
          contentWidth="wide"
          sections={[
            {
              items: [
                {
                  value: NO_PROJECT_VALUE,
                  label: t("toolbar.noProject"),
                  description: t("toolbar.generalChatWithoutProject"),
                  icon: <ProjectDot />,
                },
                ...availableProjects.map((project) => ({
                  value: project.id,
                  label: project.name,
                  description: project.workingDirs.length
                    ? project.workingDirs.join(", ")
                    : undefined,
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
                        label: t("toolbar.createProject"),
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
              aria-label={t("toolbar.contextUsage")}
              title={t("toolbar.contextUsageTitle", {
                tokens: formatNumber(contextTokens),
                limit: formatNumber(contextLimit),
              })}
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
                  aria-label={t("toolbar.voiceInputSoon")}
                >
                  <Mic />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{t("toolbar.voiceInputSoon")}</TooltipContent>
          </Tooltip>
        </div>

        <div className="ml-2">
          {isStreaming && !canSend && !hasQueuedMessage ? (
            <Button
              type="button"
              onClick={onStop}
              variant="ghost"
              size="icon-sm"
              className="rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
              aria-label={t("toolbar.stopGeneration")}
              title={t("toolbar.stopGeneration")}
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
                "shadow-none",
                canSend
                  ? "bg-foreground text-background hover:bg-foreground/90"
                  : "cursor-default bg-foreground/10 text-muted-foreground disabled:opacity-100",
              )}
              aria-label={t("toolbar.sendMessage")}
              title={canSend ? t("toolbar.sendMessage") : undefined}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
