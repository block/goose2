import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Message } from "@/shared/types/messages";
import { ArtifactPolicyProvider } from "../../hooks/ArtifactPolicyContext";
import { ToolCallCard } from "../ToolCallCard";

const { openPathMock, pathExistsMock } = vi.hoisted(() => ({
  openPathMock: vi.fn(),
  pathExistsMock: vi.fn().mockResolvedValue(true),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openPath: openPathMock,
}));

vi.mock("@/shared/api/system", () => ({
  pathExists: pathExistsMock,
}));

describe("ToolCallCard", () => {
  afterEach(() => {
    vi.useRealTimers();
    openPathMock.mockReset();
    pathExistsMock.mockReset();
    pathExistsMock.mockResolvedValue(true);
  });

  it("renders tool name", () => {
    render(<ToolCallCard name="readFile" arguments={{}} status="pending" />);
    expect(screen.getByText("readFile")).toBeInTheDocument();
  });

  it("shows spinner for executing status", () => {
    render(<ToolCallCard name="exec" arguments={{}} status="executing" />);
    // The Loader2 icon is rendered inside the pill button
    const button = screen.getByRole("button");
    const spinner = button.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("shows checkmark for completed status", () => {
    render(<ToolCallCard name="done" arguments={{}} status="completed" />);
    // Check icon rendered with text-green-500 class
    const button = screen.getByRole("button");
    const check = button.querySelector(".text-green-500");
    expect(check).toBeInTheDocument();
  });

  it("shows error icon for error status", () => {
    render(<ToolCallCard name="fail" arguments={{}} status="error" />);
    const button = screen.getByRole("button");
    const errorIcon = button.querySelector(".text-red-500");
    expect(errorIcon).toBeInTheDocument();
  });

  it("expands to show arguments and result when pill is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ToolCallCard
        name="tool"
        arguments={{ path: "/tmp/file.txt", recursive: true }}
        status="completed"
        result="file contents here"
      />,
    );

    // Content not visible initially
    expect(screen.queryByText(/\/tmp\/file\.txt/)).not.toBeInTheDocument();
    expect(screen.queryByText("file contents here")).not.toBeInTheDocument();

    // Click the pill to expand
    await user.click(screen.getByRole("button"));

    // Both arguments and result are visible in the expanded area
    expect(screen.getByText(/\/tmp\/file\.txt/)).toBeInTheDocument();
    expect(screen.getByText("file contents here")).toBeInTheDocument();
    expect(screen.getByText("Arguments")).toBeInTheDocument();
    expect(screen.getByText("Result")).toBeInTheDocument();
  });

  it("collapses when pill is clicked again", async () => {
    const user = userEvent.setup();
    render(
      <ToolCallCard
        name="tool"
        arguments={{ path: "/tmp/file.txt" }}
        status="completed"
      />,
    );

    const pill = screen.getByRole("button");
    await user.click(pill);
    expect(screen.getByText(/\/tmp\/file\.txt/)).toBeInTheDocument();

    await user.click(pill);
    expect(screen.queryByText(/\/tmp\/file\.txt/)).not.toBeInTheDocument();
  });

  it("does not expand when there is no content", async () => {
    const user = userEvent.setup();
    render(<ToolCallCard name="tool" arguments={{}} status="pending" />);

    const pill = screen.getByRole("button");
    await user.click(pill);

    // No expanded section should appear (no chevron either)
    expect(screen.queryByText("Arguments")).not.toBeInTheDocument();
    expect(screen.queryByText("Result")).not.toBeInTheDocument();
  });

  it("shows chevron only when there is expandable content", () => {
    const { container: withContent } = render(
      <ToolCallCard
        name="tool"
        arguments={{ path: "/tmp" }}
        status="completed"
      />,
    );
    // ChevronRight is rendered as an svg
    expect(withContent.querySelector("button svg:last-of-type")).toBeTruthy();
  });

  it("shows elapsed time for executing status after 3 seconds", () => {
    vi.useFakeTimers();
    render(<ToolCallCard name="exec" arguments={{}} status="executing" />);

    // No elapsed time initially
    expect(screen.queryByText(/\ds$/)).not.toBeInTheDocument();

    // Advance past 3 seconds
    act(() => {
      vi.advanceTimersByTime(3500);
    });
    expect(screen.getByText("3s")).toBeInTheDocument();
  });

  it("shows Error label when isError is true", async () => {
    const user = userEvent.setup();
    render(
      <ToolCallCard
        name="tool"
        arguments={{}}
        status="error"
        result="something went wrong"
        isError
      />,
    );

    await user.click(screen.getByRole("button"));
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("something went wrong")).toBeInTheDocument();
  });

  it("truncates long tool names and preserves the full name in the tooltip", () => {
    const longName =
      "veryLongToolNameThatShouldNotWrapAcrossMultipleLinesInTheChatUI";

    render(<ToolCallCard name={longName} arguments={{}} status="pending" />);

    expect(
      screen.getByText("veryLongToolNameThatShouldNotWrapAcrossMultiple…"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute("title", longName);
  });

  it("shows artifact open action only on the primary host tool card", async () => {
    const user = userEvent.setup();
    pathExistsMock.mockResolvedValue(true);
    const readArgs = { path: "/Users/test/project-a/notes.md" };
    const writeArgs = {
      paths: [
        "/Users/test/project-a/output/final_report.md",
        "/Users/test/project-a/output/extra_notes.md",
      ],
    };
    const messages: Message[] = [
      {
        id: "assistant-1",
        role: "assistant",
        created: Date.now(),
        content: [
          {
            type: "toolRequest",
            id: "tool-read",
            name: "read_file",
            arguments: readArgs,
            status: "completed",
          },
          {
            type: "toolRequest",
            id: "tool-write",
            name: "write_file",
            arguments: writeArgs,
            status: "completed",
          },
        ],
      },
    ];

    render(
      <ArtifactPolicyProvider
        messages={messages}
        allowedRoots={["/Users/test/project-a", "/Users/test/.goose/artifacts"]}
      >
        <div>
          <ToolCallCard
            name="read_file"
            arguments={readArgs}
            status="completed"
          />
          <ToolCallCard
            name="write_file"
            arguments={writeArgs}
            status="completed"
          />
        </div>
      </ArtifactPolicyProvider>,
    );

    expect(screen.getByText("More outputs (1)")).toBeInTheDocument();
    expect(screen.getAllByText("Open file")).toHaveLength(1);

    await user.click(screen.getByText("Open file"));
    expect(openPathMock).toHaveBeenCalledWith(
      "/Users/test/project-a/output/final_report.md",
    );
  });

  it("falls back to a later existing allowed candidate when the primary path is missing", async () => {
    const user = userEvent.setup();
    pathExistsMock.mockImplementation(async (path: string) => {
      return path === "/Users/test/.goose/artifacts/index.html";
    });
    const writeArgs = {};
    const messages: Message[] = [
      {
        id: "assistant-1",
        role: "assistant",
        created: Date.now(),
        content: [
          {
            type: "toolRequest",
            id: "tool-write",
            name: "Write index.html",
            arguments: writeArgs,
            status: "completed",
          },
          {
            type: "toolResponse",
            id: "tool-write",
            name: "Write index.html",
            result: "/Users/test/.goose/artifacts/index.html (new)",
            isError: false,
          },
        ],
      },
    ];

    render(
      <ArtifactPolicyProvider
        messages={messages}
        allowedRoots={["/Users/test/project-a", "/Users/test/.goose/artifacts"]}
      >
        <ToolCallCard
          name="Write index.html"
          arguments={writeArgs}
          status="completed"
        />
      </ArtifactPolicyProvider>,
    );

    await user.click(screen.getByText("Open file"));
    expect(openPathMock).toHaveBeenCalledWith(
      "/Users/test/.goose/artifacts/index.html",
    );
  });

  it("opens explicit write outputs outside default roots", async () => {
    const user = userEvent.setup();
    pathExistsMock.mockImplementation(async (path: string) => {
      return path === "/Users/test/coffee_shop_inventory.csv";
    });
    const writeArgs = {};
    const messages: Message[] = [
      {
        id: "assistant-1",
        role: "assistant",
        created: Date.now(),
        content: [
          {
            type: "toolRequest",
            id: "tool-write",
            name: "Write coffee_shop_inventory.csv",
            arguments: writeArgs,
            status: "completed",
          },
          {
            type: "toolResponse",
            id: "tool-write",
            name: "Write coffee_shop_inventory.csv",
            result: "/Users/test/coffee_shop_inventory.csv (new)",
            isError: false,
          },
        ],
      },
    ];

    render(
      <ArtifactPolicyProvider
        messages={messages}
        allowedRoots={["/Users/test/.goose/artifacts"]}
      >
        <ToolCallCard
          name="Write coffee_shop_inventory.csv"
          arguments={writeArgs}
          status="completed"
        />
      </ArtifactPolicyProvider>,
    );

    await user.click(screen.getByText("Open file"));
    expect(openPathMock).toHaveBeenCalledWith(
      "/Users/test/coffee_shop_inventory.csv",
    );
  });

  it("keeps secondary outputs collapsed until expanded", async () => {
    const user = userEvent.setup();
    const writeArgs = {
      paths: [
        "/Users/test/project-a/output/final_report.md",
        "/Users/test/project-a/output/extra_notes.md",
      ],
    };
    const messages: Message[] = [
      {
        id: "assistant-1",
        role: "assistant",
        created: Date.now(),
        content: [
          {
            type: "toolRequest",
            id: "tool-write",
            name: "write_file",
            arguments: writeArgs,
            status: "completed",
          },
        ],
      },
    ];

    render(
      <ArtifactPolicyProvider
        messages={messages}
        allowedRoots={["/Users/test/project-a", "/Users/test/.goose/artifacts"]}
      >
        <ToolCallCard
          name="write_file"
          arguments={writeArgs}
          status="completed"
        />
      </ArtifactPolicyProvider>,
    );

    expect(screen.getAllByText("Open file")).toHaveLength(1);
    await user.click(screen.getByText("More outputs (1)"));
    expect(screen.getAllByText("Open file")).toHaveLength(2);
  });

  it("keeps non-write candidates blocked outside allowed roots", () => {
    const readArgs = { path: "/Users/test/outside/final_report.md" };
    const messages: Message[] = [
      {
        id: "assistant-1",
        role: "assistant",
        created: Date.now(),
        content: [
          {
            type: "toolRequest",
            id: "tool-read",
            name: "read_file",
            arguments: readArgs,
            status: "completed",
          },
        ],
      },
    ];

    render(
      <ArtifactPolicyProvider
        messages={messages}
        allowedRoots={["/Users/test/project-a", "/Users/test/.goose/artifacts"]}
      >
        <ToolCallCard
          name="read_file"
          arguments={readArgs}
          status="completed"
        />
      </ArtifactPolicyProvider>,
    );

    const openButton = screen.getByText("Open file").closest("button");
    expect(openButton).toBeDisabled();
    expect(
      screen.getByText("Path is outside allowed project/artifacts roots."),
    ).toBeInTheDocument();
  });
});
