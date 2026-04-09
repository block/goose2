import { create } from "zustand";
import type { Session } from "@/shared/types/chat";
import { acpListSessions } from "@/shared/api/acp";
import { DEFAULT_CHAT_TITLE } from "@/features/chat/lib/sessionTitle";
import type { ModelOption } from "../types";

const EMPTY_MODELS: ModelOption[] = [];

// Extended session metadata used by the frontend session list
export interface ChatSession {
  id: string; // === sessionId
  title: string;
  projectId?: string | null;
  agentId?: string;
  providerId?: string;
  personaId?: string;
  modelId?: string;
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
  modelsBySession: Record<string, ModelOption[]>;
  modelCacheByProvider: Record<string, ModelOption[]>;
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
  addSession: (session: ChatSession) => void;
  archiveSession: (id: string) => Promise<void>;
  unarchiveSession: (id: string) => Promise<void>;

  setActiveSession: (sessionId: string | null) => void;

  setContextPanelOpen: (sessionId: string, open: boolean) => void;
  setSessionModels: (sessionId: string, models: ModelOption[]) => void;
  switchSessionProvider: (
    sessionId: string,
    providerId: string,
    models: ModelOption[],
  ) => void;
  cacheModelsForProvider: (providerId: string, models: ModelOption[]) => void;
  getCachedModels: (providerId: string) => ModelOption[];

  // Helpers
  getSession: (id: string) => ChatSession | undefined;
  getActiveSession: () => ChatSession | null;
  getArchivedSessions: () => ChatSession[];
  getSessionModels: (sessionId: string) => ModelOption[];
}

export type ChatSessionStore = ChatSessionStoreState & ChatSessionStoreActions;

const SESSION_CACHE_STORAGE_KEY = "goose:chat-sessions";
const MODEL_CACHE_STORAGE_KEY = "goose:model-cache";

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

function loadModelCache(): Record<string, ModelOption[]> {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.localStorage.getItem(MODEL_CACHE_STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, ModelOption[]>)
      : {};
  } catch {
    return {};
  }
}

