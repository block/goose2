import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AcpSessionInfo } from "@/shared/api/acp";
import { useChatSessionStore } from "../chatSessionStore";

vi.mock("@/shared/api/acp", () => ({
  acpListSessions: vi.fn(),
}));

import { acpListSessions } from "@/shared/api/acp";

const mockedAcpListSessions = vi.mocked(acpListSessions);

const SESSION_CACHE_KEY = "goose:chat-sessions";

function resetStore() {
  useChatSessionStore.setState({
    sessions: [],
    activeSessionId: null,
    isLoading: false,
    contextPanelOpenBySession: {},
  });
}

describe("chatSessionStore", () => {
  beforeEach(() => {
    resetStore();
    window.localStorage.removeItem(SESSION_CACHE_KEY);
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.localStorage.removeItem(SESSION_CACHE_KEY);
  });

  describe("createDraftSession", () => {
    it("creates a draft session with default title", () => {
      const session = useChatSessionStore.getState().createDraftSession();

      expect(session.title).toBe("New Chat");
      expect(session.draft).toBe(true);
      expect(session.messageCount).toBe(0);
      expect(useChatSessionStore.getState().sessions).toContainEqual(session);
    });

    it("creates a draft session with custom options", () => {
      const session = useChatSessionStore.getState().createDraftSession({
        title: "My Custom Chat",
        projectId: "proj-1",
        providerId: "openai",
        personaId: "persona-1",
      });

      expect(session.title).toBe("My Custom Chat");
      expect(session.projectId).toBe("proj-1");
      expect(session.providerId).toBe("openai");
      expect(session.personaId).toBe("persona-1");
      expect(session.draft).toBe(true);
    });
  });

  describe("promoteDraft", () => {
    it("removes draft flag from a draft session", () => {
      const session = useChatSessionStore.getState().createDraftSession();
      expect(session.draft).toBe(true);

      useChatSessionStore.getState().promoteDraft(session.id);

      const updated = useChatSessionStore
        .getState()
        .sessions.find((s) => s.id === session.id);
      expect(updated?.draft).toBeUndefined();
    });

    it("does nothing for non-draft sessions", () => {
      useChatSessionStore.setState({
        sessions: [
          {
            id: "non-draft",
            title: "Regular Session",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messageCount: 5,
          },
        ],
      });

      useChatSessionStore.getState().promoteDraft("non-draft");

      const session = useChatSessionStore
        .getState()
        .sessions.find((s) => s.id === "non-draft");
      expect(session?.draft).toBeUndefined();
    });
  });

  describe("removeDraft", () => {
    it("removes a draft session", () => {
      const session = useChatSessionStore.getState().createDraftSession();
      expect(useChatSessionStore.getState().sessions).toHaveLength(1);

      useChatSessionStore.getState().removeDraft(session.id);

      expect(useChatSessionStore.getState().sessions).toHaveLength(0);
    });

    it("clears activeSessionId if removing the active draft", () => {
      const session = useChatSessionStore.getState().createDraftSession();
      useChatSessionStore.getState().setActiveSession(session.id);

      useChatSessionStore.getState().removeDraft(session.id);

      expect(useChatSessionStore.getState().activeSessionId).toBeNull();
    });

    it("does not remove non-draft sessions", () => {
      useChatSessionStore.setState({
        sessions: [
          {
            id: "non-draft",
            title: "Regular Session",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messageCount: 5,
          },
        ],
      });

      useChatSessionStore.getState().removeDraft("non-draft");

      expect(useChatSessionStore.getState().sessions).toHaveLength(1);
    });
  });

  describe("loadSessions", () => {
    it("loads sessions from ACP and maps them correctly", async () => {
      mockedAcpListSessions.mockResolvedValue([
        { sessionId: "acp-1", title: "ACP Session 1", updatedAt: "2026-04-01" },
        { sessionId: "acp-2", title: null, updatedAt: "2026-04-02" },
      ]);

      await useChatSessionStore.getState().loadSessions();

      const sessions = useChatSessionStore.getState().sessions;
      expect(sessions).toHaveLength(2);
      expect(sessions[0].id).toBe("acp-2"); // Most recent first
      expect(sessions[0].title).toBe("Untitled"); // null title becomes "Untitled"
      expect(sessions[1].id).toBe("acp-1");
      expect(sessions[1].title).toBe("ACP Session 1");
    });

    it("preserves local drafts alongside ACP sessions", async () => {
      const draft = useChatSessionStore.getState().createDraftSession({
        title: "My Draft",
      });

      mockedAcpListSessions.mockResolvedValue([
        { sessionId: "acp-1", title: "ACP Session", updatedAt: "2026-04-01" },
      ]);

      await useChatSessionStore.getState().loadSessions();

      const sessions = useChatSessionStore.getState().sessions;
      expect(sessions).toHaveLength(2);
      expect(sessions.find((s) => s.id === "acp-1")).toBeDefined();
      expect(sessions.find((s) => s.id === draft.id)).toBeDefined();
    });

    it("sets isLoading during fetch", async () => {
      let resolvePromise: (value: AcpSessionInfo[]) => void = () => {};
      mockedAcpListSessions.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        }),
      );

      const loadPromise = useChatSessionStore.getState().loadSessions();
      expect(useChatSessionStore.getState().isLoading).toBe(true);

      resolvePromise([]);
      await loadPromise;

      expect(useChatSessionStore.getState().isLoading).toBe(false);
    });

    it("falls back to cached drafts on error", async () => {
      window.localStorage.setItem(
        SESSION_CACHE_KEY,
        JSON.stringify([
          {
            id: "cached-draft",
            title: "Cached Draft",
            draft: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messageCount: 0,
          },
        ]),
      );

      mockedAcpListSessions.mockRejectedValue(new Error("Network error"));

      await useChatSessionStore.getState().loadSessions();

      const sessions = useChatSessionStore.getState().sessions;
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe("cached-draft");
      expect(sessions[0].draft).toBe(true);
    });
  });

  describe("updateSession", () => {
    it("updates session properties", () => {
      const session = useChatSessionStore.getState().createDraftSession();

      useChatSessionStore.getState().updateSession(session.id, {
        title: "Updated Title",
        projectId: "new-project",
      });

      const updated = useChatSessionStore
        .getState()
        .sessions.find((s) => s.id === session.id);
      expect(updated?.title).toBe("Updated Title");
      expect(updated?.projectId).toBe("new-project");
    });

    it("updates the updatedAt timestamp", () => {
      const session = useChatSessionStore.getState().createDraftSession();
      const originalUpdatedAt = session.updatedAt;

      // Small delay to ensure timestamp changes
      vi.useFakeTimers();
      vi.advanceTimersByTime(1000);

      useChatSessionStore.getState().updateSession(session.id, {
        title: "New Title",
      });

      vi.useRealTimers();

      const updated = useChatSessionStore
        .getState()
        .sessions.find((s) => s.id === session.id);
      expect(updated?.updatedAt).not.toBe(originalUpdatedAt);
    });
  });

  describe("archiveSession", () => {
    it("removes the session from the list", async () => {
      const session = useChatSessionStore.getState().createDraftSession();

      await useChatSessionStore.getState().archiveSession(session.id);

      expect(useChatSessionStore.getState().sessions).toHaveLength(0);
    });

    it("clears activeSessionId if archiving the active session", async () => {
      const session = useChatSessionStore.getState().createDraftSession();
      useChatSessionStore.getState().setActiveSession(session.id);

      await useChatSessionStore.getState().archiveSession(session.id);

      expect(useChatSessionStore.getState().activeSessionId).toBeNull();
    });
  });
});
