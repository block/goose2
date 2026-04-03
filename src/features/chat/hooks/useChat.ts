import { useCallback, useMemo, useRef } from "react";
import { useChatStore } from "../stores/chatStore";
import { useChatSessionStore } from "../stores/chatSessionStore";
import {
  createSystemNotificationMessage,
  createUserMessage,
} from "@/shared/types/messages";
import type { ChatState, TokenState } from "@/shared/types/chat";
import { acpSendMessage, acpCancelSession } from "@/shared/api/acp";
import {
  forkSession as apiForkSession,
  getSessionMessages,
} from "@/shared/api/chat";
import { useAgentStore } from "@/features/agents/stores/agentStore";
import { findLastIndex } from "@/shared/lib/arrays";
import type { ForkTree } from "../types/forks";

function getErrorMessage(error: unknown): string {
  // Tauri command rejections typically arrive as plain strings, so handle
  // that shape first before falling back to standard Error objects.
  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message;
  }

  return "Unknown error";
}

function markMessageStopped(sessionId: string, messageId: string) {
  useChatStore.getState().updateMessage(sessionId, messageId, (message) => {
    if (
      message.metadata?.completionStatus === "completed" ||
      message.metadata?.completionStatus === "error" ||
      message.metadata?.completionStatus === "stopped"
    ) {
      return message;
    }

    return {
      ...message,
      metadata: {
        ...message.metadata,
        completionStatus: "stopped",
      },
      content: message.content.map((block) =>
        block.type === "toolRequest" && block.status === "executing"
          ? { ...block, status: "stopped" }
          : block,
      ),
    };
  });
}

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
  const streamingPersonaIdRef = useRef<string | null>(null);

  const effectiveSessionId = useMemo(
    () => store.computeLeafSessionId(sessionId),
    [store, sessionId],
  );

  const forkTree: ForkTree = store.getForkTree(sessionId);
  const hasForks = Object.keys(forkTree).length > 0;

  const messages = useMemo(() => {
    if (hasForks) {
      return store.computeDisplayMessages(sessionId);
    }
    return store.messagesBySession[sessionId] ?? [];
  }, [hasForks, store, sessionId, store.messagesBySession, store.forkTreeByRoot]);

  const { chatState, tokenState, error, streamingMessageId } =
    store.getSessionRuntime(effectiveSessionId);
  const isStreaming = chatState === "streaming" || streamingMessageId !== null;

  const getStreamingPersonaId = useCallback(() => {
    if (!streamingMessageId) {
      return null;
    }

    return (
      messages.find((message) => message.id === streamingMessageId)?.metadata
        ?.personaId ?? null
    );
  }, [messages, streamingMessageId]);

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

  const _sendToBackend = useCallback(
    async (
      targetSessionId: string,
      text: string,
      effectivePersonaInfo?: { id: string; name: string },
      images?: { base64: string; mimeType: string }[],
      options?: { skipUserMessage?: boolean },
    ) => {
      const abort = new AbortController();
      abortRef.current = abort;
      streamingPersonaIdRef.current = effectivePersonaInfo?.id ?? null;

      try {
        const agent = useAgentStore.getState().getActiveAgent();
        const providerId = providerOverride ?? agent?.provider ?? "goose";
        const systemPrompt =
          systemPromptOverride ?? agent?.systemPrompt ?? undefined;

        // Send via ACP — response streams back through Tauri events
        // which are handled by the global useAcpStream listener in AppShell.
        store.setChatState(targetSessionId, "streaming");
        // When images are present with no text, pass a single space so the ACP
        // driver doesn't send an empty text content block that goose rejects.
        const acpPrompt = text.trim() || (images?.length ? " " : text);
        await acpSendMessage(targetSessionId, providerId, acpPrompt, {
          systemPrompt,
          workingDir: workingDirOverride,
          personaId: effectivePersonaInfo?.id,
          personaName: effectivePersonaInfo?.name,
          images: images?.map(
            (img) => [img.base64, img.mimeType] as [string, string],
          ),
          skipUserMessage: options?.skipUserMessage,
        });
        // Note: setChatState("idle") is handled by useAcpStream on "acp:done"
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          store.setChatState(targetSessionId, "idle");
        } else {
          const errorMessage = getErrorMessage(err);
          const liveStore = useChatStore.getState();
          const { streamingMessageId } =
            liveStore.getSessionRuntime(targetSessionId);
          if (streamingMessageId) {
            liveStore.updateMessage(
              targetSessionId,
              streamingMessageId,
              (message) => ({
                ...message,
                metadata: {
                  ...message.metadata,
                  completionStatus: "error",
                },
              }),
            );
          }

          liveStore.addMessage(
            targetSessionId,
            createSystemNotificationMessage(errorMessage, "error"),
          );
          store.setError(targetSessionId, errorMessage);
          store.setChatState(targetSessionId, "idle");
          store.setStreamingMessageId(targetSessionId, null);
        }
      } finally {
        abortRef.current = null;
        streamingPersonaIdRef.current = null;
      }
    },
    [store, providerOverride, systemPromptOverride, workingDirOverride],
  );

  const sendMessage = useCallback(
    async (
      text: string,
      overridePersona?: { id: string; name?: string },
      images?: { base64: string; mimeType: string }[],
    ) => {
      if (
        (!text.trim() && (!images || images.length === 0)) ||
        chatState === "streaming" ||
        chatState === "thinking"
      )
        return;

      const effectivePersonaInfo = resolvePersonaInfo(
        overridePersona?.id,
        overridePersona?.name,
      );

      const targetSessionId = store.computeLeafSessionId(sessionId);

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
      // Embed image content blocks into the user message for local display
      if (images && images.length > 0) {
        for (const img of images) {
          userMessage.content.push({
            type: "image",
            source: {
              type: "base64",
              mediaType: img.mimeType,
              data: img.base64,
            },
          });
        }
      }
      store.addMessage(targetSessionId, userMessage);
      store.setChatState(targetSessionId, "thinking");
      store.setError(targetSessionId, null);

      // Immediately set the session/sidebar title from the user's message when
      // the session still has the default placeholder.  This gives instant
      // feedback instead of waiting for acp:done or acp:session_info.
      // A better backend-generated title will overwrite this if it arrives
      // via the acp:session_info event.
      const sessionStore = useChatSessionStore.getState();
      const session = sessionStore.getSession(sessionId);
      if (session && session.title === "New Chat") {
        sessionStore.updateSession(sessionId, {
          title: text.trim().slice(0, 40),
        });
      }

      await _sendToBackend(
        targetSessionId,
        text,
        effectivePersonaInfo,
        images,
      );
    },
    [
      sessionId,
      chatState,
      store,
      resolvePersonaInfo,
      _sendToBackend,
    ],
  );

  const retryUserMessage = useCallback(
    async (messageId: string) => {
      const currentLeaf = store.computeLeafSessionId(sessionId);

      // Fork the session at the given message
      const forkedSession = await apiForkSession(currentLeaf, messageId);

      // Load the forked session's messages
      const forkedMessages = await getSessionMessages(forkedSession.id);
      store.setMessages(forkedSession.id, forkedMessages);

      // Register the fork in the session store
      const sessionStore = useChatSessionStore.getState();
      sessionStore.addForkedSession({
        id: forkedSession.id,
        title: forkedSession.title,
        agentId: forkedSession.agentId,
        projectId: forkedSession.projectId,
        providerId: forkedSession.providerId,
        personaId: forkedSession.personaId,
        modelName: forkedSession.modelName,
        createdAt: forkedSession.createdAt,
        updatedAt: forkedSession.updatedAt,
        archivedAt: forkedSession.archivedAt,
        messageCount: forkedSession.messageCount,
        forkedFrom: forkedSession.forkedFrom,
        forkPointMessageId: forkedSession.forkPointMessageId,
      });

      // Register the fork in the chat store
      store.addFork(sessionId, messageId, currentLeaf, forkedSession.id);

      // Send to backend with skipUserMessage since the fork already has it
      store.setChatState(forkedSession.id, "thinking");
      store.setError(forkedSession.id, null);

      // Find the user message text to resend
      const allMessages = store.messagesBySession[currentLeaf] ?? [];
      const userMsg = allMessages.find((m) => m.id === messageId);
      const textContent = userMsg?.content.find((c) => c.type === "text");
      const text = textContent && "text" in textContent ? textContent.text : "";

      const persona = userMsg?.metadata?.targetPersonaId
        ? resolvePersonaInfo(
            userMsg.metadata.targetPersonaId,
            userMsg.metadata.targetPersonaName,
          )
        : undefined;

      await _sendToBackend(forkedSession.id, text, persona, undefined, {
        skipUserMessage: true,
      });
    },
    [sessionId, store, resolvePersonaInfo, _sendToBackend],
  );

  const switchBranch = useCallback(
    async (messageId: string, branchIndex: number) => {
      store.setActiveBranch(sessionId, messageId, branchIndex);

      // Lazy-load messages for the branch if not already loaded
      const tree = store.getForkTree(sessionId);
      const branchInfo = tree[messageId];
      if (branchInfo) {
        const branch = branchInfo.branches[branchIndex];
        if (branch && !store.messagesBySession[branch.sessionId]) {
          const msgs = await getSessionMessages(branch.sessionId);
          store.setMessages(branch.sessionId, msgs);
        }
      }
    },
    [sessionId, store],
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    const activePersonaId =
      streamingPersonaIdRef.current ?? getStreamingPersonaId();
    const targetSessionId = store.computeLeafSessionId(sessionId);
    const activeStreamingMessageId = useChatStore
      .getState()
      .getSessionRuntime(targetSessionId).streamingMessageId;

    store.setChatState(targetSessionId, "idle");
    store.setStreamingMessageId(targetSessionId, null);
    // Cancel the backend ACP session to stop orphaned streaming events
    acpCancelSession(targetSessionId, activePersonaId ?? undefined)
      .then((wasCancelled) => {
        if (wasCancelled && activeStreamingMessageId) {
          markMessageStopped(targetSessionId, activeStreamingMessageId);
        }
      })
      .catch(() => {
        // Best-effort cancellation — ignore errors
      });
  }, [getStreamingPersonaId, store, sessionId]);

  const retryLastMessage = useCallback(async () => {
    const displayMessages = hasForks
      ? store.computeDisplayMessages(sessionId)
      : store.messagesBySession[sessionId] ?? [];
    // Find the last user message
    const lastUserIndex = findLastIndex(
      displayMessages,
      (m) => m.role === "user",
    );
    if (lastUserIndex === -1) return;

    const lastUserMessage = displayMessages[lastUserIndex];
    await retryUserMessage(lastUserMessage.id);
  }, [sessionId, store, hasForks, retryUserMessage]);

  const clearChat = useCallback(() => {
    abortRef.current?.abort();
    store.clearMessages(sessionId);
    store.setChatState(sessionId, "idle");
    store.setStreamingMessageId(sessionId, null);
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
    forkTree,
    retryUserMessage,
    switchBranch,
  };
}
