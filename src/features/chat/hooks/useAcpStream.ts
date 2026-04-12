import { useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useChatStore } from "../stores/chatStore";
import { useChatSessionStore } from "../stores/chatSessionStore";
import type { ModelOption } from "../types";
import { isDefaultChatTitle } from "../lib/sessionTitle";
import type {
  Message,
  MessageCompletionStatus,
  ToolRequestContent,
  ToolResponseContent,
} from "@/shared/types/messages";
import {
  ensureReplayBuffer,
  getBufferedMessage,
  getAndDeleteReplayBuffer,
  findLatestUnpairedToolRequest,
} from "./replayBuffer";

// --- Event payload types ---

interface AcpMessageCreatedPayload {
  sessionId: string;
  messageId: string;
  personaId?: string;
  personaName?: string;
}

interface AcpTextPayload {
  sessionId: string;
  messageId: string;
  text: string;
}

interface AcpDonePayload {
  sessionId: string;
  messageId: string;
}

interface AcpToolCallPayload {
  sessionId: string;
  messageId: string;
  toolCallId: string;
  title: string;
}

interface AcpToolTitlePayload {
  sessionId: string;
  messageId: string;
  toolCallId: string;
  title: string;
}

interface AcpToolResultPayload {
  sessionId: string;
  messageId: string;
  content: string;
}

interface AcpSessionInfoPayload {
  sessionId: string;
  title?: string;
}

interface AcpSessionBoundPayload {
  sessionId: string;
  gooseSessionId: string;
}

interface AcpModelStatePayload {
  sessionId: string;
  providerId?: string | null;
  currentModelId: string;
  currentModelName?: string;
  availableModels: ModelOption[];
}

interface AcpUsageUpdatePayload {
  sessionId: string;
  used: number;
  size: number;
}

interface AcpReplayCompletePayload {
  sessionId: string;
}

function getPendingAssistantProviderId(sessionId: string): string | undefined {
  const providerId = useChatStore.getState().getSessionRuntime(sessionId)
    .pendingAssistantProviderId;
  return providerId ?? undefined;
}

function updateCompletionStatus(
  message: Message,
  completionStatus: MessageCompletionStatus,
): Message {
  if (
    completionStatus === "completed" &&
    (message.metadata?.completionStatus === "stopped" ||
      message.metadata?.completionStatus === "error")
  ) {
    return message;
  }

  return {
    ...message,
    metadata: {
      ...message.metadata,
      completionStatus,
    },
  };
}

function shouldTrackStreamingEvent(
  store: ReturnType<typeof useChatStore.getState>,
  sessionId: string,
  messageId: string,
): boolean {
  const runtime = store.getSessionRuntime(sessionId);
  const existingMessage = store.messagesBySession[sessionId]?.find(
    (message) => message.id === messageId,
  );

  if (
    existingMessage &&
    (existingMessage.metadata?.completionStatus === "completed" ||
      existingMessage.metadata?.completionStatus === "stopped" ||
      existingMessage.metadata?.completionStatus === "error")
  ) {
    return false;
  }

  if (existingMessage || runtime.streamingMessageId === messageId) {
    return true;
  }

  return runtime.chatState === "thinking" || runtime.chatState === "streaming";
}

