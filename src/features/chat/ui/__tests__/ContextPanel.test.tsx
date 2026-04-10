import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as gitApi from "@/shared/api/git";
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
  const getBranchButton = (branch: string) =>
    screen
      .getAllByRole("button")
      .find((button) => button.textContent?.startsWith(branch));

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
        localBranches: ["main", "feat/context-panel", "dev", "old-feature"],
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
    expect(
      screen.getByRole("button", { name: /select worktree or branch/i }),
    ).toHaveTextContent("~/goose2");
    expect(
      screen.getByRole("button", { name: /select worktree or branch/i }),
    ).toHaveTextContent("main");
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
      screen.getByRole("button", { name: /select worktree or branch/i }),
    ).toBeInTheDocument();
  });

  it("defaults to the current worktree path instead of the first worktree", () => {
    mockUseGitState.mockReturnValue({
      data: {
        isGitRepo: true,
        currentBranch: "feat/context-panel",
        dirtyFileCount: 0,
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
        isWorktree: true,
        mainWorktreePath: "/Users/test/goose2",
        localBranches: ["feat/context-panel", "main", "dev"],
      },
      error: null,
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });

    render(
      <ContextPanel
        sessionId="test-session-4"
        projectWorkingDirs={["/Users/test/goose2-feature"]}
      />,
    );

    expect(
      screen.getByRole("button", { name: /select worktree or branch/i }),
    ).toHaveTextContent("~/goose2-feature");
    expect(
      screen.getByRole("button", { name: /select worktree or branch/i }),
    ).toHaveTextContent("feat/context-panel");
  });

  it("shows all branches on the main worktree and uses folder subtext for branch targets", async () => {
    const user = userEvent.setup();

    render(
      <ContextPanel
        sessionId="test-session-4b"
        projectWorkingDirs={["/Users/test/goose2"]}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /select worktree or branch/i }),
    );

    expect(screen.getByText("All branches")).toBeInTheDocument();
    expect(screen.getByText("Current branch").closest("button")).toBeDisabled();
    expect(getBranchButton("feat/context-panel")).toHaveTextContent(
      "~/goose2-feature",
    );
    expect(getBranchButton("dev")).toHaveTextContent("~/goose2");
    expect(getBranchButton("dev")).not.toBeDisabled();

    await user.click(getBranchButton("feat/context-panel")!);

    expect(
      screen.getByRole("button", { name: /select worktree or branch/i }),
    ).toHaveTextContent("~/goose2-feature");
    expect(
      screen.getByRole("button", { name: /select worktree or branch/i }),
    ).toHaveTextContent("feat/context-panel");
    expect(vi.mocked(gitApi.switchBranch)).not.toHaveBeenCalled();
  });

  it("shows all branches on non-main worktrees and routes untied branches through main", async () => {
    const user = userEvent.setup();

    mockUseGitState.mockReturnValue({
      data: {
        isGitRepo: true,
        currentBranch: "feat/context-panel",
        dirtyFileCount: 0,
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
        isWorktree: true,
        mainWorktreePath: "/Users/test/goose2",
        localBranches: ["feat/context-panel", "main", "dev"],
      },
      error: null,
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });

    render(
      <ContextPanel
        sessionId="test-session-4c"
        projectWorkingDirs={["/Users/test/goose2-feature"]}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /select worktree or branch/i }),
    );

    expect(screen.getByText("All branches")).toBeInTheDocument();
    expect(getBranchButton("main")).toHaveTextContent("~/goose2");
    expect(getBranchButton("dev")).toHaveTextContent("~/goose2");

    await user.click(screen.getByText("dev"));

    expect(vi.mocked(gitApi.switchBranch)).toHaveBeenCalledWith(
      "/Users/test/goose2",
      "dev",
    );
    expect(
      screen.getByRole("button", { name: /select worktree or branch/i }),
    ).toHaveTextContent("~/goose2");
    expect(
      screen.getByRole("button", { name: /select worktree or branch/i }),
    ).toHaveTextContent("dev");
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
        localBranches: ["main"],
      },
      error: null,
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });

    render(
      <ContextPanel
        sessionId="test-session-5"
        projectWorkingDirs={["/Users/test/goose2"]}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /select worktree or branch/i }),
    );

    expect(screen.getByText("Worktrees")).toBeInTheDocument();
    expect(screen.getByText("goose2")).toBeInTheDocument();
    expect(screen.getAllByText("main")[0]).toBeInTheDocument();
  });
});
