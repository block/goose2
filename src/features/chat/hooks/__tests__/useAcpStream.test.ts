import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useChatStore } from "../../stores/chatStore";
import { INITIAL_TOKEN_STATE } from "@/shared/types/chat";
import type { Message } from "@/shared/types/messages";

// ── Tauri listen mock ────────────────────────────────────────────────

type EventCallback = (event: { payload: Record<string, unknown> }) => void;

const listeners = new Map<string, EventCallback[]>();

function emit(eventName: string, payload: Record<string, unknown>) {
  const cbs = listeners.get(eventName) ?? [];
  for (const cb of cbs) {
    cb({ payload });
  }
}

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(
    (eventName: string, callback: EventCallback): Promise<() => void> => {
      const cbs = listeners.get(eventName) ?? [];
      cbs.push(callback);
      listeners.set(eventName, cbs);
      return Promise.resolve(() => {
        const current = listeners.get(eventName) ?? [];
        listeners.set(
          eventName,
          current.filter((cb) => cb !== callback),
        );
      });
    },
  ),
}));

// Import hook AFTER mock is set up
import { useAcpStream } from "../useAcpStream";

// ── helpers ──────────────────────────────────────────────────────────

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

function setupStreaming(sessionId: string) {
  const msg = makeStreamingMessage();
  const store = useChatStore.getState();
  store.addMessage(sessionId, msg);
  store.setStreamingMessageId("msg-1");
  store.setChatState("streaming");
}

// ── tests ────────────────────────────────────────────────────────────

