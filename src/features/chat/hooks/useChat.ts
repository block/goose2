import { useCallback, useRef } from "react";
import { useChatStore } from "../stores/chatStore";
import { createUserMessage } from "@/shared/types/messages";
import type { Message } from "@/shared/types/messages";
import type { ChatState, TokenState } from "@/shared/types/chat";

/**
 * Hook for managing a chat session -- sending messages, handling streaming,
 * and managing chat lifecycle.
 */
export function useChat(sessionId: string) {
  const store = useChatStore();
  const abortRef = useRef<AbortController | null>(null);

  const messages = store.messagesBySession[sessionId] ?? [];
  const chatState = store.chatState;
  const tokenState = store.tokenState;
  const error = store.error;
  const streamingMessageId = store.streamingMessageId;
  const isStreaming = streamingMessageId !== null;

  // biome-ignore lint/correctness/useExhaustiveDependencies: store is stable and should not trigger re-creation
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || chatState === "streaming" || chatState === "thinking")
        return;

      // Ensure active session
      store.setActiveSession(sessionId);

      // Create and add user message
      const userMessage = createUserMessage(text);
      store.addMessage(sessionId, userMessage);
      store.setChatState("thinking");
      store.setError(null);

      // Create placeholder assistant message for streaming
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        created: Date.now(),
        content: [],
        metadata: { userVisible: true, agentVisible: true },
      };
      store.addMessage(sessionId, assistantMessage);
      store.setStreamingMessageId(assistantMessage.id);

      const abort = new AbortController();
      abortRef.current = abort;

      try {
        // TODO: Replace mock with actual Tauri command `chat_send_message`
        // via @tauri-apps/api/core invoke('chat_send_message', { ... })
        // For now, simulate a streaming response.
        await simulateStreamingResponse(
          sessionId,
          assistantMessage.id,
          abort.signal,
        );

        store.setChatState("idle");
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          store.setChatState("idle");
        } else {
          const errorMessage =
            err instanceof Error ? err.message : "Unknown error";
          store.setError(errorMessage);
        }
      } finally {
        store.setStreamingMessageId(null);
        abortRef.current = null;
      }
    },
    [sessionId, chatState, store],
  );

  /**
   * Mock streaming response simulator.
   * Replaces with real SSE/Tauri integration later.
   */
  async function simulateStreamingResponse(
    sid: string,
    messageId: string,
    signal: AbortSignal,
  ): Promise<void> {
    // TODO: Use useAgentStore.getState().getActiveAgent() to personalize responses
    const mockText =
      "Hello! I am here to help. What would you like to work on?";
    const words = mockText.split(" ");

    store.setChatState("streaming");

    // Append initial empty text block
    store.appendToStreamingMessage(sid, { type: "text", text: "" });

    let accumulated = "";
    for (const word of words) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      accumulated += (accumulated ? " " : "") + word;
      store.updateStreamingText(sid, accumulated);

      // Also update the full message for final state
      store.updateMessage(sid, messageId, (m) => ({
        ...m,
        content: m.content.map((c, i) =>
          i === m.content.length - 1 && c.type === "text"
            ? { ...c, text: accumulated }
            : c,
        ),
      }));

      await delay(50, signal);
    }
  }

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    store.setChatState("idle");
    store.setStreamingMessageId(null);
  }, [store]);

  const retryLastMessage = useCallback(async () => {
    const sessionMessages = store.messagesBySession[sessionId] ?? [];
    // Find the last user message
    const lastUserIndex = findLastIndex(
      sessionMessages,
      (m) => m.role === "user",
    );
    if (lastUserIndex === -1) return;

    const lastUserMessage = sessionMessages[lastUserIndex];

    // Remove all messages after (and including) the last assistant response
    const messagesToKeep = sessionMessages.slice(0, lastUserIndex);
    store.setMessages(sessionId, messagesToKeep);

    // Extract the text and resend
    const textContent = lastUserMessage.content.find((c) => c.type === "text");
    if (textContent && "text" in textContent) {
      await sendMessage(textContent.text);
    }
  }, [sessionId, store, sendMessage]);

  const clearChat = useCallback(() => {
    abortRef.current?.abort();
    store.clearMessages(sessionId);
    store.setChatState("idle");
    store.setStreamingMessageId(null);
  }, [sessionId, store]);

  const stopStreaming = stopGeneration;

  return {
    messages,
    chatState: chatState as ChatState,
    tokenState: tokenState as TokenState,
    error,
    streamingMessageId,
    sendMessage,
    stopGeneration,
    stopStreaming,
    retryLastMessage,
    clearChat,
    isStreaming,
  };
}

/** Delay that respects an AbortSignal. */
function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

/** Find the last index in an array matching a predicate. */
function findLastIndex<T>(
  arr: readonly T[],
  predicate: (item: T) => boolean,
): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) return i;
  }
  return -1;
}
