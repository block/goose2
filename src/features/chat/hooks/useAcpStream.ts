import { useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useChatStore } from "../stores/chatStore";
import { useChatSessionStore } from "../stores/chatSessionStore";
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

interface AcpModelStatePayload {
  sessionId: string;
  currentModelId: string;
  currentModelName?: string;
}

interface AcpUsageUpdatePayload {
  sessionId: string;
  used: number;
  size: number;
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

/**
 * Hook that listens to Tauri events for ACP streaming responses.
 *
 * Subscribes to `acp:text`, `acp:done`, `acp:tool_call`, `acp:tool_title`,
 * and `acp:tool_result` events, updating whichever session the event targets.
 *
 * During session history replay, events are buffered in a module-level map
 * (see `replayBuffer.ts`) and flushed as a single `setMessages()` call when
 * loading completes, avoiding O(N²) re-renders.
 */
export function useAcpStream(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    let active = true;
    const unlisteners: Promise<UnlistenFn>[] = [];

    // Flush replay buffers when a session transitions from loading → loaded.
    const unsubscribeFlush = useChatStore.subscribe((state, prevState) => {
      if (!active) return;
      for (const sid of prevState.loadingSessionIds) {
        if (!state.loadingSessionIds.has(sid)) {
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
      listen<AcpMessageCreatedPayload>("acp:message_created", (event) => {
        if (!active) return;
        const store = useChatStore.getState();
        const { sessionId, messageId, personaId, personaName } = event.payload;

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

        if (!existing) {
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
              completionStatus: "inProgress",
            },
          });
        }

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
            if (msg.metadata) {
              msg.metadata = { ...msg.metadata, completionStatus: "completed" };
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
              sessionStore.updateSession(sessionId, {
                title,
                updatedAt: new Date().toISOString(),
              });
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
      listen<AcpSessionInfoPayload>("acp:session_info", (event) => {
        if (!active) return;
        if (event.payload.title) {
          useChatSessionStore
            .getState()
            .updateSession(event.payload.sessionId, {
              title: event.payload.title,
            });
        }
      }),
    );

    unlisteners.push(
      listen<AcpModelStatePayload>("acp:model_state", (event) => {
        if (!active) return;
        const modelName =
          event.payload.currentModelName ?? event.payload.currentModelId;
        useChatSessionStore
          .getState()
          .updateSession(event.payload.sessionId, { modelName });
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
      for (const unlistenPromise of unlisteners) {
        unlistenPromise.then((unlisten) => unlisten());
      }
    };
  }, [enabled]);
}
