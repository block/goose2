import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HomeScreen } from "./HomeScreen";

// Mock the ThemeProvider since HomeScreen doesn't use it directly
// but its children might
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

  it("renders the chat input placeholder", () => {
    render(<HomeScreen />);
    expect(screen.getByText("Ask Goose anything...")).toBeInTheDocument();
  });

  it("renders the model badge", () => {
    render(<HomeScreen />);
    expect(screen.getByText("Claude Sonnet 4")).toBeInTheDocument();
  });
});
