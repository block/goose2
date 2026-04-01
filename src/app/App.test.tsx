import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

vi.mock("@/app/AppShell", () => ({
  AppShell: () => <div data-testid="app-shell" />,
}));

describe("App", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prevents default window navigation when files are dragged into the app", () => {
    vi.stubGlobal("__TAURI_INTERNALS__", undefined);

    render(<App />);

    const dragOverEvent = new Event("dragover", {
      bubbles: true,
      cancelable: true,
    });
    const dropEvent = new Event("drop", {
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(dragOverEvent);
    window.dispatchEvent(dropEvent);

    expect(dragOverEvent.defaultPrevented).toBe(true);
    expect(dropEvent.defaultPrevented).toBe(true);
  });
});
