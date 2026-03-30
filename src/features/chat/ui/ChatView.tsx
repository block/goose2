import { useState } from "react";
import { MessageTimeline } from "./MessageTimeline";
import { ChatInput } from "./ChatInput";
import { StreamingIndicator } from "./StreamingIndicator";
import { useChat } from "../hooks/useChat";

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
  const {
    messages,
    chatState,
    sendMessage,
    stopStreaming,
    streamingMessageId,
  } = useChat(activeSessionId);

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
      />
    </div>
  );
}
