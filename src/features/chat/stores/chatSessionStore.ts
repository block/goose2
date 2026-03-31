import { create } from "zustand";
import {
  createSession as apiCreateSession,
  listSessions as apiListSessions,
  deleteSession as apiDeleteSession,
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
  createdAt: string; // ISO timestamp
  updatedAt: string;
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
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
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
    };
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

  updateSession: (id, patch) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id
          ? { ...s, ...patch, updatedAt: new Date().toISOString() }
          : s,
      ),
    })),

  archiveSession: async (id) => {
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

    // Delete from backend — only remove from local sessions on success
    try {
      await apiDeleteSession(id);
      set((state) => ({
        sessions: state.sessions.filter((s) => s.id !== id),
      }));
    } catch (err) {
      console.error("Failed to delete session from backend:", err);
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
    const { openTabIds, activeTabId, sessions } = get();
    // Build persona mapping from sessions
    const personaPerSession: Record<string, string> = {};
    for (const s of sessions) {
      if (s.personaId) personaPerSession[s.id] = s.personaId;
    }
    apiSaveUiState(openTabIds, activeTabId, personaPerSession).catch((err) => {
      console.error("Failed to persist tab state:", err);
    });
  },

  loadTabState: async () => {
    try {
      const { openTabIds, activeTabId, personaPerSession } =
        await apiLoadUiState();
      const { sessions } = get();
      const sessionIds = new Set(sessions.map((s) => s.id));

      // Filter to only tabs whose sessions still exist
      const validTabIds = openTabIds.filter((id) => sessionIds.has(id));
      const validActiveTabId =
        activeTabId && sessionIds.has(activeTabId)
          ? activeTabId
          : (validTabIds[0] ?? null);

      // Restore persona IDs from persisted mapping
      const updatedSessions = sessions.map((s) => {
        const personaId = personaPerSession?.[s.id];
        return personaId ? { ...s, personaId } : s;
      });

      set({
        sessions: updatedSessions,
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
