import { useState, useEffect } from "react";
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
}

export function ChatView({
  sessionId,
  agentName = "Goose",
  agentAvatarUrl,
}: ChatViewProps) {
  const [activeSessionId] = useState(() => sessionId ?? crypto.randomUUID());
  const [providers, setProviders] = useState<AcpProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState("goose");

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

  const {
    messages,
    chatState,
    sendMessage,
    stopStreaming,
    streamingMessageId,
  } = useChat(activeSessionId, selectedProvider);

  // Listen for ACP streaming events
  useAcpStream(activeSessionId, true);

  const isStreaming = chatState === "streaming";
  const showIndicator = chatState === "thinking" || chatState === "compacting";

  return (
    <div className="flex h-full flex-col">
      <MessageTimeline
        messages={messages}
        streamingMessageId={streamingMessageId}
        isStreaming={isStreaming}
        agentName={agentName}
        agentAvatarUrl={agentAvatarUrl}
      />

      {showIndicator && (
        <StreamingIndicator
          agentName={agentName}
          state={chatState as "thinking" | "streaming" | "compacting"}
        />
      )}

      <ChatInput
        onSend={sendMessage}
        onStop={stopStreaming}
        isStreaming={isStreaming || chatState === "thinking"}
        placeholder={`Message ${agentName}...`}
        providers={providers}
        selectedProvider={selectedProvider}
        onProviderChange={setSelectedProvider}
      />
    </div>
  );
}
