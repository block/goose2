import { create } from "zustand";
import {
  createSession as apiCreateSession,
  listSessions as apiListSessions,
  archiveSession as apiArchiveSession,
  unarchiveSession as apiUnarchiveSession,
  updateSession as apiUpdateSession,
  saveUiState as apiSaveUiState,
  loadUiState as apiLoadUiState,
} from "@/shared/api/chat";
import type { Session } from "@/shared/types/chat";

// Extended session metadata for tab management
export interface ChatSession {
  id: string; // === sessionId
  title: string;
  projectId?: string;
  agentId?: string;
  providerId?: string;
  personaId?: string;
  modelName?: string;
  createdAt: string; // ISO timestamp
  updatedAt: string;
  archivedAt?: string;
  messageCount: number;
}

interface ChatSessionStoreState {
  sessions: ChatSession[];
  openTabIds: string[]; // ordered list of session IDs shown as tabs
  activeTabId: string | null;
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
  archiveSession: (id: string) => Promise<void>;
  unarchiveSession: (id: string) => Promise<void>;

  // Tab management
  openTab: (sessionId: string) => void;
  closeTab: (sessionId: string) => void;
  reorderTabs: (tabIds: string[]) => void;
  setActiveTab: (sessionId: string | null) => void;

  // Persistence (stubs for Phase 2b)
  persistTabState: () => void;
  loadTabState: () => Promise<void>;

  // Helpers
  getSession: (id: string) => ChatSession | undefined;
  getActiveSession: () => ChatSession | null;
}

export type ChatSessionStore = ChatSessionStoreState & ChatSessionStoreActions;

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
  sessions: [],
  openTabIds: [],
  activeTabId: null,
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
    return chatSession;
  },

  loadSessions: async () => {
    set({ isLoading: true });
    try {
      const backendSessions = await apiListSessions();
      const chatSessions = backendSessions.map(sessionToChatSession);
      set({ sessions: chatSessions });
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
    // Persist persistable fields to the backend
    const backendPatch: Record<string, string> = {};
    if (patch.title) backendPatch.title = patch.title;
    if (patch.providerId) backendPatch.providerId = patch.providerId;
    if (patch.personaId) backendPatch.personaId = patch.personaId;
    if (patch.modelName) backendPatch.modelName = patch.modelName;
    if (Object.keys(backendPatch).length > 0) {
      apiUpdateSession(id, backendPatch).catch((err) => {
        console.error("Failed to persist session update:", err);
      });
    }
  },

  archiveSession: async (id) => {
    const { openTabIds, activeTabId } = get();

    // Remove from open tabs immediately for responsive UI
    set((state) => {
      const newOpenTabIds = state.openTabIds.filter((tabId) => tabId !== id);
      const newActiveTabId =
        state.activeTabId === id
          ? (newOpenTabIds[newOpenTabIds.length - 1] ?? null)
          : state.activeTabId;
      return {
        openTabIds: newOpenTabIds,
        activeTabId: newActiveTabId,
      };
    });
    get().persistTabState();

    // Archive on backend — update local state on success
    try {
      await apiArchiveSession(id);
      const archivedAt = new Date().toISOString();
      set((state) => ({
        sessions: state.sessions
          .map((s) => (s.id === id ? { ...s, archivedAt } : s))
          .filter((s) => !s.archivedAt),
      }));
    } catch (err) {
      set({
        openTabIds,
        activeTabId,
      });
      get().persistTabState();
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

  // Tab management
  openTab: (sessionId) => {
    set((state) => {
      // Don't add duplicate tabs
      if (state.openTabIds.includes(sessionId)) {
        return { activeTabId: sessionId };
      }
      return {
        openTabIds: [...state.openTabIds, sessionId],
        activeTabId: sessionId,
      };
    });
    get().persistTabState();
  },

  closeTab: (sessionId) => {
    set((state) => {
      const newOpenTabIds = state.openTabIds.filter((id) => id !== sessionId);
      let newActiveTabId = state.activeTabId;
      if (state.activeTabId === sessionId) {
        // Activate the previous tab, or the next one, or null
        const closedIndex = state.openTabIds.indexOf(sessionId);
        newActiveTabId =
          newOpenTabIds[Math.min(closedIndex, newOpenTabIds.length - 1)] ??
          null;
      }
      return {
        openTabIds: newOpenTabIds,
        activeTabId: newActiveTabId,
      };
    });
    get().persistTabState();
  },

  reorderTabs: (tabIds) => {
    set({ openTabIds: tabIds });
    get().persistTabState();
  },

  setActiveTab: (sessionId) => {
    if (get().activeTabId === sessionId) return;
    set({ activeTabId: sessionId });
    get().persistTabState();
  },

  // Persistence
  persistTabState: () => {
    const { openTabIds, activeTabId } = get();
    // personaPerSession kept for backward compat with ui_state.json but
    // persona is now persisted on the session itself via update_session.
    apiSaveUiState(openTabIds, activeTabId, {}).catch((err) => {
      console.error("Failed to persist tab state:", err);
    });
  },

  loadTabState: async () => {
    try {
      const { openTabIds, activeTabId } = await apiLoadUiState();
      const { sessions } = get();
      const sessionIds = new Set(sessions.map((s) => s.id));

      // Filter to only tabs whose sessions still exist
      const validTabIds = openTabIds.filter((id) => sessionIds.has(id));
      const validActiveTabId =
        activeTabId && sessionIds.has(activeTabId)
          ? activeTabId
          : (validTabIds[0] ?? null);

      set({
        openTabIds: validTabIds,
        activeTabId: validActiveTabId,
      });
    } catch (err) {
      console.error("Failed to load tab state:", err);
    }
  },

  // Helpers
  getSession: (id) => get().sessions.find((s) => s.id === id),

  getActiveSession: () => {
    const { activeTabId, sessions } = get();
    if (!activeTabId) return null;
    return sessions.find((s) => s.id === activeTabId) ?? null;
  },
}));
