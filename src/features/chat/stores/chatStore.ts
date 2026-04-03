import { create } from "zustand";
import type { Message, MessageContent } from "@/shared/types/messages";
import type {
  ChatState,
  Session,
  SessionChatRuntime,
  TokenState,
} from "@/shared/types/chat";
import {
  INITIAL_SESSION_CHAT_RUNTIME,
  INITIAL_TOKEN_STATE,
} from "@/shared/types/chat";
import type { ForkTree } from "../types/forks";

function createInitialSessionRuntime(): SessionChatRuntime {
  return {
    ...INITIAL_SESSION_CHAT_RUNTIME,
    tokenState: { ...INITIAL_TOKEN_STATE },
  };
}

interface ChatStoreState {
  // Per-session messages
  messagesBySession: Record<string, Message[]>;

  // Per-session runtime state
  sessionStateById: Record<string, SessionChatRuntime>;

  // Current session
  activeSessionId: string | null;

  // Connection
  isConnected: boolean;

  // Fork trees indexed by root session ID
  forkTreeByRoot: Record<string, ForkTree>;
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

  // Cleanup
  cleanupSession: (sessionId: string) => void;

  // Forking
  addFork: (
    rootSessionId: string,
    forkPointMessageId: string,
    sourceSessionId: string,
    newSessionId: string,
  ) => void;
  setActiveBranch: (
    rootSessionId: string,
    forkPointMessageId: string,
    branchIndex: number,
  ) => void;
  getForkTree: (rootSessionId: string) => ForkTree;
  buildForkTreeFromSessions: (
    rootSessionId: string,
    allSessions: Session[],
  ) => void;
  computeDisplayMessages: (rootSessionId: string) => Message[];
  computeLeafSessionId: (rootSessionId: string) => string;
}

export type ChatStore = ChatStoreState & ChatStoreActions;

export const useChatStore = create<ChatStore>((set, get) => ({
  // State
  messagesBySession: {},
  sessionStateById: {},
  activeSessionId: null,
  isConnected: false,
  forkTreeByRoot: {},

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

  // Cleanup
  cleanupSession: (sessionId) =>
    set((state) => {
      const { [sessionId]: _, ...rest } = state.messagesBySession;
      const { [sessionId]: __, ...remainingSessionState } =
        state.sessionStateById;
      const { [sessionId]: ___, ...remainingForkTrees } = state.forkTreeByRoot;
      return {
        messagesBySession: rest,
        sessionStateById: remainingSessionState,
        forkTreeByRoot: remainingForkTrees,
        activeSessionId:
          state.activeSessionId === sessionId ? null : state.activeSessionId,
      };
    }),

  // Forking
  addFork: (rootSessionId, forkPointMessageId, sourceSessionId, newSessionId) =>
    set((state) => {
      const tree = { ...(state.forkTreeByRoot[rootSessionId] ?? {}) };
      const existing = tree[forkPointMessageId];
      if (existing) {
        tree[forkPointMessageId] = {
          ...existing,
          branches: [...existing.branches, { sessionId: newSessionId }],
          activeBranchIndex: existing.branches.length,
        };
      } else {
        tree[forkPointMessageId] = {
          sourceSessionId,
          branches: [
            { sessionId: sourceSessionId },
            { sessionId: newSessionId },
          ],
          activeBranchIndex: 1,
        };
      }
      return {
        forkTreeByRoot: { ...state.forkTreeByRoot, [rootSessionId]: tree },
      };
    }),

  setActiveBranch: (rootSessionId, forkPointMessageId, branchIndex) =>
    set((state) => {
      const tree = state.forkTreeByRoot[rootSessionId];
      if (!tree?.[forkPointMessageId]) return state;
      return {
        forkTreeByRoot: {
          ...state.forkTreeByRoot,
          [rootSessionId]: {
            ...tree,
            [forkPointMessageId]: {
              ...tree[forkPointMessageId],
              activeBranchIndex: branchIndex,
            },
          },
        },
      };
    }),

  getForkTree: (rootSessionId) =>
    get().forkTreeByRoot[rootSessionId] ?? {},

  buildForkTreeFromSessions: (rootSessionId, allSessions) => {
    // Collect all session IDs belonging to this tree
    const treeSessionIds = new Set<string>([rootSessionId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const s of allSessions) {
        if (s.forkedFrom && treeSessionIds.has(s.forkedFrom) && !treeSessionIds.has(s.id)) {
          treeSessionIds.add(s.id);
          changed = true;
        }
      }
    }

    // Build fork tree entries from forked sessions
    const tree: ForkTree = {};
    for (const s of allSessions) {
      if (!s.forkedFrom || !s.forkPointMessageId || !treeSessionIds.has(s.id)) continue;
      const key = s.forkPointMessageId;
      const existing = tree[key];
      if (existing) {
        if (!existing.branches.some((b) => b.sessionId === s.id)) {
          existing.branches.push({ sessionId: s.id });
          existing.activeBranchIndex = existing.branches.length - 1;
        }
      } else {
        tree[key] = {
          sourceSessionId: s.forkedFrom,
          branches: [
            { sessionId: s.forkedFrom },
            { sessionId: s.id },
          ],
          activeBranchIndex: 1,
        };
      }
    }

    if (Object.keys(tree).length > 0) {
      set((state) => ({
        forkTreeByRoot: { ...state.forkTreeByRoot, [rootSessionId]: tree },
      }));
    }
  },

  computeDisplayMessages: (rootSessionId) => {
    const state = get();
    const tree = state.forkTreeByRoot[rootSessionId] ?? {};
    const rootMessages = state.messagesBySession[rootSessionId] ?? [];

    if (Object.keys(tree).length === 0) {
      return rootMessages;
    }

    const result: Message[] = [];
    let currentMessages = rootMessages;
    let i = 0;

    while (i < currentMessages.length) {
      const msg = currentMessages[i];
      result.push(msg);

      // Check if this user message is a fork point
      if (msg.role === "user" && tree[msg.id]) {
        const branch = tree[msg.id];
        const activeBranch = branch.branches[branch.activeBranchIndex];
        if (activeBranch && activeBranch.sessionId !== rootSessionId) {
          const branchMessages = state.messagesBySession[activeBranch.sessionId] ?? [];
          // Find the fork point in the branch messages
          const forkIdx = branchMessages.findIndex((m) => m.id === msg.id);
          if (forkIdx !== -1) {
            currentMessages = branchMessages;
            i = forkIdx + 1;
            continue;
          }
        }
      }

      i++;
    }

    return result;
  },

  computeLeafSessionId: (rootSessionId) => {
    const state = get();
    const tree = state.forkTreeByRoot[rootSessionId] ?? {};

    if (Object.keys(tree).length === 0) {
      return rootSessionId;
    }

    let currentSessionId = rootSessionId;
    let currentMessages = state.messagesBySession[rootSessionId] ?? [];
    let i = 0;

    while (i < currentMessages.length) {
      const msg = currentMessages[i];

      if (msg.role === "user" && tree[msg.id]) {
        const branch = tree[msg.id];
        const activeBranch = branch.branches[branch.activeBranchIndex];
        if (activeBranch && activeBranch.sessionId !== currentSessionId) {
          const branchMessages = state.messagesBySession[activeBranch.sessionId] ?? [];
          const forkIdx = branchMessages.findIndex((m) => m.id === msg.id);
          if (forkIdx !== -1) {
            currentSessionId = activeBranch.sessionId;
            currentMessages = branchMessages;
            i = forkIdx + 1;
            continue;
          }
        }
      }

      i++;
    }

    return currentSessionId;
  },
}));
