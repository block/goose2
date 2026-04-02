import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getStoredProvider,
  useAgentStore,
} from "@/features/agents/stores/agentStore";
import { useProviderSelection } from "@/features/agents/hooks/useProviderSelection";
import { ChatInput } from "@/features/chat/ui/ChatInput";
import type { PastedImage } from "@/shared/types/messages";
import { useProjectStore } from "@/features/projects/stores/projectStore";
import { acpGetModelState } from "@/shared/api/acp";
import { useChatSessionStore } from "@/features/chat/stores/chatSessionStore";

function HomeClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const hours = time
    .toLocaleTimeString("en-US", { hour: "numeric", hour12: true })
    .replace(/\s?(AM|PM)$/i, "");
  const minutes = time
    .toLocaleTimeString("en-US", { minute: "2-digit" })
    .padStart(2, "0");
  const period = time.getHours() >= 12 ? "PM" : "AM";

  return (
    <div className="mb-1 flex items-baseline gap-1.5 pl-4">
      <span className="text-6xl font-light font-display tracking-tight text-foreground">
        {hours}:{minutes}
      </span>
      <span className="text-lg text-muted-foreground">{period}</span>
    </div>
  );
}

function getGreeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

interface HomeScreenProps {
  onStartChat?: (
    initialMessage?: string,
    providerId?: string,
    personaId?: string,
    projectId?: string | null,
    modelId?: string,
    modelName?: string,
    images?: PastedImage[],
  ) => void;
  onCreateProject?: (options?: {
    onCreated?: (projectId: string) => void;
  }) => void;
  onCreateProjectFromFolder?: (options?: {
    onCreated?: (projectId: string) => void;
  }) => void;
}

export function HomeScreen({
  onStartChat,
  onCreateProject,
  onCreateProjectFromFolder,
}: HomeScreenProps) {
  const [hour] = useState(() => new Date().getHours());
  const greeting = getGreeting(hour);

  const personas = useAgentStore((s) => s.personas);
  const {
    providers,
    providersLoading,
    selectedProvider,
    setSelectedProvider,
    setSelectedProviderWithoutPersist,
  } = useProviderSelection();
  const projects = useProjectStore((s) => s.projects);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(
    null,
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const modelStateByProvider = useChatSessionStore(
    (s) => s.modelStateByProvider,
  );
  const providerModelState = selectedProvider
    ? modelStateByProvider[selectedProvider]
    : undefined;
  const availableModels = providerModelState?.availableModels ?? [];
  const selectedModelId = providerModelState?.currentModelId;
  const selectedModelName = providerModelState?.currentModelName;
  const [modelsLoading, setModelsLoading] = useState(false);
  const selectedProject = useMemo(
    () =>
      selectedProjectId
        ? (projects.find((project) => project.id === selectedProjectId) ?? null)
        : null,
    [projects, selectedProjectId],
  );
  const bootstrapSessionId = useMemo(
    () =>
      `home-bootstrap-${selectedProvider}-${selectedPersonaId ?? "default"}`,
    [selectedPersonaId, selectedProvider],
  );

  const handlePersonaChange = useCallback(
    (personaId: string | null) => {
      setSelectedPersonaId(personaId);
      const persona = personaId
        ? personas.find((candidate) => candidate.id === personaId)
        : null;
      const nextProvider = persona?.provider ?? getStoredProvider(providers);

      setSelectedProviderWithoutPersist(nextProvider);
    },
    [personas, providers, setSelectedProviderWithoutPersist],
  );

  const handleCreatePersona = useCallback(() => {
    useAgentStore.getState().openPersonaEditor();
  }, []);

  const handleSend = useCallback(
    (message: string, personaId?: string, images?: PastedImage[]) => {
      const effectivePersonaId = personaId ?? selectedPersonaId ?? undefined;

      onStartChat?.(
        message,
        selectedProvider,
        effectivePersonaId,
        selectedProjectId,
        selectedModelId,
        selectedModelName,
        images,
      );
    },
    [
      onStartChat,
      selectedModelId,
      selectedModelName,
      selectedPersonaId,
      selectedProjectId,
      selectedProvider,
    ],
  );

  useEffect(() => {
    let cancelled = false;
    setModelsLoading(true);

    acpGetModelState(bootstrapSessionId, selectedProvider, {
      personaId: selectedPersonaId ?? undefined,
      workingDir: selectedProject?.workingDirs[0] ?? undefined,
      persistSession: false,
    })
      .then((modelState) => {
        if (cancelled) {
          return;
        }

        useChatSessionStore.getState().setModelState("home", {
          providerId: selectedProvider,
          source: modelState.source,
          configId: modelState.configId,
          currentModelId: modelState.currentModelId,
          currentModelName:
            modelState.currentModelName ?? modelState.currentModelId,
          availableModels: modelState.availableModels,
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        console.error("Failed to bootstrap home model state:", error);
      })
      .finally(() => {
        setModelsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    bootstrapSessionId,
    selectedPersonaId,
    selectedProject,
    selectedProvider,
  ]);

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="relative flex min-h-full flex-col items-center justify-center px-6 pb-4">
        <div className="flex w-full max-w-[600px] flex-col">
          {/* Clock */}
          <HomeClock />

          {/* Greeting */}
          <p className="mb-6 pl-4 text-xl font-light font-display text-muted-foreground">
            {greeting}
          </p>

          {/* Chat input */}
          <ChatInput
            onSend={handleSend}
            personas={personas}
            selectedPersonaId={selectedPersonaId}
            onPersonaChange={handlePersonaChange}
            onCreatePersona={handleCreatePersona}
            providers={providers}
            providersLoading={providersLoading}
            selectedProvider={selectedProvider}
            onProviderChange={setSelectedProvider}
            currentModel={
              modelsLoading ? "Loading models..." : (selectedModelName ?? "")
            }
            currentModelId={selectedModelId}
            modelsLoading={modelsLoading}
            availableModels={availableModels}
            onModelChange={(modelId) => {
              const model = availableModels.find(
                (candidate) => candidate.id === modelId,
              );
              if (selectedProvider) {
                useChatSessionStore.getState().setModelState("home", {
                  providerId: selectedProvider,
                  source: providerModelState?.source ?? "session_model",
                  configId: providerModelState?.configId,
                  currentModelId: modelId,
                  currentModelName:
                    model?.displayName ?? model?.name ?? modelId,
                  availableModels,
                });
              }
            }}
            selectedProjectId={selectedProjectId}
            availableProjects={projects.map((project) => ({
              id: project.id,
              name: project.name,
              workingDir: project.workingDirs[0] ?? null,
              color: project.color,
            }))}
            onProjectChange={setSelectedProjectId}
            onCreateProject={(options) =>
              onCreateProject?.({
                onCreated: (projectId) => {
                  setSelectedProjectId(projectId);
                  options?.onCreated?.(projectId);
                },
              })
            }
            onCreateProjectFromFolder={(options) =>
              onCreateProjectFromFolder?.({
                onCreated: (projectId) => {
                  setSelectedProjectId(projectId);
                  options?.onCreated?.(projectId);
                },
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
