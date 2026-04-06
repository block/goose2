import { useState, useEffect, useCallback } from "react";
import type { ChatState } from "@/shared/types/chat";

interface QueuedMessage {
  text: string;
  personaId?: string;
  images?: { base64: string; mimeType: string }[];
}

/**
 * Single-slot message queue that holds one pending message while the agent is
 * busy and auto-sends it when the chat transitions back to idle.
 */
export function useMessageQueue(
  chatState: ChatState,
  sendMessage: (
    text: string,
    persona?: undefined,
    images?: { base64: string; mimeType: string }[],
  ) => void,
) {
  const [queuedMessage, setQueuedMessage] = useState<QueuedMessage | null>(
    null,
  );

  useEffect(() => {
    if (chatState === "idle" && queuedMessage) {
      const { text, images } = queuedMessage;
      setQueuedMessage(null);
      sendMessage(text, undefined, images);
    }
  }, [chatState, queuedMessage, sendMessage]);

  const enqueue = useCallback(
    (
      text: string,
      personaId?: string,
      images?: { base64: string; mimeType: string }[],
    ) => {
      setQueuedMessage({ text, personaId, images });
    },
    [],
  );

  const dismiss = useCallback(() => {
    setQueuedMessage(null);
  }, []);

  return { queuedMessage, enqueue, dismiss } as const;
}
