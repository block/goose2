import { useState, useEffect, useRef } from "react";
import { MessageTimeline } from "./MessageTimeline";
import { ChatInput } from "./ChatInput";
import { StreamingIndicator } from "./StreamingIndicator";
import { useChat } from "../hooks/useChat";
import { useAcpStream } from "../hooks/useAcpStream";
import { discoverAcpProviders, type AcpProvider } from "@/shared/api/acp";

interface ChatViewProps {
  sessionId?: string;
  agentName?: string;
  agentAvatarUrl?: string;
  initialProvider?: string;
  initialMessage?: string;
  onInitialMessageConsumed?: () => void;
}

export function ChatView({
  sessionId,
  agentName = "Goose",
  agentAvatarUrl,
  initialProvider,
  initialMessage,
  onInitialMessageConsumed,
}: ChatViewProps) {
  const [activeSessionId] = useState(() => sessionId ?? crypto.randomUUID());
  const [providers, setProviders] = useState<AcpProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState(
    initialProvider ?? "goose",
  );

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

  const providerLabel = providers.find((p) => p.id === selectedProvider)?.label;
  const displayAgentName = providerLabel ?? agentName;

  const {
    messages,
    chatState,
    sendMessage,
    stopStreaming,
    streamingMessageId,
  } = useChat(activeSessionId, selectedProvider);

  // Listen for ACP streaming events
  useAcpStream(activeSessionId, true);

  // Auto-send initial message from HomeScreen on mount
  const initialMessageSent = useRef(false);
  useEffect(() => {
    if (initialMessage && !initialMessageSent.current) {
      initialMessageSent.current = true;
      sendMessage(initialMessage);
      onInitialMessageConsumed?.();
    }
  }, [initialMessage, sendMessage, onInitialMessageConsumed]);

  const isStreaming = chatState === "streaming";
  const showIndicator = chatState === "thinking" || chatState === "compacting";

  return (
    <div className="flex h-full flex-col">
      <MessageTimeline
        messages={messages}
        streamingMessageId={streamingMessageId}
        isStreaming={isStreaming}
        agentName={displayAgentName}
        agentAvatarUrl={agentAvatarUrl}
      />

      {showIndicator && (
        <StreamingIndicator
          agentName={displayAgentName}
          state={chatState as "thinking" | "streaming" | "compacting"}
        />
      )}

      <ChatInput
        onSend={sendMessage}
        onStop={stopStreaming}
        isStreaming={isStreaming || chatState === "thinking"}
        placeholder={`Message ${displayAgentName}...`}
        providers={providers}
        selectedProvider={selectedProvider}
        onProviderChange={setSelectedProvider}
      />
    </div>
  );
}
