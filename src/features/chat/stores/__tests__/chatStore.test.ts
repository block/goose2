import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore } from "../chatStore";
import type { Message } from "@/shared/types/messages";
import { INITIAL_TOKEN_STATE } from "@/shared/types/chat";

// ── helpers ───────────────────────────────────────────────────────────

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    created: Date.now(),
    content: [{ type: "text", text: "hello" }],
    metadata: { userVisible: true },
    ...overrides,
  };
}

// ── tests ─────────────────────────────────────────────────────────────

describe("chatStore", () => {
  beforeEach(() => {
    // Reset the store between tests
    useChatStore.setState({
      messagesBySession: {},
      activeSessionId: null,
      chatState: "idle",
      streamingMessageId: null,
      tokenState: { ...INITIAL_TOKEN_STATE },
      error: null,
      isConnected: false,
    });
  });

  // ── initial state ─────────────────────────────────────────────────

  it("has correct initial state", () => {
    const state = useChatStore.getState();
    expect(state.messagesBySession).toEqual({});
    expect(state.chatState).toBe("idle");
    expect(state.activeSessionId).toBeNull();
    expect(state.streamingMessageId).toBeNull();
    expect(state.error).toBeNull();
  });

  // ── session management ────────────────────────────────────────────

  it("setActiveSession updates activeSessionId", () => {
    useChatStore.getState().setActiveSession("s1");
    expect(useChatStore.getState().activeSessionId).toBe("s1");
  });

  // ── message management ────────────────────────────────────────────

  it("addMessage adds message to the correct session", () => {
    const msg = makeMessage();
    useChatStore.getState().addMessage("s1", msg);
    expect(useChatStore.getState().messagesBySession.s1).toEqual([msg]);
  });

  it("addMessage creates session array if it does not exist", () => {
    const msg = makeMessage();
    useChatStore.getState().addMessage("new-session", msg);
    expect(
      useChatStore.getState().messagesBySession["new-session"],
    ).toHaveLength(1);
  });

  it("setMessages replaces all messages for a session", () => {
    const m1 = makeMessage();
    const m2 = makeMessage();
    useChatStore.getState().addMessage("s1", m1);
    useChatStore.getState().setMessages("s1", [m2]);
    expect(useChatStore.getState().messagesBySession.s1).toEqual([m2]);
  });

  it("removeMessage removes the correct message", () => {
    const m1 = makeMessage({ id: "keep" });
    const m2 = makeMessage({ id: "remove" });
    useChatStore.getState().setMessages("s1", [m1, m2]);
    useChatStore.getState().removeMessage("s1", "remove");
    const msgs = useChatStore.getState().messagesBySession.s1;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].id).toBe("keep");
  });

  it("clearMessages empties the session", () => {
    useChatStore.getState().addMessage("s1", makeMessage());
    useChatStore.getState().clearMessages("s1");
    expect(useChatStore.getState().messagesBySession.s1).toEqual([]);
  });

  it("updateMessage correctly applies updater function", () => {
    const msg = makeMessage({ id: "u1" });
    useChatStore.getState().setMessages("s1", [msg]);
    useChatStore.getState().updateMessage("s1", "u1", (m) => ({
      ...m,
      content: [{ type: "text", text: "updated" }],
    }));
    const updated = useChatStore.getState().messagesBySession.s1[0];
    expect(updated.content[0]).toEqual({ type: "text", text: "updated" });
  });

  // ── chat state ────────────────────────────────────────────────────

  it("setChatState updates state", () => {
    useChatStore.getState().setChatState("streaming");
    expect(useChatStore.getState().chatState).toBe("streaming");
  });

  // ── streaming ─────────────────────────────────────────────────────

  it("setStreamingMessageId updates streaming ID", () => {
    useChatStore.getState().setStreamingMessageId("msg-1");
    expect(useChatStore.getState().streamingMessageId).toBe("msg-1");
  });

  it("updateStreamingText appends streamed chunks to the trailing text block", () => {
    const msg = makeMessage({
      id: "stream-1",
      content: [{ type: "text", text: "" }],
    });
    useChatStore.getState().setMessages("s1", [msg]);
    useChatStore.getState().setStreamingMessageId("stream-1");
    useChatStore.getState().updateStreamingText("s1", "new");
    useChatStore.getState().updateStreamingText("s1", " text");
    const updated = useChatStore.getState().messagesBySession.s1[0];
    expect(updated.content[0]).toEqual({ type: "text", text: "new text" });
  });

  it("updateStreamingText starts a new text block after tool content", () => {
    const msg = makeMessage({
      id: "stream-inline",
      content: [
        { type: "text", text: "Lemme check..." },
        {
          type: "toolRequest",
          id: "tool-1",
          name: "readFile",
          arguments: {},
          status: "executing",
        },
      ],
    });
    useChatStore.getState().setMessages("s1", [msg]);
    useChatStore.getState().setStreamingMessageId("stream-inline");
    useChatStore
      .getState()
      .updateStreamingText("s1", " Results from checking.");

    const updated = useChatStore.getState().messagesBySession.s1[0];
    expect(updated.content).toHaveLength(3);
    expect(updated.content[2]).toEqual({
      type: "text",
      text: " Results from checking.",
    });
  });

  it("appendToStreamingMessage adds content to the streaming message", () => {
    const msg = makeMessage({ id: "stream-2", content: [] });
    useChatStore.getState().setMessages("s1", [msg]);
    useChatStore.getState().setStreamingMessageId("stream-2");
    useChatStore
      .getState()
      .appendToStreamingMessage("s1", { type: "text", text: "appended" });
    const updated = useChatStore.getState().messagesBySession.s1[0];
    expect(updated.content).toHaveLength(1);
    expect(updated.content[0]).toEqual({ type: "text", text: "appended" });
  });

  // ── token tracking ────────────────────────────────────────────────

  it("updateTokenState accumulates tokens correctly", () => {
    useChatStore
      .getState()
      .updateTokenState({ inputTokens: 100, outputTokens: 50 });
    const ts = useChatStore.getState().tokenState;
    expect(ts.inputTokens).toBe(100);
    expect(ts.outputTokens).toBe(50);
    expect(ts.totalTokens).toBe(150);
    expect(ts.accumulatedInput).toBe(100);
    expect(ts.accumulatedOutput).toBe(50);
    expect(ts.accumulatedTotal).toBe(150);
  });

  it("resetTokenState clears all token counts", () => {
    useChatStore
      .getState()
      .updateTokenState({ inputTokens: 100, outputTokens: 50 });
    useChatStore.getState().resetTokenState();
    expect(useChatStore.getState().tokenState).toEqual(INITIAL_TOKEN_STATE);
  });

  // ── getActiveMessages ─────────────────────────────────────────────

  it("getActiveMessages returns only userVisible messages", () => {
    const visible = makeMessage({ metadata: { userVisible: true } });
    const hidden = makeMessage({ metadata: { userVisible: false } });
    const noMeta = makeMessage({ metadata: undefined });
    useChatStore.getState().setMessages("s1", [visible, hidden, noMeta]);
    useChatStore.getState().setActiveSession("s1");
    const active = useChatStore.getState().getActiveMessages();
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(visible.id);
  });

  it("getActiveMessages returns empty array when no active session", () => {
    expect(useChatStore.getState().getActiveMessages()).toEqual([]);
  });

  // ── streaming error cleanup ──────────────────────────────────────

  it("setError transitions chatState to 'error'", () => {
    useChatStore.getState().setChatState("streaming");
    useChatStore.getState().setError("something broke");
    const state = useChatStore.getState();
    expect(state.chatState).toBe("error");
    expect(state.error).toBe("something broke");
  });

  it("setError(null) preserves current chatState", () => {
    useChatStore.getState().setChatState("streaming");
    useChatStore.getState().setError(null);
    expect(useChatStore.getState().chatState).toBe("streaming");
    expect(useChatStore.getState().error).toBeNull();
  });

  it("error cleanup pattern clears both error and streamingMessageId", () => {
    const msg = makeMessage({ id: "s1" });
    useChatStore.getState().setMessages("s1", [msg]);
    useChatStore.getState().setStreamingMessageId("s1");
    useChatStore.getState().setChatState("streaming");

    // Simulate the error cleanup pattern from useChat (Bug 3 fix)
    useChatStore.getState().setError("ACP connection lost");
    useChatStore.getState().setStreamingMessageId(null);

    const state = useChatStore.getState();
    expect(state.chatState).toBe("error");
    expect(state.error).toBe("ACP connection lost");
    expect(state.streamingMessageId).toBeNull();
  });

  it("updateStreamingText creates a text block when none exists", () => {
    const msg = makeMessage({ id: "stream-no-text", content: [] });
    useChatStore.getState().setMessages("s1", [msg]);
    useChatStore.getState().setStreamingMessageId("stream-no-text");
    useChatStore.getState().updateStreamingText("s1", "created from nothing");
    const updated = useChatStore.getState().messagesBySession.s1[0];
    expect(updated.content).toHaveLength(1);
    expect(updated.content[0]).toEqual({
      type: "text",
      text: "created from nothing",
    });
  });

  it("updateStreamingText is a no-op when streamingMessageId is null", () => {
    const msg = makeMessage({
      id: "m1",
      content: [{ type: "text", text: "original" }],
    });
    useChatStore.getState().setMessages("s1", [msg]);
    // streamingMessageId is null by default
    useChatStore.getState().updateStreamingText("s1", "should not appear");
    const updated = useChatStore.getState().messagesBySession.s1[0];
    expect(updated.content[0]).toEqual({ type: "text", text: "original" });
  });

  it("appendToStreamingMessage is a no-op when streamingMessageId is null", () => {
    const msg = makeMessage({ id: "m1", content: [] });
    useChatStore.getState().setMessages("s1", [msg]);
    useChatStore
      .getState()
      .appendToStreamingMessage("s1", { type: "text", text: "nope" });
    const updated = useChatStore.getState().messagesBySession.s1[0];
    expect(updated.content).toHaveLength(0);
  });

  // ── cleanup ───────────────────────────────────────────────────────

  it("cleanupSession removes all data for the session", () => {
    useChatStore.getState().addMessage("s1", makeMessage());
    useChatStore.getState().setActiveSession("s1");
    useChatStore.getState().cleanupSession("s1");
    expect(useChatStore.getState().messagesBySession.s1).toBeUndefined();
    expect(useChatStore.getState().activeSessionId).toBeNull();
  });
});
