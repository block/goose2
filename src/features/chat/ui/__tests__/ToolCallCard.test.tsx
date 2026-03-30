import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToolCallCard } from "../ToolCallCard";

describe("ToolCallCard", () => {
  it("renders tool name", () => {
    render(<ToolCallCard name="readFile" arguments={{}} status="pending" />);
    expect(screen.getByText("readFile")).toBeInTheDocument();
  });

  it("shows spinner for executing status", () => {
    render(<ToolCallCard name="exec" arguments={{}} status="executing" />);
    const icon = screen.getByLabelText("executing");
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass("animate-spin");
  });

  it("shows checkmark for completed status", () => {
    render(<ToolCallCard name="done" arguments={{}} status="completed" />);
    expect(screen.getByLabelText("completed")).toBeInTheDocument();
  });

  it("shows error icon for error status", () => {
    render(<ToolCallCard name="fail" arguments={{}} status="error" />);
    expect(screen.getByLabelText("error")).toBeInTheDocument();
  });

  it("expands arguments on click", async () => {
    const user = userEvent.setup();
    render(
      <ToolCallCard
        name="tool"
        arguments={{ path: "/tmp/file.txt", recursive: true }}
        status="completed"
      />,
    );

    const argsButton = screen.getByRole("button", { name: /arguments/i });
    expect(argsButton).toHaveAttribute("aria-expanded", "false");

    await user.click(argsButton);
    expect(argsButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/\/tmp\/file\.txt/)).toBeInTheDocument();
  });

  it("shows result when available", async () => {
    const user = userEvent.setup();
    render(
      <ToolCallCard
        name="tool"
        arguments={{}}
        status="completed"
        result="file contents here"
      />,
    );

    const resultButton = screen.getByRole("button", { name: /result/i });
    await user.click(resultButton);
    expect(screen.getByText("file contents here")).toBeInTheDocument();
  });
});
