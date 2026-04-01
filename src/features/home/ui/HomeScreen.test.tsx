import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HomeScreen } from "./HomeScreen";

vi.mock("@/shared/api/acp", () => ({
  discoverAcpProviders: vi.fn().mockResolvedValue([
    { id: "goose", label: "Goose" },
    { id: "openai", label: "OpenAI" },
  ]),
}));

// HomeScreen now reads personas from the agent store, not from ACP providers
vi.mock("@/features/agents/stores/agentStore", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/features/agents/stores/agentStore")
    >();
  return {
    ...actual,
    useAgentStore: Object.assign(
      (selector?: (s: unknown) => unknown) => {
        const state = {
          personas: [
            {
              id: "builtin-solo",
              displayName: "Solo",
              systemPrompt: "You are Solo.",
              isBuiltin: true,
              createdAt: "",
              updatedAt: "",
            },
          ],
          personasLoading: false,
          openPersonaEditor: vi.fn(),
        };
        return selector ? selector(state) : state;
      },
      { getState: () => ({ openPersonaEditor: vi.fn() }) },
    ),
  };
});

describe("HomeScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 29, 14, 30, 0)); // 2:30 PM
  });

  it("renders the clock", () => {
    render(<HomeScreen />);
    expect(screen.getByText("2:30")).toBeInTheDocument();
    expect(screen.getByText("PM")).toBeInTheDocument();
  });

  it("shows afternoon greeting at 2:30 PM", () => {
    render(<HomeScreen />);
    expect(screen.getByText("Good afternoon")).toBeInTheDocument();
  });

  it("renders the chat input placeholder with persona name", () => {
    render(<HomeScreen />);
    expect(
      screen.getByPlaceholderText("Message Goose... (type @ to mention)"),
    ).toBeInTheDocument();
  });

  it("renders the assistant chooser affordance", () => {
    render(<HomeScreen />);
    expect(
      screen.getByRole("button", { name: /choose assistant/i }),
    ).toBeInTheDocument();
  });

  it("renders the provider and project controls on the home screen", () => {
    render(<HomeScreen />);
    expect(
      screen.getByRole("button", { name: /override provider/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /select project/i }),
    ).toBeInTheDocument();
  });
});
