import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContextPanel } from "../ContextPanel";

const mockUseGitState = vi.fn();

vi.mock("@/shared/hooks/useGitState", () => ({
  useGitState: (...args: unknown[]) => mockUseGitState(...args),
}));

describe("ContextPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGitState.mockReturnValue({
      data: {
        isGitRepo: true,
        currentBranch: "main",
        dirtyFileCount: 3,
        worktrees: [
          {
            path: "/Users/test/goose2",
            branch: "main",
            isMain: true,
          },
          {
            path: "/Users/test/goose2-feature",
            branch: "feat/context-panel",
            isMain: false,
          },
        ],
        isWorktree: false,
        mainWorktreePath: "/Users/test/goose2",
      },
      error: null,
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });
  });

  it("renders workspace details and supports switching to files tab", async () => {
    const user = userEvent.setup();

    render(
      <ContextPanel
        projectName="Desktop UX"
        projectColor="#22c55e"
        projectWorkingDir="/Users/test/goose2"
      />,
    );

    expect(screen.getByRole("tab", { name: /details/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /files/i })).toBeInTheDocument();
    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(screen.getByText("Desktop UX")).toBeInTheDocument();
    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.getByText("feat/context-panel")).toBeInTheDocument();
    expect(screen.getByText("Main")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /files/i }));

    expect(screen.getByText("Session Files")).toBeInTheDocument();
    expect(
      screen.getByText("No files for this session yet."),
    ).toBeInTheDocument();
  });

  it("shows a non-repo fallback message", async () => {
    mockUseGitState.mockReturnValue({
      data: {
        isGitRepo: false,
        currentBranch: null,
        dirtyFileCount: 0,
        worktrees: [],
        isWorktree: false,
        mainWorktreePath: null,
      },
      error: null,
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });

    render(<ContextPanel projectWorkingDir="/Users/test/not-a-repo" />);

    expect(screen.getByText("Not a git repository.")).toBeInTheDocument();
  });
});
