import { useState, useEffect, useRef, useCallback } from "react";
import { MessageTimeline } from "./MessageTimeline";
import { ChatInput } from "./ChatInput";
import { StreamingIndicator } from "./StreamingIndicator";
import { useChat } from "../hooks/useChat";
import { useAcpStream } from "../hooks/useAcpStream";
import { useChatStore } from "../stores/chatStore";
import { discoverAcpProviders, type AcpProvider } from "@/shared/api/acp";
import { useAgentStore } from "@/features/agents/stores/agentStore";
import { useChatSessionStore } from "../stores/chatSessionStore";

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
  const [selectedProvider, setSelectedProvider] = useState(
    initialProvider ?? "goose",
  );

  // Persona state
  const personas = useAgentStore((s) => s.personas);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(
    initialPersonaId ?? "builtin-goose",
  );

  const selectedPersona = personas.find((p) => p.id === selectedPersonaId);

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
          setSelectedProvider(matchingProvider.id);
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
    [personas, providers, activeSessionId],
  );

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
    selectedPersona?.systemPrompt,
    personaInfo,
  );

  // Listen for ACP streaming events
  useAcpStream(activeSessionId, true);

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
  const showIndicator = chatState === "thinking" || chatState === "compacting";

  // Open persona editor
  const handleCreatePersona = useCallback(() => {
    useAgentStore.getState().openPersonaEditor();
  }, []);

  return (
    <div className="flex h-full flex-col">
      <MessageTimeline
        messages={messages}
        streamingMessageId={streamingMessageId}
        isStreaming={isStreaming}
        agentName={displayAgentName}
        agentAvatarUrl={selectedPersona?.avatarUrl ?? agentAvatarUrl}
      />

      {showIndicator && (
        <StreamingIndicator
          agentName={displayAgentName}
          state={chatState as "thinking" | "streaming" | "compacting"}
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
        onProviderChange={setSelectedProvider}
      />
    </div>
  );
}
