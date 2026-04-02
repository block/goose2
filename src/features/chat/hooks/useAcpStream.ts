import { useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useChatStore } from "../stores/chatStore";
import { useChatSessionStore } from "../stores/chatSessionStore";
import type {
  MessageContent,
  ToolRequestContent,
  ToolResponseContent,
} from "@/shared/types/messages";
import { createSystemNotificationMessage } from "@/shared/types/messages";

// --- Event payload types ---

interface AcpTextPayload {
  sessionId: string;
  text: string;
}

interface AcpDonePayload {
  sessionId: string;
}

interface AcpErrorPayload {
  sessionId: string;
  error: string;
}

interface AcpToolCallPayload {
  sessionId: string;
  toolCallId: string;
  title: string;
}

interface AcpToolTitlePayload {
  sessionId: string;
  toolCallId: string;
  title: string;
}

interface AcpToolResultPayload {
  sessionId: string;
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

function findLatestUnpairedToolRequest(
  content: MessageContent[],
): ToolRequestContent | null {
  for (let index = content.length - 1; index >= 0; index -= 1) {
    const block = content[index];
    if (block?.type !== "toolRequest") {
      continue;
    }

    const alreadyHasResponse = content.some(
      (candidate): candidate is ToolResponseContent =>
        candidate.type === "toolResponse" && candidate.id === block.id,
    );

    if (!alreadyHasResponse) {
      return block;
    }
  }

  return null;
}

/**
 * Hook that listens to Tauri events for ACP streaming responses.
 *
 * Subscribes to `acp:text`, `acp:done`, `acp:tool_call`, `acp:tool_title`,
 * and `acp:tool_result` events, updating whichever session the event targets.
 */
export function useAcpStream(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    // Guard against duplicate listeners from React StrictMode double-mounting.
    // Each listener checks this flag before acting; cleanup sets it immediately.
    let active = true;

    const unlisteners: Promise<UnlistenFn>[] = [];

    // acp:text — append streamed text to the current trailing text segment
    unlisteners.push(
      listen<AcpTextPayload>("acp:text", (event) => {
        if (!active) return;
        useChatStore
          .getState()
          .updateStreamingText(event.payload.sessionId, event.payload.text);
      }),
    );

    // acp:done — finalize the message, set chat state to idle
    unlisteners.push(
      listen<AcpDonePayload>("acp:done", (event) => {
        if (!active) return;
        const store = useChatStore.getState();
        store.setStreamingMessageId(event.payload.sessionId, null);
        store.setChatState(event.payload.sessionId, "idle");
        if (
          useChatSessionStore.getState().activeSessionId !==
          event.payload.sessionId
        ) {
          store.markSessionUnread(event.payload.sessionId);
        }

        // Generate a title from the first user message if the session still
        // has the default "New Chat" title (i.e. no ACP title was received).
        const sessionStore = useChatSessionStore.getState();
        const session = sessionStore.getSession(event.payload.sessionId);
        if (session && session.title === "New Chat") {
          const messages = store.messagesBySession[event.payload.sessionId];
          const firstUserMsg = messages?.find((m) => m.role === "user");
          if (firstUserMsg) {
            const textContent = firstUserMsg.content.find(
              (c) => c.type === "text" && "text" in c,
            );
            if (textContent && "text" in textContent) {
              const title = textContent.text.slice(0, 40);
              sessionStore.updateSession(event.payload.sessionId, { title });
            }
          }
        }
      }),
    );

    unlisteners.push(
      listen<AcpErrorPayload>("acp:error", (event) => {
        if (!active) return;
        const store = useChatStore.getState();
        const { sessionId, error } = event.payload;
        const { streamingMessageId } = store.getSessionRuntime(sessionId);
        const streamingMessage = streamingMessageId
          ? store.messagesBySession[sessionId]?.find(
              (message) => message.id === streamingMessageId,
            )
          : undefined;

        if (streamingMessageId && streamingMessage?.content.length === 0) {
          store.removeMessage(sessionId, streamingMessageId);
        }

        store.addMessage(
          sessionId,
          createSystemNotificationMessage(error, "error"),
        );
        store.setError(sessionId, error);
        store.setStreamingMessageId(sessionId, null);
        store.setChatState(sessionId, "idle");

        if (useChatSessionStore.getState().activeSessionId !== sessionId) {
          store.markSessionUnread(sessionId);
        }
      }),
    );

    // acp:tool_call — add a tool request to the streaming message
    unlisteners.push(
      listen<AcpToolCallPayload>("acp:tool_call", (event) => {
        if (!active) return;
        const toolRequest: ToolRequestContent = {
          type: "toolRequest",
          id: event.payload.toolCallId,
          name: event.payload.title,
          arguments: {},
          status: "executing",
        };
        useChatStore
          .getState()
          .appendToStreamingMessage(event.payload.sessionId, toolRequest);
      }),
    );

    // acp:tool_title — update a tool call's title
    unlisteners.push(
      listen<AcpToolTitlePayload>("acp:tool_title", (event) => {
        if (!active) return;
        const { sessionId: sid, toolCallId, title } = event.payload;
        const store = useChatStore.getState();
        const { streamingMessageId } = store.getSessionRuntime(sid);
        if (!streamingMessageId) return;
        store.updateMessage(sid, streamingMessageId, (msg) => ({
          ...msg,
          content: msg.content.map((c) =>
            c.type === "toolRequest" && c.id === toolCallId
              ? { ...c, name: title }
              : c,
          ),
        }));
      }),
    );

    // acp:tool_result — add a tool response
    unlisteners.push(
      listen<AcpToolResultPayload>("acp:tool_result", (event) => {
        if (!active) return;
        const store = useChatStore.getState();
        const { streamingMessageId } = store.getSessionRuntime(
          event.payload.sessionId,
        );
        const streamingMessage = streamingMessageId
          ? store.messagesBySession[event.payload.sessionId]?.find(
              (message) => message.id === streamingMessageId,
            )
          : undefined;
        const toolRequest = streamingMessage
          ? findLatestUnpairedToolRequest(streamingMessage.content)
          : null;
        const toolResponse: ToolResponseContent = {
          type: "toolResponse",
          id: toolRequest?.id ?? crypto.randomUUID(),
          name: toolRequest?.name ?? "",
          result: event.payload.content,
          isError: false,
        };
        store.appendToStreamingMessage(event.payload.sessionId, toolResponse);
      }),
    );

    // acp:session_info — update session title from ACP provider
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

    // acp:model_state — update model name from ACP provider
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

    // acp:usage_update — update context window token usage
    unlisteners.push(
      listen<AcpUsageUpdatePayload>("acp:usage_update", (event) => {
        if (!active) return;
        useChatStore.getState().updateTokenState(event.payload.sessionId, {
          accumulatedTotal: event.payload.used,
          contextLimit: event.payload.size,
        });
      }),
    );

    // Cleanup: mark inactive immediately to prevent stale listeners from
    // firing during the async unlisten, then tear down actual subscriptions.
    return () => {
      active = false;
      for (const unlistenPromise of unlisteners) {
        unlistenPromise.then((unlisten) => unlisten());
      }
    };
  }, [enabled]);
}