function persistModelCache(cache: Record<string, ModelOption[]>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MODEL_CACHE_STORAGE_KEY, JSON.stringify(cache));
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
    modelId: session.modelId,
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
  modelsBySession: {},
  modelCacheByProvider: loadModelCache(),

  // Session lifecycle — local-only for now.
  // The goose binary creates the real ACP session on first prompt
  // (via prepare_session / send_prompt). These just manage the
  // frontend's in-memory session list.
  createSession: async (_opts) => {
    throw new Error(
      "createSession not yet wired to ACP — use createDraftSession",
    );
  },

  createDraftSession: (opts) => {
    const now = new Date().toISOString();
    const chatSession: ChatSession = {
      id: crypto.randomUUID(),
      title: opts?.title ?? DEFAULT_CHAT_TITLE,
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
    // Clear draft flag — the backend session is created automatically by
    // ensure_session when the first message is sent via ACP.
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
    const remainingModels = { ...get().modelsBySession };
    delete remainingModels[id];
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      activeSessionId:
        state.activeSessionId === id ? null : state.activeSessionId,
      contextPanelOpenBySession: remainingPanelState,
      modelsBySession: remainingModels,
    }));
  },

  loadSessions: async () => {
    set({ isLoading: true });
    try {
      const acpSessions = await acpListSessions();
      const sessions: ChatSession[] = acpSessions.map((s) => ({
        id: s.sessionId,
        title: s.title ?? "Untitled",
        createdAt: s.updatedAt ?? new Date().toISOString(),
        updatedAt: s.updatedAt ?? new Date().toISOString(),
        messageCount: s.messageCount,
      }));
      // Sort by updatedAt descending (most recent first)
      sessions.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
      // Preserve local drafts and archived sessions (archived are local-only).
      // Deduplicate: archived sessions still exist in ACP, so filter them out
      // of the ACP results to avoid showing both archived and active copies.
      const cached = loadCachedSessions();
      const drafts = get().sessions.filter((s) => s.draft);
      const archived = cached.filter((s) => s.archivedAt);
      const archivedIds = new Set(archived.map((s) => s.id));
      const nonArchivedAcp = sessions.filter((s) => !archivedIds.has(s.id));
      const merged = [...nonArchivedAcp, ...drafts, ...archived];
      const activeSessionId = get().activeSessionId;
      const activeSessionStillExists =
        activeSessionId == null || merged.some((s) => s.id === activeSessionId);
      set({
        sessions: merged,
        activeSessionId: activeSessionStillExists ? activeSessionId : null,
      });
      persistSessions(merged);
    } catch (err) {
      console.error("Failed to load sessions from ACP:", err);
      // On error, at least load cached drafts
      const cached = loadCachedSessions();
      const drafts = cached.filter((s) => s.draft);
      set({ sessions: drafts });
    } finally {
      set({ isLoading: false });
    }
  },

  updateSession: (id, patch, opts) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id
          ? { ...s, ...patch, updatedAt: patch.updatedAt ?? s.updatedAt }
          : s,
      ),
    }));
    persistSessions(get().sessions);
    if (opts?.localOnly) return;
    const session = get().sessions.find((s) => s.id === id);
    if (session?.draft) return;
    // TODO: wire non-draft updates to ACP when supported
  },

  addSession: (session) => {
    set((state) => {
      const existing = state.sessions.findIndex((s) => s.id === session.id);
      if (existing >= 0) {
        const updated = [...state.sessions];
        updated[existing] = { ...updated[existing], ...session };
        return { sessions: updated };
      }
      return { sessions: [session, ...state.sessions] };
    });
    persistSessions(get().sessions);
  },

  archiveSession: async (id) => {
    const remainingModels = { ...get().modelsBySession };
    delete remainingModels[id];
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, archivedAt: new Date().toISOString() } : s,
      ),
      activeSessionId:
        state.activeSessionId === id ? null : state.activeSessionId,
      modelsBySession: remainingModels,
    }));
    persistSessions(get().sessions);
  },

  unarchiveSession: async (id) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, archivedAt: undefined } : s,
      ),
    }));
    persistSessions(get().sessions);
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

  setSessionModels: (sessionId, models) => {
    set((state) => ({
      modelsBySession: {
        ...state.modelsBySession,
        [sessionId]: models,
      },
    }));
  },

  switchSessionProvider: (sessionId, providerId, models) => {
    set((state) => ({
      modelsBySession: {
        ...state.modelsBySession,
        [sessionId]: models,
      },
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              providerId,
              modelId: models.length > 0 ? models[0].id : undefined,
              modelName:
                models.length > 0
                  ? (models[0].displayName ?? models[0].name)
                  : undefined,
              updatedAt: s.updatedAt,
            }
          : s,
      ),
    }));
    persistSessions(get().sessions);
  },

  cacheModelsForProvider: (providerId, models) => {
    if (models.length === 0) return;
    const existing = get().modelCacheByProvider[providerId];
    if (
      existing &&
      existing.length === models.length &&
      existing.every((m, i) => m.id === models[i].id)
    ) {
      return;
    }
    set((state) => {
      const updated = {
        ...state.modelCacheByProvider,
        [providerId]: models,
      };
      persistModelCache(updated);
      return { modelCacheByProvider: updated };
    });
  },

  getCachedModels: (providerId) =>
    get().modelCacheByProvider[providerId] ?? EMPTY_MODELS,

  // Helpers
  getSession: (id) => get().sessions.find((s) => s.id === id),

  getActiveSession: () => {
    const { activeSessionId, sessions } = get();
    if (!activeSessionId) return null;
    return sessions.find((s) => s.id === activeSessionId) ?? null;
  },
  getArchivedSessions: () => get().sessions.filter((s) => !!s.archivedAt),

  getSessionModels: (sessionId) =>
    get().modelsBySession[sessionId] ?? EMPTY_MODELS,
}));
