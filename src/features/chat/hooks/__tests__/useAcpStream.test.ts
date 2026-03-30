import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore } from "../../stores/chatStore";
import { INITIAL_TOKEN_STATE } from "@/shared/types/chat";
import type { Message } from "@/shared/types/messages";

// ── helpers ───────────────────────────────────────────────────────────

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

// ── tests ─────────────────────────────────────────────────────────────

describe("ACP stream store interactions", () => {
  const sessionId = "test-session";

  beforeEach(() => {
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

  it("should update streaming text on acp:text events", () => {
    const msg = makeStreamingMessage();
    const store = useChatStore.getState();
    store.addMessage(sessionId, msg);
    store.setStreamingMessageId("msg-1");
    store.setChatState("streaming");

    // Simulate what useAcpStream does on acp:text
    useChatStore.getState().updateStreamingText(sessionId, "Hello world");

    const messages = useChatStore.getState().messagesBySession[sessionId];
    expect(messages).toHaveLength(1);
    const textContent = messages[0].content.find((c) => c.type === "text");
    expect(textContent).toBeDefined();
    if (textContent && "text" in textContent) {
      expect(textContent.text).toBe("Hello world");
    }
  });

  it("should handle text accumulation across multiple events", () => {
    const msg = makeStreamingMessage();
    const store = useChatStore.getState();
    store.addMessage(sessionId, msg);
    store.setStreamingMessageId("msg-1");
    store.setChatState("streaming");

    // Simulate multiple acp:text events (each replaces the full text)
    useChatStore.getState().updateStreamingText(sessionId, "Hello");
    useChatStore.getState().updateStreamingText(sessionId, "Hello world");
    useChatStore
      .getState()
      .updateStreamingText(sessionId, "Hello world, how are you?");

    const messages = useChatStore.getState().messagesBySession[sessionId];
    const textContent = messages[0].content.find((c) => c.type === "text");
    expect(textContent).toBeDefined();
    if (textContent && "text" in textContent) {
      expect(textContent.text).toBe("Hello world, how are you?");
    }
  });

  // ── tool_call events ─────────────────────────────────────────────

  it("should append tool request on acp:tool_call events", () => {
    const msg = makeStreamingMessage({ content: [] });
    const store = useChatStore.getState();
    store.addMessage(sessionId, msg);
    store.setStreamingMessageId("msg-1");
    store.setChatState("streaming");

    // Simulate what useAcpStream does on acp:tool_call
    useChatStore.getState().appendToStreamingMessage(sessionId, {
      type: "toolRequest",
      id: "tool-1",
      name: "read_file",
      arguments: { path: "/tmp/test.txt" },
      status: "pending",
    });

    const messages = useChatStore.getState().messagesBySession[sessionId];
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toHaveLength(1);
    const toolContent = messages[0].content[0];
    expect(toolContent.type).toBe("toolRequest");
    if (toolContent.type === "toolRequest") {
      expect(toolContent.id).toBe("tool-1");
      expect(toolContent.name).toBe("read_file");
      expect(toolContent.arguments).toEqual({ path: "/tmp/test.txt" });
      expect(toolContent.status).toBe("pending");
    }
  });

  // ── tool_result events ───────────────────────────────────────────

  it("should append tool response on acp:tool_result events", () => {
    const msg = makeStreamingMessage({ content: [] });
    const store = useChatStore.getState();
    store.addMessage(sessionId, msg);
    store.setStreamingMessageId("msg-1");
    store.setChatState("streaming");

    // Simulate what useAcpStream does on acp:tool_result
    useChatStore.getState().appendToStreamingMessage(sessionId, {
      type: "toolResponse",
      id: "tool-1",
      name: "read_file",
      result: "file contents here",
      isError: false,
    });

    const messages = useChatStore.getState().messagesBySession[sessionId];
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toHaveLength(1);
    const toolContent = messages[0].content[0];
    expect(toolContent.type).toBe("toolResponse");
    if (toolContent.type === "toolResponse") {
      expect(toolContent.id).toBe("tool-1");
      expect(toolContent.name).toBe("read_file");
      expect(toolContent.result).toBe("file contents here");
      expect(toolContent.isError).toBe(false);
    }
  });

  // ── done events ──────────────────────────────────────────────────

  it("should transition to idle on acp:done events", () => {
    const msg = makeStreamingMessage();
    const store = useChatStore.getState();
    store.addMessage(sessionId, msg);
    store.setStreamingMessageId("msg-1");
    store.setChatState("streaming");

    // Simulate what useAcpStream does on acp:done
    useChatStore.getState().setChatState("idle");
    useChatStore.getState().setStreamingMessageId(null);

    const state = useChatStore.getState();
    expect(state.chatState).toBe("idle");
    expect(state.streamingMessageId).toBeNull();
  });

  // ── session filtering ──────────────────────────────────────────

  it("should not update store when event targets a different session", () => {
    const msg = makeStreamingMessage();
    const store = useChatStore.getState();
    store.addMessage(sessionId, msg);
    store.setStreamingMessageId("msg-1");
    store.setChatState("streaming");

    // Simulate an acp:text event targeting a DIFFERENT session
    // The hook filters by sessionId, so this should be a no-op
    useChatStore
      .getState()
      .updateStreamingText("other-session", "wrong session text");

    // The original session's message should be unchanged
    const messages = useChatStore.getState().messagesBySession[sessionId];
    const textContent = messages[0].content.find((c) => c.type === "text");
    expect(textContent).toBeDefined();
    if (textContent && "text" in textContent) {
      expect(textContent.text).toBe("");
    }
  });

  // ── done handling ─────────────────────────────────────────────

  it("should clear streamingMessageId and reset to idle on done", () => {
    const msg = makeStreamingMessage();
    const store = useChatStore.getState();
    store.addMessage(sessionId, msg);
    store.setStreamingMessageId("msg-1");
    store.setChatState("streaming");

    // Accumulate some text first
    useChatStore.getState().updateStreamingText(sessionId, "partial response");

    // Then simulate acp:done
    useChatStore.getState().setStreamingMessageId(null);
    useChatStore.getState().setChatState("idle");

    const state = useChatStore.getState();
    expect(state.streamingMessageId).toBeNull();
    expect(state.chatState).toBe("idle");
    // The text should remain in the message
    const messages = useChatStore.getState().messagesBySession[sessionId];
    const textContent = messages[0].content.find((c) => c.type === "text");
    expect(textContent).toBeDefined();
    if (textContent && "text" in textContent) {
      expect(textContent.text).toBe("partial response");
    }
  });

  it("should handle multiple streaming cycles (done then new stream)", () => {
    const msg1 = makeStreamingMessage({ id: "msg-1" });
    const store = useChatStore.getState();
    store.addMessage(sessionId, msg1);
    store.setStreamingMessageId("msg-1");
    store.setChatState("streaming");

    // First streaming cycle
    useChatStore.getState().updateStreamingText(sessionId, "First response");
    useChatStore.getState().setStreamingMessageId(null);
    useChatStore.getState().setChatState("idle");

    // Second streaming cycle with a new message
    const msg2 = makeStreamingMessage({
      id: "msg-2",
      content: [{ type: "text", text: "" }],
    });
    useChatStore.getState().addMessage(sessionId, msg2);
    useChatStore.getState().setStreamingMessageId("msg-2");
    useChatStore.getState().setChatState("streaming");
    useChatStore.getState().updateStreamingText(sessionId, "Second response");

    const messages = useChatStore.getState().messagesBySession[sessionId];
    expect(messages).toHaveLength(2);
    // First message keeps its text
    const firstText = messages[0].content.find((c) => c.type === "text");
    if (firstText && "text" in firstText) {
      expect(firstText.text).toBe("First response");
    }
    // Second message has new text
    const secondText = messages[1].content.find((c) => c.type === "text");
    if (secondText && "text" in secondText) {
      expect(secondText.text).toBe("Second response");
    }
  });

  // ── interleaved content ──────────────────────────────────────────

  it("should handle interleaved text and tool events", () => {
    const msg = makeStreamingMessage();
    const store = useChatStore.getState();
    store.addMessage(sessionId, msg);
    store.setStreamingMessageId("msg-1");
    store.setChatState("streaming");

    // Text first
    useChatStore
      .getState()
      .updateStreamingText(sessionId, "Let me read that file.");

    // Then tool request appended
    useChatStore.getState().appendToStreamingMessage(sessionId, {
      type: "toolRequest",
      id: "tool-1",
      name: "read_file",
      arguments: { path: "/tmp/test.txt" },
      status: "pending",
    });

    // Then tool response appended
    useChatStore.getState().appendToStreamingMessage(sessionId, {
      type: "toolResponse",
      id: "tool-1",
      name: "read_file",
      result: "contents",
      isError: false,
    });

    const messages = useChatStore.getState().messagesBySession[sessionId];
    expect(messages[0].content).toHaveLength(3);
    expect(messages[0].content[0].type).toBe("text");
    expect(messages[0].content[1].type).toBe("toolRequest");
    expect(messages[0].content[2].type).toBe("toolResponse");
  });
});
