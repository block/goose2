import { create } from "zustand";
import type { Message, ChatState, TokenState } from "@/types";

interface ChatStore {
  messagesBySession: Record<string, Message[]>;
  chatState: ChatState;
  streamingMessageId: string | null;
  tokenUsage: TokenState;
  error: string | null;

  setMessages: (sessionId: string, messages: Message[]) => void;
  addMessage: (sessionId: string, message: Message) => void;
  updateMessage: (
    sessionId: string,
    messageId: string,
    updates: Partial<Message>,
  ) => void;
  clearMessages: (sessionId: string) => void;
  setChatState: (state: ChatState) => void;
  setStreamingMessageId: (id: string | null) => void;
  setTokenUsage: (usage: TokenState) => void;
  setError: (error: string | null) => void;
  getMessages: (sessionId: string) => Message[];
}

export const useChatStore = create<ChatStore>()((set, get) => ({
  messagesBySession: {},
  chatState: "idle",
  streamingMessageId: null,
  tokenUsage: { input: 0, output: 0, accumulated: { input: 0, output: 0 } },
  error: null,

  setMessages: (sessionId, messages) =>
    set((state) => ({
      messagesBySession: { ...state.messagesBySession, [sessionId]: messages },
    })),

  addMessage: (sessionId, message) =>
    set((state) => ({
      messagesBySession: {
        ...state.messagesBySession,
        [sessionId]: [...(state.messagesBySession[sessionId] ?? []), message],
      },
    })),

  updateMessage: (sessionId, messageId, updates) =>
    set((state) => ({
      messagesBySession: {
        ...state.messagesBySession,
        [sessionId]: (state.messagesBySession[sessionId] ?? []).map((m) =>
          m.id === messageId ? { ...m, ...updates } : m,
        ),
      },
    })),

  clearMessages: (sessionId) =>
    set((state) => ({
      messagesBySession: { ...state.messagesBySession, [sessionId]: [] },
    })),

  setChatState: (chatState) => set({ chatState }),
  setStreamingMessageId: (id) => set({ streamingMessageId: id }),
  setTokenUsage: (usage) => set({ tokenUsage: usage }),
  setError: (error) => set({ error }),
  getMessages: (sessionId) => get().messagesBySession[sessionId] ?? [],
}));
