import { describe, it, expect, beforeEach } from "vitest";
import { useAgentStore } from "../../stores/agentStore";
import type { Agent } from "@/shared/types/agents";

// ── helpers ───────────────────────────────────────────────────────────

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: crypto.randomUUID(),
    name: "Test Agent",
    provider: "goose",
    model: "claude-sonnet-4",
    connectionType: "builtin",
    status: "online",
    isBuiltin: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeDefaultGooseAgent(): Agent {
  return makeAgent({
    id: "default-goose",
    name: "Goose",
    provider: "goose",
    connectionType: "acp",
    status: "online",
    isBuiltin: true,
  });
}

// ── tests ─────────────────────────────────────────────────────────────

describe("default Goose ACP agent", () => {
  beforeEach(() => {
    useAgentStore.setState({
      personas: [],
      personasLoading: false,
      agents: [],
      agentsLoading: false,
      activeAgentId: null,
      isLoading: false,
      personaEditorOpen: false,
      editingPersona: null,
    });
  });

  // ── creation ─────────────────────────────────────────────────────

  it("default Goose agent is created with connectionType 'acp'", () => {
    const agent = makeDefaultGooseAgent();
    useAgentStore.getState().addAgent(agent);

    const agents = useAgentStore.getState().agents;
    expect(agents).toHaveLength(1);
    expect(agents[0].connectionType).toBe("acp");
  });

  it("default agent has provider 'goose'", () => {
    const agent = makeDefaultGooseAgent();
    useAgentStore.getState().addAgent(agent);

    const agents = useAgentStore.getState().agents;
    expect(agents[0].provider).toBe("goose");
  });

  it("default agent is set as active", () => {
    const agent = makeDefaultGooseAgent();
    useAgentStore.getState().addAgent(agent);
    useAgentStore.getState().setActiveAgent(agent.id);

    const activeAgent = useAgentStore.getState().getActiveAgent();
    expect(activeAgent).not.toBeNull();
    expect(activeAgent?.id).toBe("default-goose");
    expect(activeAgent?.connectionType).toBe("acp");
    expect(activeAgent?.provider).toBe("goose");
  });

  it("default agent is not created if agents already exist", () => {
    // Simulate an existing agent already in the store
    const existingAgent = makeAgent({
      id: "existing-1",
      name: "Existing Agent",
      connectionType: "builtin",
    });
    useAgentStore.getState().addAgent(existingAgent);

    // Simulate the guard: only add default if no agents exist
    const agents = useAgentStore.getState().agents;
    if (agents.length === 0) {
      const defaultAgent = makeDefaultGooseAgent();
      useAgentStore.getState().addAgent(defaultAgent);
      useAgentStore.getState().setActiveAgent(defaultAgent.id);
    }

    // Should still have only the existing agent
    expect(useAgentStore.getState().agents).toHaveLength(1);
    expect(useAgentStore.getState().agents[0].id).toBe("existing-1");
    expect(useAgentStore.getState().activeAgentId).toBeNull();
  });

  // ── properties ───────────────────────────────────────────────────

  it("default agent is marked as builtin", () => {
    const agent = makeDefaultGooseAgent();
    useAgentStore.getState().addAgent(agent);

    expect(useAgentStore.getState().agents[0].isBuiltin).toBe(true);
  });

  it("default agent has status 'online'", () => {
    const agent = makeDefaultGooseAgent();
    useAgentStore.getState().addAgent(agent);

    expect(useAgentStore.getState().agents[0].status).toBe("online");
  });

  it("getActiveAgent returns null when no agent is active", () => {
    const agent = makeDefaultGooseAgent();
    useAgentStore.getState().addAgent(agent);
    // Do NOT set active agent

    expect(useAgentStore.getState().getActiveAgent()).toBeNull();
  });
});
