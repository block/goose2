import { useCallback, useRef } from "react";
import { useChatStore } from "../stores/chatStore";
import { createUserMessage } from "@/shared/types/messages";
import type { Message } from "@/shared/types/messages";
import type { ChatState, TokenState } from "@/shared/types/chat";
import { acpSendMessage, acpCancelSession } from "@/shared/api/acp";
import { useAgentStore } from "@/features/agents/stores/agentStore";
import { findLastIndex } from "@/shared/lib/arrays";

/**
 * Hook for managing a chat session -- sending messages, handling streaming,
 * and managing chat lifecycle.
 */
export function useChat(
  sessionId: string,
  providerOverride?: string,
  systemPromptOverride?: string,
  personaInfo?: { id: string; name: string },
  workingDirOverride?: string,
) {
  const store = useChatStore();
  const abortRef = useRef<AbortController | null>(null);
  const activeStreamingPersonaIdRef = useRef<string | null>(null);

  const messages = store.messagesBySession[sessionId] ?? [];
  const chatState = store.chatState;
  const tokenState = store.tokenState;
  const error = store.error;
  const streamingMessageId = store.streamingMessageId;
  const isStreaming = streamingMessageId !== null;

  const resolvePersonaInfo = useCallback(
    (overridePersonaId?: string, overridePersonaName?: string) => {
      if (overridePersonaId) {
        // Read the latest persona snapshot at call time so override lookups
        // still work even if the agent store changed after this hook rendered.
        const personaName =
          overridePersonaName ??
          useAgentStore.getState().getPersonaById(overridePersonaId)
            ?.displayName ??
          overridePersonaId;
        return { id: overridePersonaId, name: personaName };
      }

      return personaInfo;
    },
    [personaInfo],
  );

  const sendMessage = useCallback(
    async (text: string, overridePersona?: { id: string; name?: string }) => {
      if (!text.trim() || chatState === "streaming" || chatState === "thinking")
        return;

      const effectivePersonaInfo = resolvePersonaInfo(
        overridePersona?.id,
        overridePersona?.name,
      );

      // Ensure active session
      store.setActiveSession(sessionId);

      // Create and add user message
      const userMessage = createUserMessage(text);
      if (effectivePersonaInfo) {
        userMessage.metadata = {
          ...userMessage.metadata,
          targetPersonaId: effectivePersonaInfo.id,
          targetPersonaName: effectivePersonaInfo.name,
        };
      }
      store.addMessage(sessionId, userMessage);
      store.setChatState("thinking");
      store.setError(null);

      // Create placeholder assistant message for streaming
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        created: Date.now(),
        content: [],
        metadata: {
          userVisible: true,
          agentVisible: true,
          personaId: effectivePersonaInfo?.id,
          personaName: effectivePersonaInfo?.name,
        },
      };
      store.addMessage(sessionId, assistantMessage);
      store.setStreamingMessageId(assistantMessage.id);

      const abort = new AbortController();
      abortRef.current = abort;
      activeStreamingPersonaIdRef.current = effectivePersonaInfo?.id ?? null;

      try {
        const agent = useAgentStore.getState().getActiveAgent();
        const providerId = providerOverride ?? agent?.provider ?? "goose";
        const systemPrompt =
          systemPromptOverride ?? agent?.systemPrompt ?? undefined;

        // Send via ACP — response streams back through Tauri events
        // which are handled by useAcpStream in ChatView.
        store.setChatState("streaming");
        await acpSendMessage(sessionId, providerId, text, {
          systemPrompt,
          workingDir: workingDirOverride,
          personaId: effectivePersonaInfo?.id,
          personaName: effectivePersonaInfo?.name,
        });
        // Note: setChatState("idle") is handled by useAcpStream on "acp:done"
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          store.setChatState("idle");
        } else {
          const errorMessage =
            err instanceof Error ? err.message : "Unknown error";
          store.setError(errorMessage);
          store.setChatState("idle");
          store.setStreamingMessageId(null);
        }
      } finally {
        abortRef.current = null;
        activeStreamingPersonaIdRef.current = null;
      }
    },
    [
      sessionId,
      chatState,
      store,
      providerOverride,
      systemPromptOverride,
      resolvePersonaInfo,
      workingDirOverride,
    ],
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    const activePersonaId = activeStreamingPersonaIdRef.current;
    store.setChatState("idle");
    store.setStreamingMessageId(null);
    activeStreamingPersonaIdRef.current = null;
    // Cancel the backend ACP session to stop orphaned streaming events
    acpCancelSession(sessionId, activePersonaId ?? undefined).catch(() => {
      // Best-effort cancellation — ignore errors
    });
  }, [store, sessionId]);

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
      const targetPersonaId = lastUserMessage.metadata?.targetPersonaId;
      const targetPersonaName = lastUserMessage.metadata?.targetPersonaName;
      await sendMessage(
        textContent.text,
        targetPersonaId
          ? { id: targetPersonaId, name: targetPersonaName }
          : undefined,
      );
    }
  }, [sessionId, store, sendMessage]);

  const clearChat = useCallback(() => {
    abortRef.current?.abort();
    activeStreamingPersonaIdRef.current = null;
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
