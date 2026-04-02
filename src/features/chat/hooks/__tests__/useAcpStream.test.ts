import { act, cleanup, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "@/shared/types/messages";
import { useChatSessionStore } from "../../stores/chatSessionStore";
import { useChatStore } from "../../stores/chatStore";

type EventCallback = (event: { payload: Record<string, unknown> }) => void;

const listeners = new Map<string, EventCallback[]>();

function emit(eventName: string, payload: Record<string, unknown>) {
  const callbacks = listeners.get(eventName) ?? [];
  for (const callback of callbacks) {
    callback({ payload });
  }
}

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(
    (eventName: string, callback: EventCallback): Promise<() => void> => {
      const callbacks = listeners.get(eventName) ?? [];
      callbacks.push(callback);
      listeners.set(eventName, callbacks);
      return Promise.resolve(() => {
        const current = listeners.get(eventName) ?? [];
        listeners.set(
          eventName,
          current.filter((entry) => entry !== callback),
        );
      });
    },
  ),
}));

import { useAcpStream } from "../useAcpStream";

function makeStreamingMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-1",
    role: "assistant",
    created: Date.now(),
    content: [{ type: "text", text: "" }],
    metadata: { userVisible: true },
    ...overrides,
  };
}

function setupStreaming(sessionId: string, messageId = "msg-1") {
  const store = useChatStore.getState();
  store.addMessage(sessionId, makeStreamingMessage({ id: messageId }));
  store.setStreamingMessageId(sessionId, messageId);
  store.setChatState(sessionId, "streaming");
}

describe("useAcpStream", () => {
  const sessionId = "test-session";

  beforeEach(() => {
    listeners.clear();
    cleanup();
    useChatStore.setState({
      messagesBySession: {},
      sessionStateById: {},
      activeSessionId: sessionId,
      isConnected: true,
    });
    useChatSessionStore.setState({
      sessions: [
        {
          id: sessionId,
          title: "New Chat",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messageCount: 0,
        },
      ],
      activeSessionId: sessionId,
      isLoading: false,
    });
  });

  it("accumulates text chunks for the targeted session", async () => {
    setupStreaming(sessionId);

    renderHook(() => useAcpStream(true));
    await vi.waitFor(() => expect(listeners.get("acp:text")).toBeDefined());

    act(() => {
      emit("acp:text", { sessionId, text: "Hello" });
      emit("acp:text", { sessionId, text: " world" });
    });

    const messages = useChatStore.getState().messagesBySession[sessionId];
    const text = messages[0].content.find((content) => content.type === "text");
    if (text && "text" in text) {
      expect(text.text).toBe("Hello world");
    }
  });

  it("clears runtime state on acp:done for the completed session", async () => {
    setupStreaming(sessionId);

    renderHook(() => useAcpStream(true));
    await vi.waitFor(() => expect(listeners.get("acp:done")).toBeDefined());

    act(() => {
      emit("acp:text", { sessionId, text: "partial" });
      emit("acp:done", { sessionId });
    });

    const runtime = useChatStore.getState().getSessionRuntime(sessionId);
    expect(runtime.chatState).toBe("idle");
    expect(runtime.streamingMessageId).toBeNull();
    expect(runtime.hasUnread).toBe(false);
  });

  it("marks a background session unread when it completes", async () => {
    const backgroundSessionId = "background-session";

    setupStreaming(backgroundSessionId);
    useChatSessionStore.setState((state) => ({
      ...state,
      sessions: [
        ...state.sessions,
        {
          id: backgroundSessionId,
          title: "Background Chat",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messageCount: 0,
        },
      ],
      activeSessionId: sessionId,
    }));

    renderHook(() => useAcpStream(true));
    await vi.waitFor(() => expect(listeners.get("acp:done")).toBeDefined());

    act(() => {
      emit("acp:done", { sessionId: backgroundSessionId });
    });

    expect(
      useChatStore.getState().getSessionRuntime(backgroundSessionId).hasUnread,
    ).toBe(true);
    expect(useChatStore.getState().getSessionRuntime(sessionId).hasUnread).toBe(
      false,
    );
  });

  it("updates multiple sessions independently", async () => {
    const otherSessionId = "other-session";

    setupStreaming(sessionId, "msg-1");
    setupStreaming(otherSessionId, "msg-2");

    renderHook(() => useAcpStream(true));
    await vi.waitFor(() => expect(listeners.get("acp:text")).toBeDefined());

    act(() => {
      emit("acp:text", { sessionId, text: "Alpha" });
      emit("acp:text", { sessionId: otherSessionId, text: "Beta" });
      emit("acp:done", { sessionId: otherSessionId });
    });

    const primary = useChatStore.getState().messagesBySession[sessionId];
    const secondary = useChatStore.getState().messagesBySession[otherSessionId];
    const primaryText = primary[0].content.find(
      (content) => content.type === "text",
    );
    const secondaryText = secondary[0].content.find(
      (content) => content.type === "text",
    );

    if (primaryText && "text" in primaryText) {
      expect(primaryText.text).toBe("Alpha");
    }
    if (secondaryText && "text" in secondaryText) {
      expect(secondaryText.text).toBe("Beta");
    }

    expect(useChatStore.getState().getSessionRuntime(sessionId).chatState).toBe(
      "streaming",
    );
    expect(
      useChatStore.getState().getSessionRuntime(otherSessionId).chatState,
    ).toBe("idle");
  });

  it("does not register listeners when disabled", () => {
    renderHook(() => useAcpStream(false));
    expect(listeners.size).toBe(0);
  });

  it("unregisters listeners on unmount", async () => {
    const { unmount } = renderHook(() => useAcpStream(true));
    await vi.waitFor(() => expect(listeners.get("acp:text")).toBeDefined());

    expect(listeners.get("acp:text")?.length).toBe(1);

    unmount();

    await vi.waitFor(() =>
      expect(listeners.get("acp:text")?.length ?? 0).toBe(0),
    );
  });
});
