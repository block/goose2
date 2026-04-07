import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { useChatSessionStore } from "@/features/chat/stores/chatSessionStore";

// Mock the API module — include updateSession since chatSessionStore imports it
vi.mock("@/shared/api/chat", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/api/chat")>();
  return {
    ...actual,
    generateSessionTitle: vi.fn(),
    updateSession: vi.fn().mockResolvedValue(undefined),
  };
});

import { generateSessionTitle } from "@/shared/api/chat";
import { useSessionAutoTitle } from "../useSessionAutoTitle";

const mockGenerateTitle = vi.mocked(generateSessionTitle);

function seedSession(
  id: string,
  overrides: Partial<{
    title: string;
    userSetName: boolean;
    draft: boolean;
    messageCount: number;
  }> = {},
) {
  const now = new Date().toISOString();
  useChatSessionStore.setState({
    sessions: [
      {
        id,
        title: overrides.title ?? "New Chat",
        createdAt: now,
        updatedAt: now,
        messageCount: overrides.messageCount ?? 0,
        draft: overrides.draft,
        userSetName: overrides.userSetName,
      },
    ],
  });
}

describe("useSessionAutoTitle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.setState({
      messagesBySession: {},
      sessionStateById: {},
      draftsBySession: {},
      activeSessionId: null,
      isConnected: false,
    });
    useChatSessionStore.setState({
      sessions: [],
      activeSessionId: null,
      isLoading: false,
      contextPanelOpenBySession: {},
    });
  });

  it("does not trigger when session has userSetName", () => {
    seedSession("s1", { userSetName: true, messageCount: 2 });
    useChatStore.getState().setChatState("s1", "idle");

    renderHook(() => useSessionAutoTitle("s1"));

    expect(mockGenerateTitle).not.toHaveBeenCalled();
  });

  it("does not trigger when messageCount is not 2", () => {
    seedSession("s1", { messageCount: 0 });
    useChatStore.getState().setChatState("s1", "idle");

    renderHook(() => useSessionAutoTitle("s1"));

    expect(mockGenerateTitle).not.toHaveBeenCalled();
  });

  it("generates title when first exchange completes", async () => {
    seedSession("s1", { messageCount: 2 });
    mockGenerateTitle.mockResolvedValue("Fix sidebar resize bug");

    // Start in streaming state
    useChatStore.getState().setChatState("s1", "streaming");

    const { rerender } = renderHook(() => useSessionAutoTitle("s1"));

    // Transition to idle (stream completed)
    useChatStore.getState().setChatState("s1", "idle");
    rerender();

    // Wait for the async call
    await vi.waitFor(() => {
      expect(mockGenerateTitle).toHaveBeenCalledWith("s1");
    });
  });

  it("uses fallback title on API failure", async () => {
    seedSession("s1", { messageCount: 2 });
    mockGenerateTitle.mockRejectedValue(new Error("LLM unavailable"));

    // Add a user message so fallback can extract text
    useChatStore.getState().addMessage("s1", {
      id: "msg-1",
      role: "user",
      created: Date.now(),
      content: [
        {
          type: "text",
          text: "Help me fix the authentication middleware in the login flow",
        },
      ],
      metadata: { userVisible: true },
    });

    useChatStore.getState().setChatState("s1", "streaming");

    const { rerender } = renderHook(() => useSessionAutoTitle("s1"));

    useChatStore.getState().setChatState("s1", "idle");
    rerender();

    // Wait for the rejection to be handled and fallback title to be set
    await vi.waitFor(() => {
      expect(mockGenerateTitle).toHaveBeenCalledWith("s1");
      // Should have updated session with fallback (first 50 chars of user message)
      const session = useChatSessionStore.getState().getSession("s1");
      expect(session?.title).toBe(
        "Help me fix the authentication middleware in the l",
      );
    });
  });
});
