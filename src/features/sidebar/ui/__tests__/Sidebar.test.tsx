import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "../Sidebar";

vi.mock("@/features/chat/stores/chatStore", () => ({
  useChatStore: () => ({
    getSessionRuntime: () => ({
      chatState: "idle",
      hasUnread: false,
    }),
  }),
}));

vi.mock("@/features/chat/stores/chatSessionStore", () => ({
  useChatSessionStore: () => ({
    sessions: [],
  }),
}));

describe("Sidebar", () => {
  it("renders a home button in the sidebar header and navigates home", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(
      <Sidebar
        collapsed={false}
        onCollapse={vi.fn()}
        onNavigate={onNavigate}
        projects={[]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /home/i }));

    expect(onNavigate).toHaveBeenCalledWith("home");
  });

  it("keeps the home button visible when the sidebar is collapsed", () => {
    render(
      <Sidebar
        collapsed
        onCollapse={vi.fn()}
        onNavigate={vi.fn()}
        projects={[]}
      />,
    );

    expect(screen.getByRole("button", { name: /home/i })).toBeInTheDocument();
  });
});
