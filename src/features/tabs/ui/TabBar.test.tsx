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

  it("shows close-all button only when tabs exist", () => {
    const { rerender } = render(
      <TabBar
        tabs={[]}
        activeTabId={null}
        onTabSelect={vi.fn()}
        onTabClose={vi.fn()}
        onNewTab={vi.fn()}
        onHomeClick={vi.fn()}
        onClearAllTabs={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText(/close all tabs/i)).not.toBeInTheDocument();

    rerender(
      <TabBar
        tabs={[
          {
            id: "session-1",
            title: "Some Chat",
            sessionId: "session-1",
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

    expect(screen.getByLabelText(/close all tabs/i)).toBeInTheDocument();
  });
});
