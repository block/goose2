import { useCallback, useEffect } from "react";
import { useAgentStore } from "../stores/agentStore";

// Built-in persona definitions (shipped with app)
const BUILTIN_PERSONAS = [
  {
    id: "builtin-goose",
    displayName: "Goose",
    systemPrompt:
      "You are Goose, a general-purpose AI coding assistant. You help with writing, debugging, and understanding code. You are direct, helpful, and concise.",
    provider: "goose" as const,
    model: "claude-sonnet-4-20250514",
    isBuiltin: true,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "builtin-scout",
    displayName: "Scout",
    systemPrompt:
      "You are Scout, a research-focused agent. You excel at exploring codebases, finding relevant code, understanding architecture, and providing comprehensive analysis. Use the Research-Plan-Implement pattern.",
    provider: "goose" as const,
    model: "claude-sonnet-4-20250514",
    isBuiltin: true,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "builtin-reviewer",
    displayName: "Reviewer",
    systemPrompt:
      "You are Reviewer, a code review specialist. You focus on code quality, correctness, security, performance, and maintainability. Provide clear, actionable feedback organized by severity.",
    provider: "goose" as const,
    model: "claude-sonnet-4-20250514",
    isBuiltin: true,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "builtin-architect",
    displayName: "Architect",
    systemPrompt:
      "You are Architect, a software design specialist. You help plan implementations, design systems, evaluate tradeoffs, and create technical specifications.",
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

  // Load built-in personas on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally run only on mount to seed built-in personas once
  useEffect(() => {
    const existing = store.personas;
    if (existing.length === 0) {
      store.setPersonas(BUILTIN_PERSONAS);
    }
  }, []);

  const createPersona = useCallback(
    (data: {
      displayName: string;
      systemPrompt: string;
      avatarUrl?: string;
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
        avatarUrl: string;
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
      avatarUrl?: string;
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
            avatarUrl: finalData.avatarUrl ?? persona.avatarUrl,
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
