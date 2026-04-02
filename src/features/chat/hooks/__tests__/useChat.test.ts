import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAgentStore } from "@/features/agents/stores/agentStore";
import { useChatStore } from "../../stores/chatStore";
import type { Message } from "@/shared/types/messages";

const mockAcpSendMessage = vi.fn();
const mockAcpCancelSession = vi.fn();

vi.mock("@/shared/api/acp", () => ({
  acpSendMessage: (...args: unknown[]) => mockAcpSendMessage(...args),
  acpCancelSession: (...args: unknown[]) => mockAcpCancelSession(...args),
}));

import { useChat } from "../useChat";

function addStreamingAssistantMessage(
  sessionId: string,
  messageId: string,
  personaId: string,
  personaName: string,
) {
  const message: Message = {
    id: messageId,
    role: "assistant",
    created: Date.now(),
    content: [],
    metadata: {
      userVisible: true,
      agentVisible: true,
      personaId,
      personaName,
      completionStatus: "inProgress",
    },
  };

  useChatStore.getState().addMessage(sessionId, message);
  useChatStore.getState().setStreamingMessageId(sessionId, messageId);
}

function createDeferredPromise() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("useChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.setState({
      messagesBySession: {},
      sessionStateById: {},
      activeSessionId: null,
      isConnected: true,
    });
    useAgentStore.setState({
      personas: [
        {
          id: "persona-a",
          displayName: "Persona A",
          systemPrompt: "",
          isBuiltin: false,
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "persona-b",
          displayName: "Persona B",
          systemPrompt: "",
          isBuiltin: false,
          createdAt: "",
          updatedAt: "",
        },
      ],
      personasLoading: false,
      agents: [],
      agentsLoading: false,
      activeAgentId: null,
      isLoading: false,
      personaEditorOpen: false,
      editingPersona: null,
    });
    mockAcpCancelSession.mockResolvedValue(true);
  });

  it("cancels the active override persona instead of the hook default persona", async () => {
    const deferred = createDeferredPromise();
    mockAcpSendMessage.mockReturnValue(deferred.promise);

    const { result } = renderHook(() =>
      useChat("session-1", undefined, undefined, {
        id: "persona-a",
        name: "Persona A",
      }),
    );

    let sendPromise!: Promise<void>;
    await act(async () => {
      sendPromise = result.current.sendMessage("Hello", {
        id: "persona-b",
        name: "Persona B",
      });
      await Promise.resolve();
    });

    act(() => {
      result.current.stopGeneration();
    });

    expect(mockAcpSendMessage).toHaveBeenCalledWith(
      "session-1",
      "goose",
      "Hello",
      {
        systemPrompt: undefined,
        workingDir: undefined,
        personaId: "persona-b",
        personaName: "Persona B",
      },
    );
    expect(mockAcpCancelSession).toHaveBeenCalledWith("session-1", "persona-b");

    deferred.resolve();
    await act(async () => {
      await sendPromise;
    });
  });

  it("keeps persona-aware cancellation working after remount", async () => {
    const deferred = createDeferredPromise();
    mockAcpSendMessage.mockReturnValue(deferred.promise);

    const firstMount = renderHook(() =>
      useChat("session-1", undefined, undefined, {
        id: "persona-a",
        name: "Persona A",
      }),
    );

    let sendPromise!: Promise<void>;
    await act(async () => {
      sendPromise = firstMount.result.current.sendMessage("Hello", {
        id: "persona-b",
        name: "Persona B",
      });
      await Promise.resolve();
    });
    act(() => {
      addStreamingAssistantMessage(
        "session-1",
        "assistant-1",
        "persona-b",
        "Persona B",
      );
    });

    act(() => {
      firstMount.unmount();
    });

    const secondMount = renderHook(() =>
      useChat("session-1", undefined, undefined, {
        id: "persona-a",
        name: "Persona A",
      }),
    );

    act(() => {
      secondMount.result.current.stopGeneration();
    });

    expect(mockAcpCancelSession).toHaveBeenCalledWith("session-1", "persona-b");

    deferred.resolve();
    await act(async () => {
      await sendPromise;
    });
  });

  it("allows another session to send while a different session is streaming", async () => {
    const deferred = createDeferredPromise();
    mockAcpSendMessage
      .mockReturnValueOnce(deferred.promise)
      .mockResolvedValueOnce(undefined);

    const firstSession = renderHook(() => useChat("session-1"));
    const secondSession = renderHook(() => useChat("session-2"));

    let firstPromise!: Promise<void>;
    await act(async () => {
      firstPromise = firstSession.result.current.sendMessage("First");
      await Promise.resolve();
    });

    await act(async () => {
      await secondSession.result.current.sendMessage("Second");
    });

    expect(mockAcpSendMessage).toHaveBeenNthCalledWith(
      1,
      "session-1",
      "goose",
      "First",
      {
        systemPrompt: undefined,
        workingDir: undefined,
        personaId: undefined,
        personaName: undefined,
      },
    );
    expect(mockAcpSendMessage).toHaveBeenNthCalledWith(
      2,
      "session-2",
      "goose",
      "Second",
      {
        systemPrompt: undefined,
        workingDir: undefined,
        personaId: undefined,
        personaName: undefined,
      },
    );

    deferred.resolve();
    await act(async () => {
      await firstPromise;
    });
  });

  it("appends an error message and removes the empty assistant placeholder when send fails", async () => {
    mockAcpSendMessage.mockRejectedValue(
      new Error("Working directory missing"),
    );

    const { result } = renderHook(() => useChat("session-1"));

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    const messages = useChatStore.getState().messagesBySession["session-1"];
    const runtime = useChatStore.getState().getSessionRuntime("session-1");

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
    expect(messages[1].role).toBe("system");
    expect(messages[1].content).toEqual([
      {
        type: "systemNotification",
        notificationType: "error",
        text: "Working directory missing",
      },
    ]);
    expect(runtime.error).toBe("Working directory missing");
    expect(runtime.streamingMessageId).toBeNull();
    expect(runtime.chatState).toBe("idle");
  });

  it("shows string-shaped invoke errors instead of falling back to unknown error", async () => {
    mockAcpSendMessage.mockRejectedValue("Working directory missing");

    const { result } = renderHook(() => useChat("session-1"));

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    const messages = useChatStore.getState().messagesBySession["session-1"];
    expect(messages[1].content).toEqual([
      {
        type: "systemNotification",
        notificationType: "error",
        text: "Working directory missing",
      },
    ]);
  });
});
