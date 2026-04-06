import { create } from "zustand";
import type { Message, MessageContent } from "@/shared/types/messages";
import type {
  ChatState,
  SessionChatRuntime,
  TokenState,
} from "@/shared/types/chat";
import {
  INITIAL_SESSION_CHAT_RUNTIME,
  INITIAL_TOKEN_STATE,
} from "@/shared/types/chat";

function createInitialSessionRuntime(): SessionChatRuntime {
  return {
    ...INITIAL_SESSION_CHAT_RUNTIME,
    tokenState: { ...INITIAL_TOKEN_STATE },
  };
}

const DRAFTS_STORAGE_KEY = "goose:chat-drafts";

function loadCachedDrafts(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.localStorage.getItem(DRAFTS_STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function persistDrafts(drafts: Record<string, string>): void {
  if (typeof window === "undefined") return;
  try {
    const nonEmpty = Object.fromEntries(
      Object.entries(drafts).filter(([, v]) => v.length > 0),
    );
    if (Object.keys(nonEmpty).length === 0) {
      window.localStorage.removeItem(DRAFTS_STORAGE_KEY);
    } else {
      window.localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(nonEmpty));
    }
  } catch {
    // localStorage may be unavailable
  }
}

interface ChatStoreState {
  // Per-session messages
  messagesBySession: Record<string, Message[]>;

  // Per-session runtime state
  sessionStateById: Record<string, SessionChatRuntime>;

  // Per-session draft input text
  draftsBySession: Record<string, string>;

  // Current session
  activeSessionId: string | null;

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
  getSessionRuntime: (sessionId: string) => SessionChatRuntime;

  // Streaming
  setStreamingMessageId: (sessionId: string, id: string | null) => void;
  appendToStreamingMessage: (
    sessionId: string,
    content: MessageContent,
  ) => void;
  updateStreamingText: (sessionId: string, text: string) => void;

  // State
  setChatState: (sessionId: string, state: ChatState) => void;
  setError: (sessionId: string, error: string | null) => void;
  setConnected: (connected: boolean) => void;
  markSessionRead: (sessionId: string) => void;
  markSessionUnread: (sessionId: string) => void;

  // Token tracking
  updateTokenState: (sessionId: string, state: Partial<TokenState>) => void;
  resetTokenState: (sessionId: string) => void;

  // Drafts
  setDraft: (sessionId: string, text: string) => void;
  getDraft: (sessionId: string) => string;
  clearDraft: (sessionId: string) => void;

  // Cleanup
  cleanupSession: (sessionId: string) => void;
}

export type ChatStore = ChatStoreState & ChatStoreActions;

export const useChatStore = create<ChatStore>((set, get) => ({
  // State
  messagesBySession: {},
  sessionStateById: {},
  draftsBySession: loadCachedDrafts(),
  activeSessionId: null,
  isConnected: false,

  // Session management
  setActiveSession: (sessionId) =>
    set((state) => ({
      activeSessionId: sessionId,
      sessionStateById: state.sessionStateById[sessionId]
        ? state.sessionStateById
        : {
            ...state.sessionStateById,
            [sessionId]: createInitialSessionRuntime(),
          },
    })),

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
      sessionStateById: {
        ...state.sessionStateById,
        [sessionId]: createInitialSessionRuntime(),
      },
    })),

  // Active session helpers
  getActiveMessages: () => {
    const { activeSessionId, messagesBySession } = get();
    if (!activeSessionId) return [];
    const messages = messagesBySession[activeSessionId] ?? [];
    return messages.filter((m) => m.metadata?.userVisible);
  },

  getSessionRuntime: (sessionId) =>
    get().sessionStateById[sessionId] ?? createInitialSessionRuntime(),

  // Streaming
  setStreamingMessageId: (sessionId, id) =>
    set((state) => ({
      sessionStateById: {
        ...state.sessionStateById,
        [sessionId]: {
          ...(state.sessionStateById[sessionId] ??
            createInitialSessionRuntime()),
          streamingMessageId: id,
        },
      },
    })),

  appendToStreamingMessage: (sessionId, content) =>
    set((state) => {
      const streamingMessageId =
        state.sessionStateById[sessionId]?.streamingMessageId ?? null;
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
      const streamingMessageId =
        state.sessionStateById[sessionId]?.streamingMessageId ?? null;
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
  setChatState: (sessionId, chatState) =>
    set((state) => ({
      sessionStateById: {
        ...state.sessionStateById,
        [sessionId]: {
          ...(state.sessionStateById[sessionId] ??
            createInitialSessionRuntime()),
          chatState,
        },
      },
    })),

  setError: (sessionId, error) =>
    set((state) => {
      const current =
        state.sessionStateById[sessionId] ?? createInitialSessionRuntime();
      return {
        sessionStateById: {
          ...state.sessionStateById,
          [sessionId]: {
            ...current,
            error,
            chatState: error ? ("error" as const) : current.chatState,
          },
        },
      };
    }),

  setConnected: (isConnected) => set({ isConnected }),

  markSessionRead: (sessionId) =>
    set((state) => {
      const current =
        state.sessionStateById[sessionId] ?? createInitialSessionRuntime();
      if (!current.hasUnread) {
        return state;
      }
      return {
        sessionStateById: {
          ...state.sessionStateById,
          [sessionId]: {
            ...current,
            hasUnread: false,
          },
        },
      };
    }),

  markSessionUnread: (sessionId) =>
    set((state) => {
      const current =
        state.sessionStateById[sessionId] ?? createInitialSessionRuntime();
      if (current.hasUnread) {
        return state;
      }
      return {
        sessionStateById: {
          ...state.sessionStateById,
          [sessionId]: {
            ...current,
            hasUnread: true,
          },
        },
      };
    }),

  // Token tracking
  updateTokenState: (sessionId, partial) =>
    set((state) => {
      const current =
        state.sessionStateById[sessionId]?.tokenState ?? INITIAL_TOKEN_STATE;
      const inputTokens = partial.inputTokens ?? current.inputTokens;
      const outputTokens = partial.outputTokens ?? current.outputTokens;
      const accumulatedInput =
        partial.accumulatedInput ??
        current.accumulatedInput + (partial.inputTokens ?? 0);
      const accumulatedOutput =
        partial.accumulatedOutput ??
        current.accumulatedOutput + (partial.outputTokens ?? 0);
      const accumulatedTotal =
        partial.accumulatedTotal ?? accumulatedInput + accumulatedOutput;
      return {
        sessionStateById: {
          ...state.sessionStateById,
          [sessionId]: {
            ...(state.sessionStateById[sessionId] ??
              createInitialSessionRuntime()),
            tokenState: {
              inputTokens,
              outputTokens,
              totalTokens: inputTokens + outputTokens,
              accumulatedInput,
              accumulatedOutput,
              accumulatedTotal,
              contextLimit: partial.contextLimit ?? current.contextLimit,
            },
          },
        },
      };
    }),

  resetTokenState: (sessionId) =>
    set((state) => ({
      sessionStateById: {
        ...state.sessionStateById,
        [sessionId]: {
          ...(state.sessionStateById[sessionId] ??
            createInitialSessionRuntime()),
          tokenState: { ...INITIAL_TOKEN_STATE },
        },
      },
    })),

  // Drafts
  setDraft: (sessionId, text) => {
    set((state) => ({
      draftsBySession: { ...state.draftsBySession, [sessionId]: text },
    }));
    persistDrafts(get().draftsBySession);
  },

  getDraft: (sessionId) => get().draftsBySession[sessionId] ?? "",

  clearDraft: (sessionId) => {
    set((state) => {
      const { [sessionId]: _, ...rest } = state.draftsBySession;
      return { draftsBySession: rest };
    });
    persistDrafts(get().draftsBySession);
  },

  // Cleanup
  cleanupSession: (sessionId) =>
    set((state) => {
      const { [sessionId]: _, ...rest } = state.messagesBySession;
      const { [sessionId]: __, ...remainingSessionState } =
        state.sessionStateById;
      const { [sessionId]: ___, ...remainingDrafts } = state.draftsBySession;
      persistDrafts(remainingDrafts);
      return {
        messagesBySession: rest,
        sessionStateById: remainingSessionState,
        draftsBySession: remainingDrafts,
        activeSessionId:
          state.activeSessionId === sessionId ? null : state.activeSessionId,
      };
    }),
}));
