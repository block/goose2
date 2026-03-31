import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { MessageTimeline } from "./MessageTimeline";
import { ChatInput } from "./ChatInput";
import { LoadingGoose } from "./LoadingGoose";
import { useChat } from "../hooks/useChat";
import { useAcpStream } from "../hooks/useAcpStream";
import { useChatStore } from "../stores/chatStore";
import { discoverAcpProviders, type AcpProvider } from "@/shared/api/acp";
import { useAgentStore } from "@/features/agents/stores/agentStore";
import { useChatSessionStore } from "../stores/chatSessionStore";
import { getProject, type ProjectInfo } from "@/features/projects/api/projects";
import { useProjectStore } from "@/features/projects/stores/projectStore";
import {
  buildProjectSystemPrompt,
  composeSystemPrompt,
  getProjectFolderOption,
} from "@/features/projects/lib/chatProjectContext";

interface ChatViewProps {
  sessionId?: string;
  agentName?: string;
  agentAvatarUrl?: string;
  initialProvider?: string;
  initialPersonaId?: string;
  initialMessage?: string;
  onInitialMessageConsumed?: () => void;
}

export function ChatView({
  sessionId,
  agentName = "Goose",
  agentAvatarUrl,
  initialProvider,
  initialPersonaId,
  initialMessage,
  onInitialMessageConsumed,
}: ChatViewProps) {
  const [activeSessionId] = useState(() => sessionId ?? crypto.randomUUID());
  const [providers, setProviders] = useState<AcpProvider[]>([]);

  // Persona state
  const personas = useAgentStore((s) => s.personas);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(
    initialPersonaId ?? "builtin-goose",
  );
  const session = useChatSessionStore((s) =>
    s.sessions.find((candidate) => candidate.id === activeSessionId),
  );
  const storedProject = useProjectStore((s) =>
    session?.projectId
      ? s.projects.find((candidate) => candidate.id === session.projectId)
      : undefined,
  );
  const [fallbackProject, setFallbackProject] = useState<ProjectInfo | null>(
    null,
  );
  const project = storedProject ?? fallbackProject;
  const effectiveProvider =
    session?.providerId ??
    initialProvider ??
    project?.preferredProvider ??
    "goose";
  const [selectedProvider, setSelectedProvider] = useState(effectiveProvider);

  const selectedPersona = personas.find((p) => p.id === selectedPersonaId);
  const projectFolder = useMemo(
    () => getProjectFolderOption(project),
    [project],
  );
  const projectSystemPrompt = useMemo(
    () => buildProjectSystemPrompt(project),
    [project],
  );
  const effectiveSystemPrompt = useMemo(
    () =>
      composeSystemPrompt(selectedPersona?.systemPrompt, projectSystemPrompt),
    [selectedPersona?.systemPrompt, projectSystemPrompt],
  );

  useEffect(() => {
    let cancelled = false;

    if (!session?.projectId || storedProject) {
      setFallbackProject(null);
      return;
    }

    getProject(session.projectId)
      .then((projectInfo) => {
        if (!cancelled) {
          setFallbackProject(projectInfo);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFallbackProject(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session?.projectId, storedProject]);

  useEffect(() => {
    discoverAcpProviders()
      .then((discovered) => {
        setProviders(discovered);
        setSelectedProvider((current) => {
          if (
            discovered.length > 0 &&
            !discovered.some((p) => p.id === current)
          ) {
            return discovered[0].id;
          }
          return current;
        });
      })
      .catch(() => setProviders([]));
  }, []);

  useEffect(() => {
    setSelectedProvider((current) =>
      current === effectiveProvider ? current : effectiveProvider,
    );
  }, [effectiveProvider]);

  const handleProviderChange = useCallback(
    (providerId: string) => {
      if (providerId === selectedProvider) {
        return;
      }

      setSelectedProvider(providerId);
      useChatSessionStore
        .getState()
        .updateSession(activeSessionId, { providerId });
    },
    [activeSessionId, selectedProvider],
  );

  // When persona changes, update the provider to match persona's default
  const handlePersonaChange = useCallback(
    (personaId: string) => {
      setSelectedPersonaId(personaId);
      const persona = personas.find((p) => p.id === personaId);
      if (persona?.provider) {
        const matchingProvider = providers.find(
          (p) =>
            p.id === persona.provider ||
            p.label.toLowerCase().includes(persona.provider ?? ""),
        );
        if (matchingProvider) {
          handleProviderChange(matchingProvider.id);
        }
      }

      // Update the active agent to match persona
      const agentStore = useAgentStore.getState();
      const matchingAgent = agentStore.agents.find(
        (a) => a.personaId === personaId,
      );
      if (matchingAgent) {
        agentStore.setActiveAgent(matchingAgent.id);
      }

      // Persist persona selection to session store
      useChatSessionStore
        .getState()
        .updateSession(activeSessionId, { personaId });
    },
    [personas, providers, activeSessionId, handleProviderChange],
  );

  // Validate persona still exists — fall back to default if deleted
  useEffect(() => {
    if (
      personas.length > 0 &&
      !personas.find((p) => p.id === selectedPersonaId)
    ) {
      const fallback =
        personas.find((p) => p.id === "builtin-goose") ?? personas[0];
      if (fallback) {
        setSelectedPersonaId(fallback.id);
        useChatSessionStore
          .getState()
          .updateSession(activeSessionId, { personaId: fallback.id });
      }
    }
  }, [personas, selectedPersonaId, activeSessionId]);

  const displayAgentName = selectedPersona?.displayName ?? agentName;

  const personaInfo = selectedPersona
    ? { id: selectedPersona.id, name: selectedPersona.displayName }
    : undefined;

  const {
    messages,
    chatState,
    sendMessage,
    stopStreaming,
    streamingMessageId,
  } = useChat(
    activeSessionId,
    selectedProvider,
    effectiveSystemPrompt,
    personaInfo,
    projectFolder?.path,
  );

  // Listen for ACP streaming events
  useAcpStream(activeSessionId, true);

  // Ref for deferred sends after persona switch (Bug 1 fix: avoid stale system prompt)
  const deferredSend = useRef<string | null>(null);

  // Wrap sendMessage to handle @ mentioned persona overrides
  const chatStore = useChatStore();
  const handleSend = useCallback(
    (text: string, personaId?: string) => {
      if (personaId && personaId !== selectedPersonaId) {
        const newPersona = personas.find((p) => p.id === personaId);
        if (newPersona) {
          // Inject a system notification about the persona switch
          chatStore.addMessage(activeSessionId, {
            id: crypto.randomUUID(),
            role: "system",
            created: Date.now(),
            content: [
              {
                type: "systemNotification",
                notificationType: "info",
                text: `Switched to ${newPersona.displayName}`,
              },
            ],
            metadata: { userVisible: true, agentVisible: false },
          });
        }
        handlePersonaChange(personaId);
        // Defer the send until after persona state updates
        deferredSend.current = text;
        return;
      }
      sendMessage(text);
    },
    [
      sendMessage,
      selectedPersonaId,
      handlePersonaChange,
      personas,
      chatStore,
      activeSessionId,
    ],
  );

  // Effect to send deferred message after persona switch completes
  useEffect(() => {
    if (deferredSend.current && selectedPersona) {
      const text = deferredSend.current;
      deferredSend.current = null;
      sendMessage(text);
    }
  }, [sendMessage, selectedPersona]);

  // Auto-send initial message from HomeScreen on mount
  const initialMessageSent = useRef(false);
  useEffect(() => {
    if (initialMessage && !initialMessageSent.current) {
      initialMessageSent.current = true;
      handleSend(initialMessage);
      onInitialMessageConsumed?.();
    }
  }, [initialMessage, handleSend, onInitialMessageConsumed]);

  const isStreaming = chatState === "streaming";
  const showIndicator =
    chatState === "thinking" ||
    chatState === "streaming" ||
    chatState === "waiting" ||
    chatState === "compacting";

  // Open persona editor
  const handleCreatePersona = useCallback(() => {
    useAgentStore.getState().openPersonaEditor();
  }, []);

  return (
    <div className="flex h-full flex-col">
      <MessageTimeline
        messages={messages}
        streamingMessageId={streamingMessageId}
        agentName={displayAgentName}
        agentAvatarUrl={selectedPersona?.avatarUrl ?? agentAvatarUrl}
      />

      {showIndicator && (
        <LoadingGoose
          agentName={displayAgentName}
          chatState={
            chatState as "thinking" | "streaming" | "waiting" | "compacting"
          }
        />
      )}

      <ChatInput
        onSend={handleSend}
        onStop={stopStreaming}
        isStreaming={isStreaming || chatState === "thinking"}
        placeholder={`Message ${displayAgentName}...`}
        // Personas
        personas={personas}
        selectedPersonaId={selectedPersonaId}
        onPersonaChange={handlePersonaChange}
        onCreatePersona={handleCreatePersona}
        // Providers (secondary)
        providers={providers}
        selectedProvider={selectedProvider}
        onProviderChange={handleProviderChange}
        folder={projectFolder?.id ?? null}
        availableFolders={projectFolder ? [projectFolder] : []}
      />
    </div>
  );
}