describe("useAcpStream", () => {
  const sessionId = "test-session";

  beforeEach(() => {
    listeners.clear();
    cleanup();
    useChatStore.setState({
      messagesBySession: {},
      chatState: "idle",
      streamingMessageId: null,
      tokenState: { ...INITIAL_TOKEN_STATE },
      error: null,
      isConnected: true,
      activeSessionId: sessionId,
    });
  });

  // ── text events ──────────────────────────────────────────────────

  it("accumulates text chunks from acp:text events", async () => {
    setupStreaming(sessionId);

    renderHook(() => useAcpStream(sessionId, true));
    // Allow listen promises to resolve
    await vi.waitFor(() => expect(listeners.get("acp:text")).toBeDefined());

    act(() => {
      emit("acp:text", { sessionId, text: "Hello" });
      emit("acp:text", { sessionId, text: " world" });
    });

    const messages = useChatStore.getState().messagesBySession[sessionId];
    const textContent = messages[0].content.find((c) => c.type === "text");
    expect(textContent).toBeDefined();
    if (textContent && "text" in textContent) {
      expect(textContent.text).toBe("Hello world");
    }
  });

  // ── session filtering ────────────────────────────────────────────

  it("ignores events targeting a different session", async () => {
    setupStreaming(sessionId);

    renderHook(() => useAcpStream(sessionId, true));
    await vi.waitFor(() => expect(listeners.get("acp:text")).toBeDefined());

    act(() => {
      emit("acp:text", { sessionId: "other-session", text: "wrong" });
    });

    const messages = useChatStore.getState().messagesBySession[sessionId];
    const textContent = messages[0].content.find((c) => c.type === "text");
    if (textContent && "text" in textContent) {
      expect(textContent.text).toBe("");
    }
  });

  // ── done handling ────────────────────────────────────────────────

  it("clears streaming state on acp:done", async () => {
    setupStreaming(sessionId);

    renderHook(() => useAcpStream(sessionId, true));
    await vi.waitFor(() => expect(listeners.get("acp:done")).toBeDefined());

    act(() => {
      emit("acp:text", { sessionId, text: "partial" });
      emit("acp:done", { sessionId });
    });

    const state = useChatStore.getState();
    expect(state.streamingMessageId).toBeNull();
    expect(state.chatState).toBe("idle");
    // Text should be preserved in the message
    const messages = state.messagesBySession[sessionId];
    const textContent = messages[0].content.find((c) => c.type === "text");
    if (textContent && "text" in textContent) {
      expect(textContent.text).toBe("partial");
    }
  });

  // ── tool_call events ─────────────────────────────────────────────

  it("appends tool request on acp:tool_call", async () => {
    const msg = makeStreamingMessage({ content: [] });
    useChatStore.getState().addMessage(sessionId, msg);
    useChatStore.getState().setStreamingMessageId("msg-1");
    useChatStore.getState().setChatState("streaming");

    renderHook(() => useAcpStream(sessionId, true));
    await vi.waitFor(() =>
      expect(listeners.get("acp:tool_call")).toBeDefined(),
    );

    act(() => {
      emit("acp:tool_call", {
        sessionId,
        toolCallId: "tool-1",
        title: "read_file",
      });
    });

    const messages = useChatStore.getState().messagesBySession[sessionId];
    expect(messages[0].content).toHaveLength(1);
    const toolContent = messages[0].content[0];
    expect(toolContent.type).toBe("toolRequest");
    if (toolContent.type === "toolRequest") {
      expect(toolContent.id).toBe("tool-1");
      expect(toolContent.name).toBe("read_file");
      expect(toolContent.status).toBe("executing");
    }
  });

  it("updates the active tool request title on acp:tool_title", async () => {
    const msg = makeStreamingMessage({
      content: [
        {
          type: "toolRequest",
          id: "tool-1",
          name: "placeholder",
          arguments: {},
          status: "executing",
        },
      ],
    });
    useChatStore.getState().addMessage(sessionId, msg);
    useChatStore.getState().setStreamingMessageId("msg-1");
    useChatStore.getState().setChatState("streaming");

    renderHook(() => useAcpStream(sessionId, true));
    await vi.waitFor(() =>
      expect(listeners.get("acp:tool_title")).toBeDefined(),
    );

    act(() => {
      emit("acp:tool_title", {
        sessionId,
        toolCallId: "tool-1",
        title: "read_file",
      });
    });

    const messages = useChatStore.getState().messagesBySession[sessionId];
    const toolContent = messages[0].content[0];
    expect(toolContent.type).toBe("toolRequest");
    if (toolContent.type === "toolRequest") {
      expect(toolContent.name).toBe("read_file");
    }
  });

  // ── tool_result events ───────────────────────────────────────────

  it("appends tool response on acp:tool_result", async () => {
    const msg = makeStreamingMessage({
      content: [
        {
          type: "toolRequest",
          id: "tool-1",
          name: "read_file",
          arguments: {},
          status: "executing",
        },
      ],
    });
    useChatStore.getState().addMessage(sessionId, msg);
    useChatStore.getState().setStreamingMessageId("msg-1");
    useChatStore.getState().setChatState("streaming");

    renderHook(() => useAcpStream(sessionId, true));
    await vi.waitFor(() =>
      expect(listeners.get("acp:tool_result")).toBeDefined(),
    );

    act(() => {
      emit("acp:tool_result", { sessionId, content: "file contents here" });
    });

    const messages = useChatStore.getState().messagesBySession[sessionId];
    expect(messages[0].content).toHaveLength(2);
    const toolContent = messages[0].content[1];
    expect(toolContent.type).toBe("toolResponse");
    if (toolContent.type === "toolResponse") {
      expect(toolContent.id).toBe("tool-1");
      expect(toolContent.name).toBe("read_file");
      expect(toolContent.result).toBe("file contents here");
      expect(toolContent.isError).toBe(false);
    }
  });

  // ── enabled flag ─────────────────────────────────────────────────

  it("does not register listeners when disabled", () => {
    setupStreaming(sessionId);

    renderHook(() => useAcpStream(sessionId, false));

    // No listeners should be registered
    expect(listeners.size).toBe(0);
  });

  // ── cleanup on unmount ───────────────────────────────────────────

  it("unregisters all listeners on unmount", async () => {
    setupStreaming(sessionId);

    const { unmount } = renderHook(() => useAcpStream(sessionId, true));
    await vi.waitFor(() => expect(listeners.get("acp:text")).toBeDefined());

    // Listeners are registered
    expect(listeners.get("acp:text")?.length).toBe(1);

    unmount();
    // Allow unlisten promises to resolve
    await vi.waitFor(() =>
      expect(listeners.get("acp:text")?.length ?? 0).toBe(0),
    );

    expect(listeners.get("acp:done")?.length ?? 0).toBe(0);
    expect(listeners.get("acp:tool_call")?.length ?? 0).toBe(0);
    expect(listeners.get("acp:tool_result")?.length ?? 0).toBe(0);
  });

  // ── interleaved content ──────────────────────────────────────────

  it("handles interleaved text and tool events", async () => {
    setupStreaming(sessionId);

    renderHook(() => useAcpStream(sessionId, true));
    await vi.waitFor(() => expect(listeners.get("acp:text")).toBeDefined());

    act(() => {
      emit("acp:text", { sessionId, text: "Let me read that." });
      emit("acp:tool_call", {
        sessionId,
        toolCallId: "t1",
        title: "read_file",
      });
      emit("acp:tool_result", { sessionId, content: "file data" });
      emit("acp:text", { sessionId, text: " Here is what I found." });
    });

    const messages = useChatStore.getState().messagesBySession[sessionId];
    expect(messages[0].content).toHaveLength(4);
    expect(messages[0].content[0].type).toBe("text");
    expect(messages[0].content[1].type).toBe("toolRequest");
    expect(messages[0].content[2].type).toBe("toolResponse");
    expect(messages[0].content[3].type).toBe("text");
    if (messages[0].content[2].type === "toolResponse") {
      expect(messages[0].content[2].id).toBe("t1");
    }
    if (messages[0].content[3].type === "text") {
      expect(messages[0].content[3].text).toBe(" Here is what I found.");
    }
  });
});
