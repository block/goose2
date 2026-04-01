import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContextPanel } from "../ContextPanel";

describe("ContextPanel", () => {
  it("opens with details tab and supports switching to files tab", async () => {
    const user = userEvent.setup();

    render(
      <ContextPanel
        projectName="Desktop UX"
        projectColor="#22c55e"
        projectWorkingDir="/Users/tulsi/Documents/GitHub/goose2"
      />,
    );

    await user.click(screen.getByRole("button", { name: /context/i }));

    expect(
      screen.getByRole("button", { name: /details/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /files/i })).toBeInTheDocument();
    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(screen.getByText("Desktop UX")).toBeInTheDocument();
    expect(
      screen.getByText(/Not wired yet in goose2: running\/background process/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Not wired yet in goose2: configured MCP server discovery/i,
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /files/i }));

    expect(screen.getByText("Files for this session")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Not wired yet in goose2: artifact list and file opening behavior/i,
      ),
    ).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();

    render(<ContextPanel />);

    await user.click(screen.getByRole("button", { name: /context/i }));
    expect(
      screen.getByRole("button", { name: /details/i }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("button", { name: /details/i }),
    ).not.toBeInTheDocument();
  });
});
