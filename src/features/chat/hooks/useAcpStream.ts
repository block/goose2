import { useEffect, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useChatStore } from "../stores/chatStore";
import { useChatSessionStore } from "../stores/chatSessionStore";
import type {
  ToolRequestContent,
  ToolResponseContent,
} from "@/shared/types/messages";

// --- Event payload types ---

interface AcpTextPayload {
  sessionId: string;
  text: string;
}

interface AcpDonePayload {
  sessionId: string;
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

/**
 * Hook that listens to Tauri events for ACP streaming responses.
 *
 * Subscribes to `acp:text`, `acp:done`, `acp:tool_call`, `acp:tool_title`,
 * and `acp:tool_result` events, filtering by `sessionId`. Updates the chat
 * store as streaming data arrives.
 */
export function useAcpStream(sessionId: string, enabled: boolean): void {
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  // Accumulate text chunks across events so updateStreamingText
  // always receives the full text, not just the latest delta.
  const accumulatedTextRef = useRef("");

  useEffect(() => {
    if (!enabled || !sessionId) return;

    // Guard against duplicate listeners from React StrictMode double-mounting.
    // Each listener checks this flag before acting; cleanup sets it immediately.
    let active = true;

    // Reset accumulated text when the session changes or streaming restarts.
    accumulatedTextRef.current = "";

    const unlisteners: Promise<UnlistenFn>[] = [];

    // acp:text — accumulate and update the full text in the streaming message
    unlisteners.push(
      listen<AcpTextPayload>("acp:text", (event) => {
        if (!active) return;
        if (event.payload.sessionId !== sessionIdRef.current) return;
        accumulatedTextRef.current += event.payload.text;
        useChatStore
          .getState()
          .updateStreamingText(
            event.payload.sessionId,
            accumulatedTextRef.current,
          );
      }),
    );

    // acp:done — finalize the message, set chat state to idle
    unlisteners.push(
      listen<AcpDonePayload>("acp:done", (event) => {
        if (!active) return;
        if (event.payload.sessionId !== sessionIdRef.current) return;
        accumulatedTextRef.current = "";
        const store = useChatStore.getState();
        store.setStreamingMessageId(null);
        store.setChatState("idle");

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

    // acp:tool_call — add a tool request to the streaming message
    unlisteners.push(
      listen<AcpToolCallPayload>("acp:tool_call", (event) => {
        if (!active) return;
        if (event.payload.sessionId !== sessionIdRef.current) return;
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
        if (event.payload.sessionId !== sessionIdRef.current) return;
        const { sessionId: sid, toolCallId, title } = event.payload;
        useChatStore.getState().updateMessage(sid, toolCallId, (msg) => ({
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
        if (event.payload.sessionId !== sessionIdRef.current) return;
        const toolResponse: ToolResponseContent = {
          type: "toolResponse",
          id: crypto.randomUUID(),
          name: "",
          result: event.payload.content,
          isError: false,
        };
        useChatStore
          .getState()
          .appendToStreamingMessage(event.payload.sessionId, toolResponse);
      }),
    );

    // acp:session_info — update session title from ACP provider
    unlisteners.push(
      listen<AcpSessionInfoPayload>("acp:session_info", (event) => {
        if (!active) return;
        if (event.payload.sessionId !== sessionIdRef.current) return;
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
        if (event.payload.sessionId !== sessionIdRef.current) return;
        const modelName =
          event.payload.currentModelName ?? event.payload.currentModelId;
        useChatSessionStore
          .getState()
          .updateSession(event.payload.sessionId, { modelName });
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
  }, [sessionId, enabled]);
}
