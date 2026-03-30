import { create } from "zustand";
import type { Persona, Agent } from "@/shared/types/agents";

interface AgentStoreState {
  // Personas
  personas: Persona[];
  personasLoading: boolean;

  // Agents
  agents: Agent[];
  agentsLoading: boolean;

  // Active agent for current chat
  activeAgentId: string | null;

  // General loading (for backwards compat)
  isLoading: boolean;

  // UI state
  personaEditorOpen: boolean;
  editingPersona: Persona | null;
}

interface AgentStoreActions {
  // Persona CRUD
  setPersonas: (personas: Persona[]) => void;
  addPersona: (persona: Persona) => void;
  updatePersona: (id: string, updates: Partial<Persona>) => void;
  removePersona: (id: string) => void;
  setPersonasLoading: (loading: boolean) => void;

  // Agent CRUD
  setAgents: (agents: Agent[]) => void;
  addAgent: (agent: Agent) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  removeAgent: (id: string) => void;
  setAgentsLoading: (loading: boolean) => void;

  // Active agent
  setActiveAgent: (id: string | null) => void;
  getActiveAgent: () => Agent | null;

  // Persona editor
  openPersonaEditor: (persona?: Persona) => void;
  closePersonaEditor: () => void;

  // Loading
  setLoading: (loading: boolean) => void;

  // Helpers
  getPersonaById: (id: string) => Persona | undefined;
  getAgentById: (id: string) => Agent | undefined;
  getAgentsByPersona: (personaId: string) => Agent[];
  getBuiltinPersonas: () => Persona[];
  getCustomPersonas: () => Persona[];
}

export type AgentStore = AgentStoreState & AgentStoreActions;

export const useAgentStore = create<AgentStore>((set, get) => ({
  // State
  personas: [],
  personasLoading: false,
  agents: [],
  agentsLoading: false,
  activeAgentId: null,
  isLoading: false,
  personaEditorOpen: false,
  editingPersona: null,

  // Persona CRUD
  setPersonas: (personas) => set({ personas }),

  addPersona: (persona) =>
    set((state) => ({ personas: [...state.personas, persona] })),

  updatePersona: (id, updates) =>
    set((state) => ({
      personas: state.personas.map((p) =>
        p.id === id
          ? { ...p, ...updates, updatedAt: new Date().toISOString() }
          : p,
      ),
    })),

  removePersona: (id) =>
    set((state) => ({
      personas: state.personas.filter((p) => p.id !== id),
    })),

  setPersonasLoading: (personasLoading) => set({ personasLoading }),

  // Agent CRUD
  setAgents: (agents) => set({ agents }),

  addAgent: (agent) => set((state) => ({ agents: [...state.agents, agent] })),

  updateAgent: (id, updates) =>
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === id
          ? { ...a, ...updates, updatedAt: new Date().toISOString() }
          : a,
      ),
    })),

  removeAgent: (id) =>
    set((state) => ({
      agents: state.agents.filter((a) => a.id !== id),
      activeAgentId: state.activeAgentId === id ? null : state.activeAgentId,
    })),

  setAgentsLoading: (agentsLoading) => set({ agentsLoading }),

  // Active agent
  setActiveAgent: (id) => set({ activeAgentId: id }),

  getActiveAgent: () => {
    const { activeAgentId, agents } = get();
    if (!activeAgentId) return null;
    return agents.find((a) => a.id === activeAgentId) ?? null;
  },

  // Persona editor
  openPersonaEditor: (persona) =>
    set({
      personaEditorOpen: true,
      editingPersona: persona ?? null,
    }),

  closePersonaEditor: () =>
    set({
      personaEditorOpen: false,
      editingPersona: null,
    }),

  // Loading
  setLoading: (isLoading) => set({ isLoading }),

  // Helpers
  getPersonaById: (id) => get().personas.find((p) => p.id === id),

  getAgentById: (id) => get().agents.find((a) => a.id === id),

  getAgentsByPersona: (personaId) =>
    get().agents.filter((a) => a.personaId === personaId),

  getBuiltinPersonas: () => get().personas.filter((p) => p.isBuiltin),

  getCustomPersonas: () => get().personas.filter((p) => !p.isBuiltin),
}));
