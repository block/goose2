import { create } from "zustand";
import { apiFetch } from "@/shared/api";
import type { AgentConfig } from "@/types";

interface AgentConfigStore {
  agents: AgentConfig[];
  loading: boolean;
  error: string | null;
  loadAgents: () => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
}

export const useAgentConfigStore = create<AgentConfigStore>()((set) => ({
  agents: [],
  loading: false,
  error: null,

  loadAgents: async () => {
    set({ loading: true, error: null });
    try {
      const res = await apiFetch("/agent-configs/list");
      if (!res.ok) throw new Error(`Failed to load agents: ${res.status}`);
      const data = await res.json();
      set({ agents: data.agents ?? [], loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load agents",
        loading: false,
      });
    }
  },

  deleteAgent: async (id) => {
    const res = await apiFetch(`/agent-configs/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Failed to delete agent: ${res.status}`);
    set((state) => ({ agents: state.agents.filter((a) => a.id !== id) }));
  },
}));
