import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToolChainCards } from "../ToolChainCards";
import type { ToolChainItem } from "../ToolChainCards";

vi.mock("@/features/chat/hooks/ArtifactPolicyContext", () => ({
  useArtifactPolicyContext: () => ({
    resolveToolCardDisplay: () => ({
      role: "none",
      primaryCandidate: null,
      secondaryCandidates: [],
    }),
    resolveMarkdownHref: () => null,
    pathExists: async () => false,
    openResolvedPath: async () => {},
  }),
}));

function makeItem(
  overrides: Partial<{
    key: string;
    name: string;
    status: string;
    isError: boolean;
    result: string;
  }> = {},
): ToolChainItem {
  const key = overrides.key ?? "tool-1";
  const name = overrides.name ?? "Write foo.md";
  const status = overrides.status ?? "completed";
  const isError = overrides.isError ?? false;
  return {
    key,
    request: {
      type: "toolRequest",
      id: key,
      name,
      arguments: {},
      status: status as "completed" | "executing" | "pending" | "error",
    },
    response: {
      type: "toolResponse",
      id: key,
      name,
      result: overrides.result ?? "done",
      isError,
    },
  };
}

describe("ToolChainCards — grouped status badge", () => {
  it("shows Error badge when a grouped tool call has an error", () => {
    const items: ToolChainItem[] = [
      makeItem({ key: "t1", name: "Write a.md", isError: true }),
      makeItem({ key: "t2", name: "Write b.md", isError: true }),
      makeItem({ key: "t3", name: "Write c.md", isError: true }),
    ];

    render(<ToolChainCards toolItems={items} />);

    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("shows Running badge when a grouped tool call is still executing", () => {
    const items: ToolChainItem[] = [
      {
        key: "t1",
        request: {
          type: "toolRequest",
          id: "t1",
          name: "Write a.md",
          arguments: {},
          status: "executing",
        },
      },
      {
        key: "t2",
        request: {
          type: "toolRequest",
          id: "t2",
          name: "Write b.md",
          arguments: {},
          status: "executing",
        },
      },
    ];

    render(<ToolChainCards toolItems={items} />);

    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("does not show a status badge for a fully successful group", () => {
    const items: ToolChainItem[] = [
      makeItem({ key: "t1", name: "Write a.md" }),
      makeItem({ key: "t2", name: "Write b.md" }),
      makeItem({ key: "t3", name: "Write c.md" }),
    ];

    render(<ToolChainCards toolItems={items} />);

    expect(screen.queryByText("Error")).not.toBeInTheDocument();
    expect(screen.queryByText("Running")).not.toBeInTheDocument();
  });
});
