import { create } from "zustand";
import type { Session } from "@/shared/types/chat";

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
  draft?: boolean; // local-only session, not yet persisted to backend
  userSetName?: boolean;
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

const SESSION_CACHE_STORAGE_KEY = "goose:chat-sessions";

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

function draftsWithText(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const stored = window.localStorage.getItem("goose:chat-drafts");
    if (!stored) return new Set();
    const parsed = JSON.parse(stored);
    return new Set(
      Object.entries(parsed)
        .filter(([, v]) => typeof v === "string" && (v as string).length > 0)
        .map(([k]) => k),
    );
  } catch {
    return new Set();
  }
}

function persistSessions(sessions: ChatSession[]): void {
  if (typeof window === "undefined") return;
  try {
    const withText = draftsWithText();
    const persistable = sessions.filter((s) => !s.draft || withText.has(s.id));
    window.localStorage.setItem(
      SESSION_CACHE_STORAGE_KEY,
      JSON.stringify(persistable),
    );
  } catch {
    // localStorage may be unavailable
  }
}

/** Map a backend Session to the frontend ChatSession shape. */
export function sessionToChatSession(session: Session): ChatSession {
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
    userSetName: session.userSetName,
  };
}

export const useChatSessionStore = create<ChatSessionStore>((set, get) => ({
  // State
  sessions: [],
  activeSessionId: null,
  isLoading: false,
  contextPanelOpenBySession: {},

  // Session lifecycle — local-only for now.
  // The goose binary creates the real ACP session on first prompt
  // (via prepare_session / send_prompt). These just manage the
  // frontend's in-memory session list.
  createSession: async (_opts) => {
    throw new Error("createSession not yet wired to ACP — use createDraftSession");
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
    set((state) => ({ sessions: [...state.sessions, chatSession] }));
    return chatSession;
  },

  promoteDraft: (id) => {
    const session = get().sessions.find((s) => s.id === id);
    if (!session?.draft) return;
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
    // TODO: wire to ACP list_sessions
    // For now, just load cached drafts from localStorage
    const cached = loadCachedSessions();
    const drafts = cached.filter((s) => s.draft);
    set({ sessions: drafts });
  },

  updateSession: (id, patch, opts) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s,
      ),
    }));
    persistSessions(get().sessions);
    if (opts?.localOnly) return;
    const session = get().sessions.find((s) => s.id === id);
    if (session?.draft) return;
    // TODO: wire non-draft updates to ACP when supported
  },

  archiveSession: async (id) => {
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      activeSessionId:
        state.activeSessionId === id ? null : state.activeSessionId,
    }));
  },

  unarchiveSession: async (_id) => {
    // No-op — no archive persistence yet
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