export function useAcpStream(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    let active = true;
    const unlisteners: Promise<UnlistenFn>[] = [];
    const replayTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

    const REPLAY_TIMEOUT_MS = 30_000;

    const unsubscribeFlush = useChatStore.subscribe((state, prevState) => {
      if (!active) return;

      // Start timeout for newly-loading sessions
      for (const sid of state.loadingSessionIds) {
        if (!prevState.loadingSessionIds.has(sid) && !replayTimeouts.has(sid)) {
          const timer = setTimeout(() => {
            replayTimeouts.delete(sid);
            const store = useChatStore.getState();
            if (store.loadingSessionIds.has(sid)) {
              console.warn(
                `[stream] ${sid.slice(0, 8)} replay_complete not received within ${REPLAY_TIMEOUT_MS / 1000}s — showing error`,
              );
              store.setSessionLoading(sid, false);
              store.setError(
                sid,
                "Session history failed to load. Try reloading.",
              );
            }
          }, REPLAY_TIMEOUT_MS);
          replayTimeouts.set(sid, timer);
        }
      }

      // Clear timeouts and flush buffers for sessions that finished loading
      for (const sid of prevState.loadingSessionIds) {
        if (!state.loadingSessionIds.has(sid)) {
          const timer = replayTimeouts.get(sid);
          if (timer) {
            clearTimeout(timer);
            replayTimeouts.delete(sid);
          }
          const buffer = getAndDeleteReplayBuffer(sid);
          if (buffer && buffer.length > 0) {
            console.log(
              `[perf:stream] ${sid.slice(0, 8)} flushing replay buffer (${buffer.length} messages) at ${performance.now().toFixed(1)}ms`,
            );
            useChatStore.getState().setMessages(sid, buffer);
          }
        }
      }
    });

    unlisteners.push(
      listen<AcpReplayCompletePayload>("acp:replay_complete", (event) => {
        if (!active) return;
        useChatStore
          .getState()
          .setSessionLoading(event.payload.sessionId, false);
      }),
    );

    unlisteners.push(
      listen<AcpMessageCreatedPayload>("acp:message_created", (event) => {
        if (!active) return;
        const store = useChatStore.getState();
        const { sessionId, messageId, personaId, personaName } = event.payload;
        const providerId = getPendingAssistantProviderId(sessionId);

        if (store.loadingSessionIds.has(sessionId)) {
          if (!getBufferedMessage(sessionId, messageId)) {
            ensureReplayBuffer(sessionId).push({
              id: messageId,
              role: "assistant",
              created: Date.now(),
              content: [],
              metadata: {
                userVisible: true,
                agentVisible: true,
                personaId,
                personaName,
                providerId,
                completionStatus: "inProgress",
              },
            });
          }
          return;
        }

        if (!shouldTrackStreamingEvent(store, sessionId, messageId)) {
          return;
        }

        const existing = store.messagesBySession[sessionId]?.find(
          (message) => message.id === messageId,
        );

        if (existing) {
          store.updateMessage(sessionId, messageId, (message) => ({
            ...message,
            metadata: {
              ...message.metadata,
              personaId: message.metadata?.personaId ?? personaId,
              personaName: message.metadata?.personaName ?? personaName,
              providerId: message.metadata?.providerId ?? providerId,
            },
          }));
        } else {
          store.addMessage(sessionId, {
            id: messageId,
            role: "assistant",
            created: Date.now(),
            content: [],
            metadata: {
              userVisible: true,
              agentVisible: true,
              personaId,
              personaName,
              providerId,
              completionStatus: "inProgress",
            },
          });
        }

        store.setPendingAssistantProvider(sessionId, null);
        store.setStreamingMessageId(sessionId, messageId);
      }),
    );

    unlisteners.push(
      listen<AcpTextPayload>("acp:text", (event) => {
        if (!active) return;
        const store = useChatStore.getState();
        const { sessionId, messageId, text } = event.payload;

        if (store.loadingSessionIds.has(sessionId)) {
          const msg = getBufferedMessage(sessionId, messageId);
          if (msg) {
            const last = msg.content[msg.content.length - 1];
            if (last?.type === "text") {
              (last as { type: "text"; text: string }).text += text;
            } else {
              msg.content.push({ type: "text", text });
            }
          }
          return;
        }

        if (!shouldTrackStreamingEvent(store, sessionId, messageId)) {
          return;
        }
        store.setStreamingMessageId(sessionId, messageId);
        store.updateStreamingText(sessionId, text);
      }),
    );

    unlisteners.push(
      listen<AcpDonePayload>("acp:done", (event) => {
        if (!active) return;
        const store = useChatStore.getState();
        const { sessionId, messageId } = event.payload;
        const isLoading = store.loadingSessionIds.has(sessionId);

        if (isLoading) {
          const msg = getBufferedMessage(sessionId, messageId);
          if (msg) {
            msg.content = msg.content.map((block) =>
              block.type === "toolRequest" && block.status === "executing"
                ? { ...block, status: "completed" as const }
                : block,
            );
            const updated = updateCompletionStatus(msg, "completed");
            if (updated !== msg && updated.metadata) {
              msg.metadata = updated.metadata;
            }
          }
          return;
        }

        store.updateMessage(sessionId, messageId, (message) => {
          const content = message.content.map((block) =>
            block.type === "toolRequest" && block.status === "executing"
              ? { ...block, status: "completed" as const }
              : block,
          );
          return updateCompletionStatus({ ...message, content }, "completed");
        });
        store.setPendingAssistantProvider(sessionId, null);
        store.setStreamingMessageId(sessionId, null);

        store.setChatState(sessionId, "idle");
        if (useChatSessionStore.getState().activeSessionId !== sessionId) {
          store.markSessionUnread(sessionId);
        }

        const sessionStore = useChatSessionStore.getState();
        const session = sessionStore.getSession(sessionId);
        if (session && isDefaultChatTitle(session.title)) {
          const messages = store.messagesBySession[sessionId];
          const firstUserMsg = messages?.find((m) => m.role === "user");
          if (firstUserMsg) {
            const textContent = firstUserMsg.content.find(
              (c) => c.type === "text" && "text" in c,
            );
            if (textContent && "text" in textContent) {
              const title = textContent.text.slice(0, 100);
              sessionStore.updateSession(
                sessionId,
                {
                  title,
                  updatedAt: new Date().toISOString(),
                },
                { persistOverlay: false },
              );
            }
          }
        }
      }),
    );

    unlisteners.push(
      listen<AcpToolCallPayload>("acp:tool_call", (event) => {
        if (!active) return;
        const store = useChatStore.getState();
        const { sessionId, messageId, toolCallId, title } = event.payload;

        if (store.loadingSessionIds.has(sessionId)) {
          const msg = getBufferedMessage(sessionId, messageId);
          if (msg) {
            msg.content.push({
              type: "toolRequest",
              id: toolCallId,
              name: title,
              arguments: {},
              status: "executing",
              startedAt: Date.now(),
            });
          }
          return;
        }

        if (!shouldTrackStreamingEvent(store, sessionId, messageId)) {
          return;
        }

        const toolRequest: ToolRequestContent = {
          type: "toolRequest",
          id: toolCallId,
          name: title,
          arguments: {},
          status: "executing",
          startedAt: Date.now(),
        };
        store.setStreamingMessageId(sessionId, messageId);
        store.appendToStreamingMessage(sessionId, toolRequest);
      }),
    );

    unlisteners.push(
      listen<AcpToolTitlePayload>("acp:tool_title", (event) => {
        if (!active) return;
        const { sessionId: sid, messageId, toolCallId, title } = event.payload;
        const store = useChatStore.getState();

        if (store.loadingSessionIds.has(sid)) {
          const msg = getBufferedMessage(sid, messageId);
          if (msg) {
            const tc = msg.content.find(
              (c) => c.type === "toolRequest" && c.id === toolCallId,
            );
            if (tc && tc.type === "toolRequest") {
              (tc as ToolRequestContent).name = title;
            }
          }
          return;
        }

        if (!shouldTrackStreamingEvent(store, sid, messageId)) {
          return;
        }
        store.updateMessage(sid, messageId, (msg) => ({
          ...msg,
          content: msg.content.map((c) =>
            c.type === "toolRequest" && c.id === toolCallId
              ? { ...c, name: title }
              : c,
          ),
        }));
      }),
    );

    unlisteners.push(
      listen<AcpToolResultPayload>("acp:tool_result", (event) => {
        if (!active) return;
        const store = useChatStore.getState();
        const { sessionId, messageId, content } = event.payload;

        if (store.loadingSessionIds.has(sessionId)) {
          const msg = getBufferedMessage(sessionId, messageId);
          if (msg) {
            const toolRequest = findLatestUnpairedToolRequest(msg.content);
            if (toolRequest) {
              const idx = msg.content.indexOf(toolRequest);
              if (idx >= 0) {
                msg.content[idx] = { ...toolRequest, status: "completed" };
              }
            }
            msg.content.push({
              type: "toolResponse",
              id: toolRequest?.id ?? crypto.randomUUID(),
              name: toolRequest?.name ?? "",
              result: content,
              isError: false,
            });
          }
          return;
        }

        if (!shouldTrackStreamingEvent(store, sessionId, messageId)) {
          return;
        }
        const streamingMessage = messageId
          ? store.messagesBySession[sessionId]?.find(
              (message) => message.id === messageId,
            )
          : undefined;
        const toolRequest = streamingMessage
          ? findLatestUnpairedToolRequest(streamingMessage.content)
          : null;
        store.updateMessage(sessionId, messageId, (message) => ({
          ...message,
          content: message.content.map((block) =>
            block.type === "toolRequest" && block.id === toolRequest?.id
              ? { ...block, status: "completed" }
              : block,
          ),
        }));
        const toolResponse: ToolResponseContent = {
          type: "toolResponse",
          id: toolRequest?.id ?? crypto.randomUUID(),
          name: toolRequest?.name ?? "",
          result: content,
          isError: false,
        };
        store.setStreamingMessageId(sessionId, messageId);
        store.appendToStreamingMessage(sessionId, toolResponse);
      }),
    );

    unlisteners.push(
      listen<{ sessionId: string; messageId: string; text: string }>(
        "acp:replay_user_message",
        (event) => {
          if (!active) return;
          const { sessionId, messageId, text } = event.payload;
          ensureReplayBuffer(sessionId).push({
            id: messageId,
            role: "user",
            created: Date.now(),
            content: [{ type: "text", text }],
            metadata: { userVisible: true, agentVisible: true },
          });
        },
      ),
    );

    unlisteners.push(
      listen<AcpSessionBoundPayload>("acp:session_bound", (event) => {
        if (!active) return;
        useChatSessionStore
          .getState()
          .setSessionAcpId(
            event.payload.sessionId,
            event.payload.gooseSessionId,
          );
      }),
    );

    unlisteners.push(
      listen<AcpSessionInfoPayload>("acp:session_info", (event) => {
        if (!active) return;
        const session = useChatSessionStore
          .getState()
          .getSession(event.payload.sessionId);
        if (event.payload.title && !session?.userSetName) {
          useChatSessionStore.getState().updateSession(
            event.payload.sessionId,
            {
              title: event.payload.title,
            },
            { persistOverlay: false },
          );
        }
      }),
    );

    unlisteners.push(
      listen<AcpModelStatePayload>("acp:model_state", (event) => {
        if (!active) return;
        const {
          sessionId,
          providerId,
          currentModelId,
          currentModelName,
          availableModels,
        } = event.payload;
        const sessionStore = useChatSessionStore.getState();
        if (providerId) {
          sessionStore.cacheModelsForProvider(providerId, availableModels);
        }
        const session = sessionStore.getSession(sessionId);
        const sessionProvider = session?.providerId;
        if (providerId && sessionProvider && providerId !== sessionProvider) {
          console.debug(
            `[acp:model_state] Ignoring event: provider mismatch (event: ${providerId}, session: ${sessionProvider})`,
          );
          return;
        }
        const modelName = currentModelName ?? currentModelId;
        sessionStore.setSessionModels(sessionId, availableModels);
        if (!providerId && session?.modelId) {
          return;
        }
        sessionStore.updateSession(
          sessionId,
          {
            modelId: currentModelId,
            modelName,
          },
          { persistOverlay: false },
        );
      }),
    );

    unlisteners.push(
      listen<AcpUsageUpdatePayload>("acp:usage_update", (event) => {
        if (!active) return;
        useChatStore.getState().updateTokenState(event.payload.sessionId, {
          accumulatedTotal: event.payload.used,
          contextLimit: event.payload.size,
        });
      }),
    );

    return () => {
      active = false;
      unsubscribeFlush();
      for (const timer of replayTimeouts.values()) {
        clearTimeout(timer);
      }
      replayTimeouts.clear();
      for (const unlistenPromise of unlisteners) {
        unlistenPromise.then((unlisten) => unlisten());
      }
    };
  }, [enabled]);
}
