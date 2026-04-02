import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TabBar } from "./TabBar";

describe("TabBar", () => {
  it("shows a spinner for running chats", () => {
    render(
      <TabBar
        tabs={[
          {
            id: "session-1",
            title: "Busy Chat",
            sessionId: "session-1",
            isRunning: true,
          },
        ]}
        activeTabId="session-1"
        onTabSelect={vi.fn()}
        onTabClose={vi.fn()}
        onNewTab={vi.fn()}
        onHomeClick={vi.fn()}
        onClearAllTabs={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/chat active/i)).toBeInTheDocument();
  });

  it("shows an unread indicator for unread chats", () => {
    render(
      <TabBar
        tabs={[
          {
            id: "session-1",
            title: "Unread Chat",
            sessionId: "session-1",
            hasUnread: true,
          },
        ]}
        activeTabId={null}
        onTabSelect={vi.fn()}
        onTabClose={vi.fn()}
        onNewTab={vi.fn()}
        onHomeClick={vi.fn()}
        onClearAllTabs={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/unread messages/i)).toBeInTheDocument();
  });
});
