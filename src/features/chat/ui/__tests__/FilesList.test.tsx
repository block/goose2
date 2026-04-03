import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilesList } from "../FilesList";

const mockGetAllSessionArtifacts = vi.fn();
const mockOpenResolvedPath = vi.fn();

vi.mock("../../hooks/ArtifactPolicyContext", () => ({
  useArtifactPolicyContext: () => ({
    getAllSessionArtifacts: mockGetAllSessionArtifacts,
    openResolvedPath: mockOpenResolvedPath,
  }),
}));

const makeArtifact = (overrides: Record<string, unknown> = {}) => ({
  resolvedPath: "/Users/test/project/src/App.tsx",
  resolvedDirectoryPath: "/Users/test/project/src/",
  displayPath: "~/project/src/App.tsx",
  filename: "App.tsx",
  directoryPath: "~/project/src/",
  versionCount: 1,
  lastTouchedAt: 1000,
  kind: "file" as const,
  toolName: "Write",
  ...overrides,
});

describe("FilesList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOpenResolvedPath.mockResolvedValue(undefined);
  });

  it("shows empty state when no artifacts", () => {
    mockGetAllSessionArtifacts.mockReturnValue([]);
    render(<FilesList />);
    expect(screen.getByText("No files yet")).toBeInTheDocument();
  });

  it("renders file rows with filename and directory", () => {
    mockGetAllSessionArtifacts.mockReturnValue([makeArtifact()]);
    render(<FilesList />);
    expect(screen.getByText("App.tsx")).toBeInTheDocument();
    expect(screen.getByText("~/project/src/")).toBeInTheDocument();
  });

  it("shows version badge when versionCount > 1", () => {
    mockGetAllSessionArtifacts.mockReturnValue([
      makeArtifact({ versionCount: 3 }),
    ]);
    render(<FilesList />);
    expect(screen.getByText("v3")).toBeInTheDocument();
  });

  it("does not show version badge when versionCount is 1", () => {
    mockGetAllSessionArtifacts.mockReturnValue([makeArtifact()]);
    render(<FilesList />);
    expect(screen.queryByText("v1")).not.toBeInTheDocument();
  });

  it("calls openResolvedPath with file path when row is clicked", async () => {
    const user = userEvent.setup();
    mockGetAllSessionArtifacts.mockReturnValue([makeArtifact()]);
    render(<FilesList />);
    await user.click(screen.getByText("App.tsx"));
    expect(mockOpenResolvedPath).toHaveBeenCalledWith(
      "/Users/test/project/src/App.tsx",
    );
  });

  it("calls openResolvedPath with directory when directory path is clicked", async () => {
    const user = userEvent.setup();
    mockGetAllSessionArtifacts.mockReturnValue([makeArtifact()]);
    render(<FilesList />);
    await user.click(screen.getByText("~/project/src/"));
    expect(mockOpenResolvedPath).toHaveBeenCalledWith(
      "/Users/test/project/src/",
    );
  });

  it("filters files by filename", async () => {
    const user = userEvent.setup();
    mockGetAllSessionArtifacts.mockReturnValue([
      makeArtifact({ filename: "App.tsx", resolvedPath: "/a/App.tsx" }),
      makeArtifact({ filename: "index.ts", resolvedPath: "/a/index.ts" }),
    ]);
    render(<FilesList />);

    const input = screen.getByPlaceholderText("Filter files...");
    await user.type(input, "index");

    expect(screen.queryByText("App.tsx")).not.toBeInTheDocument();
    expect(screen.getByText("index.ts")).toBeInTheDocument();
  });

  it("shows no matching files message when filter has no results", async () => {
    const user = userEvent.setup();
    mockGetAllSessionArtifacts.mockReturnValue([makeArtifact()]);
    render(<FilesList />);

    const input = screen.getByPlaceholderText("Filter files...");
    await user.type(input, "nonexistent");

    expect(screen.getByText("No matching files")).toBeInTheDocument();
  });

  it("does not show search bar when no artifacts exist", () => {
    mockGetAllSessionArtifacts.mockReturnValue([]);
    render(<FilesList />);
    expect(
      screen.queryByPlaceholderText("Filter files..."),
    ).not.toBeInTheDocument();
  });
});
