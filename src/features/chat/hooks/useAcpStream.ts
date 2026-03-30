import { useEffect, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useChatStore } from "../stores/chatStore";
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

    // Reset accumulated text when the session changes or streaming restarts.
    accumulatedTextRef.current = "";

    const unlisteners: Promise<UnlistenFn>[] = [];

    // acp:text — accumulate and update the full text in the streaming message
    unlisteners.push(
      listen<AcpTextPayload>("acp:text", (event) => {
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
        if (event.payload.sessionId !== sessionIdRef.current) return;
        accumulatedTextRef.current = "";
        const store = useChatStore.getState();
        store.setStreamingMessageId(null);
        store.setChatState("idle");
      }),
    );

    // acp:tool_call — add a tool request to the streaming message
    unlisteners.push(
      listen<AcpToolCallPayload>("acp:tool_call", (event) => {
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

    // Cleanup: unlisten from all events on unmount or when deps change
    return () => {
      for (const unlistenPromise of unlisteners) {
        unlistenPromise.then((unlisten) => unlisten());
      }
    };
  }, [sessionId, enabled]);
}
