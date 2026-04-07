import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SessionCard } from "../SessionCard";

describe("SessionCard", () => {
  const defaultProps = {
    id: "s1",
    title: "Fix sidebar bug",
    updatedAt: new Date().toISOString(),
    messageCount: 12,
    onSelect: vi.fn(),
  };

  it("renders title and message count", () => {
    render(<SessionCard {...defaultProps} />);

    expect(screen.getByText("Fix sidebar bug")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("renders persona name when provided", () => {
    render(<SessionCard {...defaultProps} personaName="Code Assistant" />);

    expect(screen.getByText("Code Assistant")).toBeInTheDocument();
  });

  it("renders project name with color dot when provided", () => {
    render(
      <SessionCard
        {...defaultProps}
        projectName="My Project"
        projectColor="#3b82f6"
      />,
    );

    expect(screen.getByText("My Project")).toBeInTheDocument();
  });

  it("calls onSelect when clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<SessionCard {...defaultProps} onSelect={onSelect} />);

    await user.click(screen.getByText("Fix sidebar bug"));

    expect(onSelect).toHaveBeenCalledWith("s1");
  });

  it("shows archived styling when archivedAt is set", () => {
    const { container } = render(
      <SessionCard {...defaultProps} archivedAt="2026-04-01T00:00:00Z" />,
    );

    expect(container.firstChild).toHaveClass("opacity-60");
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });
});
