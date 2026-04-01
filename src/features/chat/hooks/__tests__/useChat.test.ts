import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAgentStore } from "@/features/agents/stores/agentStore";
import { useChatStore } from "../../stores/chatStore";
import { INITIAL_TOKEN_STATE } from "@/shared/types/chat";

const mockAcpSendMessage = vi.fn();
const mockAcpCancelSession = vi.fn();

vi.mock("@/shared/api/acp", () => ({
  acpSendMessage: (...args: unknown[]) => mockAcpSendMessage(...args),
  acpCancelSession: (...args: unknown[]) => mockAcpCancelSession(...args),
}));

import { useChat } from "../useChat";

function createDeferredPromise() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("useChat", () => {
  const sessionId = "session-1";

  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.setState({
      messagesBySession: {},
      activeSessionId: null,
      chatState: "idle",
      streamingMessageId: null,
      tokenState: { ...INITIAL_TOKEN_STATE },
      error: null,
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
      useChat(sessionId, undefined, undefined, {
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
      sessionId,
      "goose",
      "Hello",
      {
        systemPrompt: undefined,
        workingDir: undefined,
        personaId: "persona-b",
        personaName: "Persona B",
      },
    );
    expect(mockAcpCancelSession).toHaveBeenCalledWith(sessionId, "persona-b");

    deferred.resolve();
    await act(async () => {
      await sendPromise;
    });
  });
});
