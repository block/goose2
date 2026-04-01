import { useState, useEffect, useCallback } from "react";
import { useAgentStore } from "@/features/agents/stores/agentStore";
import { useProviderSelection } from "@/features/agents/hooks/useProviderSelection";
import { ChatInput } from "@/features/chat/ui/ChatInput";
import { useProjectStore } from "@/features/projects/stores/projectStore";

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
      <span className="text-6xl font-light font-mono tracking-tight text-foreground">
        {hours}:{minutes}
      </span>
      <span className="text-lg text-foreground-secondary">{period}</span>
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

  const handlePersonaChange = useCallback(
    (personaId: string | null) => {
      setSelectedPersonaId(personaId);
      if (personaId) {
        const persona = personas.find((p) => p.id === personaId);
        if (persona?.provider) {
          setSelectedProviderWithoutPersist(persona.provider);
        }
      }
    },
    [personas, setSelectedProviderWithoutPersist],
  );

  const handleCreatePersona = useCallback(() => {
    useAgentStore.getState().openPersonaEditor();
  }, []);

  const handleSend = useCallback(
    (message: string, personaId?: string) => {
      const effectivePersonaId = personaId ?? selectedPersonaId ?? undefined;

      onStartChat?.(
        message,
        selectedProvider,
        effectivePersonaId,
        selectedProjectId,
      );
    },
    [onStartChat, selectedPersonaId, selectedProjectId, selectedProvider],
  );

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="relative flex min-h-full flex-col items-center justify-center px-6 pb-4">
        <div className="flex w-full max-w-[600px] flex-col">
          {/* Clock */}
          <HomeClock />

          {/* Greeting */}
          <p className="mb-6 pl-4 text-xl font-light text-foreground-secondary">
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
            selectedProjectId={selectedProjectId}
            availableProjects={projects.map((project) => ({
              id: project.id,
              name: project.name,
              workingDir: project.workingDirs[0] ?? null,
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
