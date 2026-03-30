import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToolCallCard } from "../ToolCallCard";

describe("ToolCallCard", () => {
  afterEach(() => {
    vi.useRealTimers();
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
});
