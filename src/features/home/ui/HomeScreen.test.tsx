import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HomeScreen } from "./HomeScreen";

vi.mock("@/shared/api/acp", () => ({
  discoverAcpProviders: vi.fn().mockResolvedValue([
    { id: "goose", label: "Goose" },
    { id: "claude", label: "Claude Code" },
  ]),
}));

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

  it("renders the chat input placeholder", async () => {
    render(<HomeScreen />);
    await vi.advanceTimersByTimeAsync(0);
    expect(
      screen.getByPlaceholderText("Ask Goose anything..."),
    ).toBeInTheDocument();
  });

  it("renders the provider selector with default provider", async () => {
    render(<HomeScreen />);
    await vi.advanceTimersByTimeAsync(0);
    expect(screen.getByText("Goose")).toBeInTheDocument();
  });
});
