import { useCallback, useEffect } from "react";
import { useAgentStore } from "../stores/agentStore";
import type { Avatar, Persona } from "@/shared/types/agents";

// Minimal persona stubs for pre-backend-response UI rendering.
// Full system prompts are loaded from the Rust backend via listPersonas().
const BUILTIN_PERSONA_STUBS: Persona[] = [
  {
    id: "builtin-solo",
    displayName: "Solo",
    systemPrompt: "",
    provider: "goose" as const,
    model: "claude-sonnet-4-20250514",
    isBuiltin: true,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "builtin-scout",
    displayName: "Scout",
    systemPrompt: "",
    provider: "goose" as const,
    model: "claude-sonnet-4-20250514",
    isBuiltin: true,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "builtin-ralph",
    displayName: "Ralph",
    systemPrompt: "",
    provider: "goose" as const,
    model: "claude-sonnet-4-20250514",
    isBuiltin: true,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
];

/**
 * Hook for managing personas and agents.
 * Loads built-in personas on mount and provides CRUD operations.
 */
export function useAgents() {
  const store = useAgentStore();

  // Seed persona stubs so the UI has something to render before the backend responds.
  // Full system prompts are loaded from the Rust backend via listPersonas() / usePersonas.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally run only on mount to seed built-in personas once
  useEffect(() => {
    const existing = store.personas;
    if (existing.length === 0) {
      store.setPersonas(BUILTIN_PERSONA_STUBS);
    }
    // Seed a default Solo ACP agent if none exist.
    // systemPrompt is left empty; the actual prompt comes from the persona
    // lookup at message-send time (via selectedPersona?.systemPrompt in ChatView).
    if (store.agents.length === 0) {
      const defaultAgent = {
        id: "default-goose-acp",
        name: "Solo",
        personaId: "builtin-solo",
        provider: "goose" as const,
        model: "claude-sonnet-4-20250514",
        systemPrompt: "",
        connectionType: "acp" as const,
        status: "online" as const,
        isBuiltin: true,
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };
      store.addAgent(defaultAgent);
      store.setActiveAgent(defaultAgent.id);
    }
  }, []);

  const createPersona = useCallback(
    (data: {
      displayName: string;
      systemPrompt: string;
      avatar?: Avatar | null;
      provider?: "goose" | "claude" | "openai" | "ollama" | "custom";
      model?: string;
    }) => {
      const persona = {
        id: crypto.randomUUID(),
        ...data,
        isBuiltin: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.addPersona(persona);
      return persona;
    },
    [store],
  );

  const updatePersona = useCallback(
    (
      id: string,
      updates: Partial<{
        displayName: string;
        systemPrompt: string;
        avatar: Avatar | null;
        provider: "goose" | "claude" | "openai" | "ollama" | "custom";
        model: string;
      }>,
    ) => {
      const persona = store.getPersonaById(id);
      if (!persona || persona.isBuiltin) return;
      store.updatePersona(id, updates);
    },
    [store],
  );

  const deletePersona = useCallback(
    (id: string) => {
      const persona = store.getPersonaById(id);
      if (!persona || persona.isBuiltin) return;
      store.removePersona(id);
    },
    [store],
  );

  const createAgent = useCallback(
    (data: {
      name: string;
      personaId?: string;
      provider: "goose" | "claude" | "openai" | "ollama" | "custom";
      model: string;
      systemPrompt?: string;
      connectionType: "builtin" | "acp";
    }) => {
      // If persona, inherit defaults
      let finalData = { ...data };
      if (data.personaId) {
        const persona = store.getPersonaById(data.personaId);
        if (persona) {
          finalData = {
            ...finalData,
            systemPrompt: finalData.systemPrompt ?? persona.systemPrompt,
            provider: finalData.provider ?? persona.provider ?? "goose",
            model:
              finalData.model ?? persona.model ?? "claude-sonnet-4-20250514",
          };
        }
      }

      const agent = {
        id: crypto.randomUUID(),
        ...finalData,
        status: "offline" as const,
        isBuiltin: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.addAgent(agent);
      return agent;
    },
    [store],
  );

  const deleteAgent = useCallback(
    (id: string) => {
      const agent = store.getAgentById(id);
      if (!agent || agent.isBuiltin) return;
      store.removeAgent(id);
    },
    [store],
  );

  return {
    personas: store.personas,
    agents: store.agents,
    activeAgent: store.getActiveAgent(),
    isLoading: store.isLoading,
    builtinPersonas: store.getBuiltinPersonas(),
    customPersonas: store.getCustomPersonas(),
    createPersona,
    updatePersona,
    deletePersona,
    createAgent,
    deleteAgent,
    setActiveAgent: store.setActiveAgent,
  };
}
