import { create } from "zustand";
import {
  createSession as apiCreateSession,
  listSessions as apiListSessions,
  archiveSession as apiArchiveSession,
  unarchiveSession as apiUnarchiveSession,
  updateSession as apiUpdateSession,
} from "@/shared/api/chat";
import type { ProviderModelState, Session } from "@/shared/types/chat";

const SESSION_CACHE_STORAGE_KEY = "goose:chat-sessions";

// Extended session metadata used by the frontend session list
export interface ChatSession {
  id: string; // === sessionId
  title: string;
  projectId?: string | null;
  agentId?: string;
  providerId?: string;
  personaId?: string;
  currentModelId?: string;
  modelName?: string;
  createdAt: string; // ISO timestamp
  updatedAt: string;
  archivedAt?: string;
  messageCount: number;
}

interface ChatSessionStoreState {
  sessions: ChatSession[];
  modelStateByProvider: Record<string, ProviderModelState>;
  activeSessionId: string | null;
  isLoading: boolean;
}

interface ChatSessionStoreActions {
  // Session lifecycle
  createSession: (opts?: {
    title?: string;
    projectId?: string;
    agentId?: string;
    providerId?: string;
    personaId?: string;
  }) => Promise<ChatSession>;
  loadSessions: () => Promise<void>;
  updateSession: (id: string, patch: Partial<ChatSession>) => void;
  setModelState: (
    sessionId: string,
    modelState: {
      providerId?: string;
      source: ProviderModelState["source"];
      configId?: string;
      currentModelId: string;
      currentModelName?: string;
      availableModels: ProviderModelState["availableModels"];
    },
  ) => void;
  archiveSession: (id: string) => Promise<void>;
  unarchiveSession: (id: string) => Promise<void>;

  setActiveSession: (sessionId: string | null) => void;

  // Helpers
  getSession: (id: string) => ChatSession | undefined;
  getActiveSession: () => ChatSession | null;
}

export type ChatSessionStore = ChatSessionStoreState & ChatSessionStoreActions;

function loadCachedSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(SESSION_CACHE_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as ChatSession[]) : [];
  } catch {
    return [];
  }
}

function persistSessions(sessions: ChatSession[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      SESSION_CACHE_STORAGE_KEY,
      JSON.stringify(sessions),
    );
  } catch {
    // localStorage may be unavailable
  }
}

function sessionToChatSession(session: Session): ChatSession {
  return {
    id: session.id,
    title: session.title,
    agentId: session.agentId,
    projectId: session.projectId,
    providerId: session.providerId,
    personaId: session.personaId,
    currentModelId: session.currentModelId,
    modelName: session.modelName,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    archivedAt: session.archivedAt,
    messageCount: session.messageCount,
  };
}

