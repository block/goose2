import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContextPanel } from "../ContextPanel";

const mockUseGitState = vi.fn();

vi.mock("@/shared/hooks/useGitState", () => ({
  useGitState: (...args: unknown[]) => mockUseGitState(...args),
}));

vi.mock("@/shared/api/git", () => ({
  switchBranch: vi.fn(),
  stashChanges: vi.fn(),
  initRepo: vi.fn(),
}));

vi.mock("../../hooks/ArtifactPolicyContext", () => ({
  useArtifactPolicyContext: () => ({
    getAllSessionArtifacts: () => [],
    openResolvedPath: vi.fn(),
    pathExists: () => Promise.resolve(true),
  }),
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
        localBranches: ["dev", "old-feature"],
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
        sessionId="test-session-1"
        projectName="Desktop UX"
        projectColor="#22c55e"
        projectWorkingDirs={["/Users/test/goose2"]}
      />,
    );

    expect(screen.getByRole("tab", { name: /details/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /files/i })).toBeInTheDocument();
    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(screen.getByText("Desktop UX")).toBeInTheDocument();
    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.getByText("3 uncommitted changes")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /files/i }));

    expect(screen.getByText("No files yet")).toBeInTheDocument();
  });

  it("shows path and init button for non-git directory", async () => {
    mockUseGitState.mockReturnValue({
      data: {
        isGitRepo: false,
        currentBranch: null,
        dirtyFileCount: 0,
        worktrees: [],
        isWorktree: false,
        mainWorktreePath: null,
        localBranches: [],
      },
      error: null,
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });

    render(
      <ContextPanel
        sessionId="test-session-2"
        projectWorkingDirs={["/Users/test/not-a-repo"]}
      />,
    );

    expect(
      screen.getByRole("button", { name: /initialize git/i }),
    ).toBeInTheDocument();
  });

  it("shows the working context picker when git repo is available", () => {
    render(
      <ContextPanel
        sessionId="test-session-3"
        projectName="Desktop UX"
        projectWorkingDirs={["/Users/test/goose2"]}
      />,
    );

    expect(
      screen.getByRole("button", { name: /select branch/i }),
    ).toBeInTheDocument();
  });

  it("shows the current branch in the picker when it is the only option", async () => {
    const user = userEvent.setup();

    mockUseGitState.mockReturnValue({
      data: {
        isGitRepo: true,
        currentBranch: "main",
        dirtyFileCount: 0,
        worktrees: [
          {
            path: "/Users/test/goose2",
            branch: "main",
            isMain: true,
          },
        ],
        isWorktree: false,
        mainWorktreePath: "/Users/test/goose2",
        localBranches: [],
      },
      error: null,
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });

    render(
      <ContextPanel
        sessionId="test-session-4"
        projectWorkingDirs={["/Users/test/goose2"]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /select branch/i }));

    expect(screen.getByText("Worktrees")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /main/i })).toBeInTheDocument();
  });
});
