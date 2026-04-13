import { beforeEach, describe, expect, it } from "vitest";
import type {
  MessageContent,
  ToolRequestContent,
  ToolResponseContent,
} from "@/shared/types/messages";
import {
  clearReplayBuffer,
  ensureReplayBuffer,
  findLatestUnpairedToolRequest,
  getAndDeleteReplayBuffer,
  getBufferedMessage,
  getReplayBufferSize,
} from "../replayBuffer";

function makeMessage(id: string, role: "user" | "assistant" = "assistant") {
  return {
    id,
    role,
    created: Date.now(),
    content: [{ type: "text" as const, text: `content for ${id}` }],
    metadata: { userVisible: true },
  };
}

describe("replayBuffer", () => {
  const sessionId = "session-1";

  beforeEach(() => {
    // Clean up any leftover buffers
    clearReplayBuffer(sessionId);
    clearReplayBuffer("session-2");
  });

  describe("ensureReplayBuffer", () => {
    it("creates a new buffer for an unknown session", () => {
      const buffer = ensureReplayBuffer(sessionId);
      expect(buffer).toEqual([]);
    });

    it("returns the same buffer on repeated calls", () => {
      const first = ensureReplayBuffer(sessionId);
      first.push(makeMessage("msg-1"));
      const second = ensureReplayBuffer(sessionId);
      expect(second).toBe(first);
      expect(second).toHaveLength(1);
    });

    it("returns independent buffers for different sessions", () => {
      const buf1 = ensureReplayBuffer("session-1");
      const buf2 = ensureReplayBuffer("session-2");
      buf1.push(makeMessage("msg-1"));
      expect(buf2).toHaveLength(0);
    });
  });

  describe("getBufferedMessage", () => {
    it("finds a message by id", () => {
      const buffer = ensureReplayBuffer(sessionId);
      buffer.push(makeMessage("msg-1"), makeMessage("msg-2"));
      expect(getBufferedMessage(sessionId, "msg-2")?.id).toBe("msg-2");
    });

    it("returns undefined for a missing message", () => {
      ensureReplayBuffer(sessionId);
      expect(getBufferedMessage(sessionId, "nope")).toBeUndefined();
    });

    it("returns undefined for an unknown session", () => {
      expect(getBufferedMessage("no-session", "msg-1")).toBeUndefined();
    });
  });

  describe("getReplayBufferSize", () => {
    it("returns 0 for an unknown session", () => {
      expect(getReplayBufferSize("no-session")).toBe(0);
    });

    it("returns the number of buffered messages", () => {
      const buffer = ensureReplayBuffer(sessionId);
      buffer.push(makeMessage("msg-1"), makeMessage("msg-2"));
      expect(getReplayBufferSize(sessionId)).toBe(2);
    });
  });

  describe("getAndDeleteReplayBuffer", () => {
    it("returns the buffer and removes it", () => {
      const buffer = ensureReplayBuffer(sessionId);
      buffer.push(makeMessage("msg-1"));

      const result = getAndDeleteReplayBuffer(sessionId);
      expect(result).toHaveLength(1);
      expect(result?.[0].id).toBe("msg-1");

      // Buffer is gone
      expect(getReplayBufferSize(sessionId)).toBe(0);
      expect(getAndDeleteReplayBuffer(sessionId)).toBeUndefined();
    });

    it("returns undefined for an unknown session", () => {
      expect(getAndDeleteReplayBuffer("no-session")).toBeUndefined();
    });
  });

  describe("clearReplayBuffer", () => {
    it("removes the buffer without returning it", () => {
      const buffer = ensureReplayBuffer(sessionId);
      buffer.push(makeMessage("msg-1"));

      clearReplayBuffer(sessionId);
      expect(getReplayBufferSize(sessionId)).toBe(0);
    });

    it("is a no-op for an unknown session", () => {
      // Should not throw
      clearReplayBuffer("no-session");
    });
  });
});

describe("findLatestUnpairedToolRequest", () => {
  function toolRequest(id: string): ToolRequestContent {
    return {
      type: "toolRequest",
      id,
      name: `tool-${id}`,
      arguments: {},
      status: "executing",
    };
  }

  function toolResponse(id: string): ToolResponseContent {
    return {
      type: "toolResponse",
      id,
      name: `tool-${id}`,
      result: "done",
      isError: false,
    };
  }

  it("returns null for empty content", () => {
    expect(findLatestUnpairedToolRequest([])).toBeNull();
  });

  it("returns null when all requests have responses", () => {
    const content: MessageContent[] = [
      toolRequest("t1"),
      toolResponse("t1"),
      toolRequest("t2"),
      toolResponse("t2"),
    ];
    expect(findLatestUnpairedToolRequest(content)).toBeNull();
  });

  it("returns the unpaired request", () => {
    const content: MessageContent[] = [
      toolRequest("t1"),
      toolResponse("t1"),
      toolRequest("t2"),
    ];
    expect(findLatestUnpairedToolRequest(content)?.id).toBe("t2");
  });

  it("returns the latest unpaired request when multiple are unpaired", () => {
    const content: MessageContent[] = [toolRequest("t1"), toolRequest("t2")];
    expect(findLatestUnpairedToolRequest(content)?.id).toBe("t2");
  });

  it("ignores non-toolRequest content blocks", () => {
    const content: MessageContent[] = [
      { type: "text", text: "hello" },
      toolRequest("t1"),
    ];
    expect(findLatestUnpairedToolRequest(content)?.id).toBe("t1");
  });
});
