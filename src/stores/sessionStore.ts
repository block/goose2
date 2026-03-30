import { create } from "zustand";
import { apiFetch } from "@/shared/api";
import type { Session } from "@/types";

interface SessionStore {
  sessions: Session[];
  activeSessionId: string | null;
  loading: boolean;
  error: string | null;

  loadSessions: () => Promise<void>;
  createSession: (name?: string) => Promise<Session>;
  deleteSession: (id: string) => Promise<void>;
  setActiveSession: (id: string | null) => void;
  getActiveSession: () => Session | undefined;
}

export const useSessionStore = create<SessionStore>()((set, get) => ({
  sessions: [],
  activeSessionId: null,
  loading: false,
  error: null,

  loadSessions: async () => {
    set({ loading: true, error: null });
    try {
      const res = await apiFetch("/sessions");
      if (!res.ok) throw new Error(`Failed to load sessions: ${res.status}`);
      const data = await res.json();
      set({ sessions: data.sessions ?? data ?? [], loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load sessions",
        loading: false,
      });
    }
  },

  createSession: async (name?: string) => {
    const res = await apiFetch("/sessions", {
      method: "POST",
      body: JSON.stringify({ name: name ?? "New Chat" }),
    });
    if (!res.ok) throw new Error(`Failed to create session: ${res.status}`);
    const session = await res.json();
    set((state) => ({ sessions: [session, ...state.sessions] }));
    return session;
  },

  deleteSession: async (id: string) => {
    const res = await apiFetch(`/sessions/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Failed to delete session: ${res.status}`);
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      activeSessionId:
        state.activeSessionId === id ? null : state.activeSessionId,
    }));
  },

  setActiveSession: (id) => set({ activeSessionId: id }),

  getActiveSession: () => {
    const { sessions, activeSessionId } = get();
    return sessions.find((s) => s.id === activeSessionId);
  },
}));
