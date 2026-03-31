import { create } from "zustand";
import type { Message, MessageContent } from "@/shared/types/messages";
import type { ChatState, TokenState } from "@/shared/types/chat";
import { INITIAL_TOKEN_STATE } from "@/shared/types/chat";

interface ChatStoreState {
  // Per-session messages
  messagesBySession: Record<string, Message[]>;

  // Current session
  activeSessionId: string | null;

  // Chat state
  chatState: ChatState;

  // Streaming
  streamingMessageId: string | null;

  // Token usage
  tokenState: TokenState;

  // Error
  error: string | null;

  // Connection
  isConnected: boolean;
}

interface ChatStoreActions {
  // Session management
  setActiveSession: (sessionId: string) => void;

  // Message management
  addMessage: (sessionId: string, message: Message) => void;
  updateMessage: (
    sessionId: string,
    messageId: string,
    updater: (msg: Message) => Message,
  ) => void;
  removeMessage: (sessionId: string, messageId: string) => void;
  setMessages: (sessionId: string, messages: Message[]) => void;
  clearMessages: (sessionId: string) => void;

  // Active session helpers (operate on activeSessionId)
  getActiveMessages: () => Message[];

  // Streaming
  setStreamingMessageId: (id: string | null) => void;
  appendToStreamingMessage: (
    sessionId: string,
    content: MessageContent,
  ) => void;
  updateStreamingText: (sessionId: string, text: string) => void;

  // State
  setChatState: (state: ChatState) => void;
  setError: (error: string | null) => void;
  setConnected: (connected: boolean) => void;

  // Token tracking
  updateTokenState: (state: Partial<TokenState>) => void;
  resetTokenState: () => void;

  // Cleanup
  cleanupSession: (sessionId: string) => void;
}

export type ChatStore = ChatStoreState & ChatStoreActions;

export const useChatStore = create<ChatStore>((set, get) => ({
  // State
  messagesBySession: {},
  activeSessionId: null,
  chatState: "idle",
  streamingMessageId: null,
  tokenState: { ...INITIAL_TOKEN_STATE },
  error: null,
  isConnected: false,

  // Session management
  setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),

  // Message management
  addMessage: (sessionId, message) =>
    set((state) => ({
      messagesBySession: {
        ...state.messagesBySession,
        [sessionId]: [...(state.messagesBySession[sessionId] ?? []), message],
      },
    })),

  updateMessage: (sessionId, messageId, updater) =>
    set((state) => {
      const messages = state.messagesBySession[sessionId];
      if (!messages) return state;
      return {
        messagesBySession: {
          ...state.messagesBySession,
          [sessionId]: messages.map((m) =>
            m.id === messageId ? updater(m) : m,
          ),
        },
      };
    }),

  removeMessage: (sessionId, messageId) =>
    set((state) => {
      const messages = state.messagesBySession[sessionId];
      if (!messages) return state;
      return {
        messagesBySession: {
          ...state.messagesBySession,
          [sessionId]: messages.filter((m) => m.id !== messageId),
        },
      };
    }),

  setMessages: (sessionId, messages) =>
    set((state) => ({
      messagesBySession: {
        ...state.messagesBySession,
        [sessionId]: messages,
      },
    })),

  clearMessages: (sessionId) =>
    set((state) => ({
      messagesBySession: {
        ...state.messagesBySession,
        [sessionId]: [],
      },
      tokenState: { ...INITIAL_TOKEN_STATE },
    })),

  // Active session helpers
  getActiveMessages: () => {
    const { activeSessionId, messagesBySession } = get();
    if (!activeSessionId) return [];
    const messages = messagesBySession[activeSessionId] ?? [];
    return messages.filter((m) => m.metadata?.userVisible);
  },

  // Streaming
  setStreamingMessageId: (id) => set({ streamingMessageId: id }),

  appendToStreamingMessage: (sessionId, content) =>
    set((state) => {
      const { streamingMessageId } = state;
      if (!streamingMessageId) return state;
      const messages = state.messagesBySession[sessionId];
      if (!messages) return state;
      return {
        messagesBySession: {
          ...state.messagesBySession,
          [sessionId]: messages.map((m) =>
            m.id === streamingMessageId
              ? { ...m, content: [...m.content, content] }
              : m,
          ),
        },
      };
    }),

  updateStreamingText: (sessionId, text) =>
    set((state) => {
      const { streamingMessageId } = state;
      if (!streamingMessageId) return state;
      const messages = state.messagesBySession[sessionId];
      if (!messages) return state;
      return {
        messagesBySession: {
          ...state.messagesBySession,
          [sessionId]: messages.map((m) => {
            if (m.id !== streamingMessageId) return m;
            const lastContent = m.content[m.content.length - 1];
            if (lastContent?.type !== "text") {
              // Start a new text segment after non-text content so
              // streamed tool calls stay inline between text blocks.
              return {
                ...m,
                content: [...m.content, { type: "text" as const, text }],
              };
            }
            const newContent = [...m.content];
            newContent[newContent.length - 1] = {
              type: "text" as const,
              text: lastContent.text + text,
            };
            return { ...m, content: newContent };
          }),
        },
      };
    }),

  // State
  setChatState: (chatState) => set({ chatState }),

  setError: (error) =>
    set({ error, chatState: error ? ("error" as const) : get().chatState }),

  setConnected: (isConnected) => set({ isConnected }),

  // Token tracking
  updateTokenState: (partial) =>
    set((state) => {
      const current = state.tokenState;
      const inputTokens = partial.inputTokens ?? current.inputTokens;
      const outputTokens = partial.outputTokens ?? current.outputTokens;
      return {
        tokenState: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          accumulatedInput:
            partial.accumulatedInput ??
            current.accumulatedInput + (partial.inputTokens ?? 0),
          accumulatedOutput:
            partial.accumulatedOutput ??
            current.accumulatedOutput + (partial.outputTokens ?? 0),
          accumulatedTotal:
            (partial.accumulatedInput ??
              current.accumulatedInput + (partial.inputTokens ?? 0)) +
            (partial.accumulatedOutput ??
              current.accumulatedOutput + (partial.outputTokens ?? 0)),
        },
      };
    }),

  resetTokenState: () => set({ tokenState: { ...INITIAL_TOKEN_STATE } }),

  // Cleanup
  cleanupSession: (sessionId) =>
    set((state) => {
      const { [sessionId]: _, ...rest } = state.messagesBySession;
      return {
        messagesBySession: rest,
        activeSessionId:
          state.activeSessionId === sessionId ? null : state.activeSessionId,
        streamingMessageId:
          state.activeSessionId === sessionId ? null : state.streamingMessageId,
      };
    }),
}));