export const useChatSessionStore = create<ChatSessionStore>((set, get) => ({
  // State
  sessions: loadCachedSessions(),
  modelStateByProvider: {},
  activeSessionId: null,
  isLoading: false,

  // Session lifecycle
  createSession: async (opts) => {
    const backendSession = await apiCreateSession(
      opts?.agentId,
      opts?.projectId,
    );
    const now = new Date().toISOString();
    const chatSession: ChatSession = {
      id: backendSession.id,
      title: opts?.title ?? backendSession.title,
      projectId: opts?.projectId,
      agentId: opts?.agentId ?? backendSession.agentId,
      providerId: opts?.providerId,
      personaId: opts?.personaId,
      createdAt: backendSession.createdAt ?? now,
      updatedAt: backendSession.updatedAt ?? now,
      messageCount: backendSession.messageCount ?? 0,
    };
    // Persist initial metadata (title, persona, provider) to backend
    const initialUpdate: Record<string, string> = {};
    if (opts?.title) initialUpdate.title = opts.title;
    if (opts?.providerId) initialUpdate.providerId = opts.providerId;
    if (opts?.personaId) initialUpdate.personaId = opts.personaId;
    if (Object.keys(initialUpdate).length > 0) {
      apiUpdateSession(backendSession.id, initialUpdate).catch((err) => {
        console.error("Failed to persist initial session metadata:", err);
      });
    }
    set((state) => ({
      sessions: [...state.sessions, chatSession],
    }));
    persistSessions([...get().sessions]);
    return chatSession;
  },

  loadSessions: async () => {
    set({ isLoading: true });
    try {
      const backendSessions = await apiListSessions();
      const chatSessions = backendSessions.map(sessionToChatSession);
      set({ sessions: chatSessions });
      persistSessions(chatSessions);
    } finally {
      set({ isLoading: false });
    }
  },

  updateSession: (id, patch) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id
          ? { ...s, ...patch, updatedAt: new Date().toISOString() }
          : s,
      ),
    }));
    persistSessions(get().sessions);
    const backendPatch: {
      title?: string;
      providerId?: string;
      personaId?: string;
      modelName?: string;
      projectId?: string | null;
    } = {};
    if (patch.title) backendPatch.title = patch.title;
    if (patch.providerId) backendPatch.providerId = patch.providerId;
    if (patch.personaId) backendPatch.personaId = patch.personaId;
    if (patch.modelName) backendPatch.modelName = patch.modelName;
    if ("projectId" in patch) {
      backendPatch.projectId = patch.projectId ?? null;
    }
    if (Object.keys(backendPatch).length > 0) {
      apiUpdateSession(id, backendPatch).catch((err) => {
        console.error("Failed to persist session update:", err);
      });
    }
  },

  setModelState: (sessionId, modelState) => {
    const session = get().getSession(sessionId);
    const providerId = modelState.providerId ?? session?.providerId;

    // If the user has explicitly selected a model (session.currentModelId is set
    // and differs from what the provider reports), preserve their choice.
    // Only set the session's model when it hasn't been explicitly chosen yet.
    const userHasExplicitSelection =
      session?.currentModelId &&
      session.currentModelId !== modelState.currentModelId;

    set((state) => ({
      sessions: state.sessions.map((candidate) =>
        candidate.id === sessionId
          ? {
              ...candidate,
              ...(userHasExplicitSelection
                ? {}
                : {
                    currentModelId: modelState.currentModelId,
                    modelName:
                      modelState.currentModelName ?? modelState.currentModelId,
                  }),
              updatedAt: new Date().toISOString(),
            }
          : candidate,
      ),
      modelStateByProvider: providerId
        ? {
            ...state.modelStateByProvider,
            [providerId]: {
              source: modelState.source,
              configId: modelState.configId,
              currentModelId: modelState.currentModelId,
              currentModelName: modelState.currentModelName,
              availableModels: modelState.availableModels,
            },
          }
        : state.modelStateByProvider,
    }));

    persistSessions(get().sessions);
  },

  archiveSession: async (id) => {
    const previousActiveSessionId = get().activeSessionId;
    set((state) => {
      return {
        activeSessionId:
          state.activeSessionId === id ? null : state.activeSessionId,
      };
    });

    // Archive on backend — update local state on success
    try {
      await apiArchiveSession(id);
      const archivedAt = new Date().toISOString();
      const nextSessions = get()
        .sessions.map((s) => (s.id === id ? { ...s, archivedAt } : s))
        .filter((s) => !s.archivedAt);
      set({ sessions: nextSessions });
      persistSessions(nextSessions);
    } catch (err) {
      set({
        activeSessionId: previousActiveSessionId,
      });
      console.error("Failed to archive session:", err);
      throw err;
    }
  },

  unarchiveSession: async (id) => {
    try {
      await apiUnarchiveSession(id);
      await get().loadSessions();
    } catch (err) {
      console.error("Failed to unarchive session:", err);
      throw err;
    }
  },

  setActiveSession: (sessionId) => {
    if (get().activeSessionId === sessionId) return;
    set({ activeSessionId: sessionId });
  },

  // Helpers
  getSession: (id) => get().sessions.find((s) => s.id === id),

  getActiveSession: () => {
    const { activeSessionId, sessions } = get();
    if (!activeSessionId) return null;
    return sessions.find((s) => s.id === activeSessionId) ?? null;
  },
}));
