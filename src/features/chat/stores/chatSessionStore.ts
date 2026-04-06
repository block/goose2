import { create } from "zustand";
import {
  createSession as apiCreateSession,
  listSessions as apiListSessions,
  archiveSession as apiArchiveSession,
  unarchiveSession as apiUnarchiveSession,
  updateSession as apiUpdateSession,
} from "@/shared/api/chat";
import type { Session } from "@/shared/types/chat";

const SESSION_CACHE_STORAGE_KEY = "goose:chat-sessions";

// Extended session metadata used by the frontend session list
export interface ChatSession {
  id: string; // === sessionId
  title: string;
  projectId?: string | null;
  agentId?: string;
  providerId?: string;
  personaId?: string;
  modelName?: string;
  createdAt: string; // ISO timestamp
  updatedAt: string;
  archivedAt?: string;
  messageCount: number;
  draft?: boolean;
}

interface ChatSessionStoreState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  isLoading: boolean;
  contextPanelOpenBySession: Record<string, boolean>;
}

interface CreateSessionOpts {
  title?: string;
  projectId?: string;
  agentId?: string;
  providerId?: string;
  personaId?: string;
}

interface ChatSessionStoreActions {
  // Session lifecycle
  createSession: (opts?: CreateSessionOpts) => Promise<ChatSession>;
  createDraftSession: (opts?: CreateSessionOpts) => ChatSession;
  promoteDraft: (id: string) => void;
  removeDraft: (id: string) => void;
  loadSessions: () => Promise<void>;
  updateSession: (
    id: string,
    patch: Partial<ChatSession>,
    opts?: { localOnly?: boolean },
  ) => void;
  archiveSession: (id: string) => Promise<void>;
  unarchiveSession: (id: string) => Promise<void>;

  setActiveSession: (sessionId: string | null) => void;

  setContextPanelOpen: (sessionId: string, open: boolean) => void;

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
    const persistable = sessions.filter((s) => !s.draft);
    window.localStorage.setItem(
      SESSION_CACHE_STORAGE_KEY,
      JSON.stringify(persistable),
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
  activeSessionId: null,
  isLoading: false,
  contextPanelOpenBySession: {},

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

  createDraftSession: (opts) => {
    const now = new Date().toISOString();
    const chatSession: ChatSession = {
      id: crypto.randomUUID(),
      title: opts?.title ?? "New Chat",
      projectId: opts?.projectId,
      agentId: opts?.agentId,
      providerId: opts?.providerId,
      personaId: opts?.personaId,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      draft: true,
    };
    set((state) => ({
      sessions: [...state.sessions, chatSession],
    }));
    return chatSession;
  },

  promoteDraft: (id) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, draft: undefined } : s,
      ),
    }));
    persistSessions(get().sessions);
  },

  removeDraft: (id) => {
    const session = get().sessions.find((s) => s.id === id);
    if (!session?.draft) return;
    const { [id]: _, ...remainingPanelState } = get().contextPanelOpenBySession;
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      activeSessionId:
        state.activeSessionId === id ? null : state.activeSessionId,
      contextPanelOpenBySession: remainingPanelState,
    }));
  },

  loadSessions: async () => {
    set({ isLoading: true });
    try {
      const backendSessions = await apiListSessions();
      const chatSessions = backendSessions.map(sessionToChatSession);
      const drafts = get().sessions.filter((s) => s.draft);
      set({ sessions: [...chatSessions, ...drafts] });
      persistSessions(chatSessions);
    } finally {
      set({ isLoading: false });
    }
  },

  updateSession: (id, patch, opts) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id
          ? { ...s, ...patch, updatedAt: new Date().toISOString() }
          : s,
      ),
    }));
    persistSessions(get().sessions);
    if (opts?.localOnly) return;
    const session = get().sessions.find((s) => s.id === id);
    if (session?.draft) return;
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
      const { [id]: _, ...remainingPanelState } =
        get().contextPanelOpenBySession;
      set({
        sessions: nextSessions,
        contextPanelOpenBySession: remainingPanelState,
      });
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

  setContextPanelOpen: (sessionId, open) => {
    set((state) => ({
      contextPanelOpenBySession: {
        ...state.contextPanelOpenBySession,
        [sessionId]: open,
      },
    }));
  },

  // Helpers
  getSession: (id) => get().sessions.find((s) => s.id === id),

  getActiveSession: () => {
    const { activeSessionId, sessions } = get();
    if (!activeSessionId) return null;
    return sessions.find((s) => s.id === activeSessionId) ?? null;
  },
}));
