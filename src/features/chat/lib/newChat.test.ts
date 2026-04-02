import { describe, expect, it } from "vitest";
import { findReusableNewChatSession } from "./newChat";
import type { ChatSession } from "../stores/chatSessionStore";

function makeSession(overrides: Partial<ChatSession> = {}): ChatSession {
  return {
    id: "session-1",
    title: "New Chat",
    createdAt: "2026-03-31T10:00:00.000Z",
    updatedAt: "2026-03-31T10:00:00.000Z",
    messageCount: 0,
    ...overrides,
  };
}

describe("findReusableNewChatSession", () => {
  it("reuses the active empty New Chat session", () => {
    const activeSession = makeSession({ id: "active-session" });
    const olderSession = makeSession({
      id: "older-session",
      updatedAt: "2026-03-31T09:00:00.000Z",
    });

    const session = findReusableNewChatSession({
      sessions: [olderSession, activeSession],
      activeSessionId: activeSession.id,
      messagesBySession: {},
      request: { title: "New Chat" },
    });

    expect(session?.id).toBe(activeSession.id);
  });

  it("does not reuse sessions that already have messages", () => {
    const session = findReusableNewChatSession({
      sessions: [makeSession({ id: "used-session", messageCount: 1 })],
      activeSessionId: "used-session",
      messagesBySession: {},
      request: { title: "New Chat" },
    });

    expect(session).toBeUndefined();
  });

  it("does not reuse sessions with local in-memory messages", () => {
    const session = findReusableNewChatSession({
      sessions: [makeSession({ id: "streaming-session" })],
      activeSessionId: "streaming-session",
      messagesBySession: {
        "streaming-session": [
          {
            id: "msg-1",
            role: "user",
            created: Date.now(),
            content: [{ type: "text", text: "hello" }],
          },
        ],
      },
      request: { title: "New Chat" },
    });

    expect(session).toBeUndefined();
  });

  it("only reuses sessions for the same chat context", () => {
    const projectSession = makeSession({
      id: "project-session",
      projectId: "project-1",
    });

    const session = findReusableNewChatSession({
      sessions: [projectSession],
      activeSessionId: projectSession.id,
      messagesBySession: {},
      request: { title: "New Chat", projectId: "project-2" },
    });

    expect(session).toBeUndefined();
  });

  it("does not reuse sessions when creating a titled chat", () => {
    const session = findReusableNewChatSession({
      sessions: [makeSession()],
      activeSessionId: "session-1",
      messagesBySession: {},
      request: { title: "What day is it?" },
    });

    expect(session).toBeUndefined();
  });

  it("does not reuse inactive historical empty chats", () => {
    const session = findReusableNewChatSession({
      sessions: [makeSession({ id: "closed-session" })],
      activeSessionId: null,
      messagesBySession: {},
      request: { title: "New Chat" },
    });

    expect(session).toBeUndefined();
  });
});
