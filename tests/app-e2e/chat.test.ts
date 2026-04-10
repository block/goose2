import { describe, it, expect } from "vitest";
import { useBridge } from "./lib/setup";

describe("Chat", () => {
  const bridge = useBridge();

  it("returns formatted date when asked", async () => {
    await bridge.fill(
      'textarea[placeholder*="Message Goose"]',
      'Show me the date of Jan 26 2025 in format of "dd-mm-yyyy"',
    );
    await bridge.keypress('textarea[placeholder*="Message Goose"]', "Enter");

    const bodyText = await bridge.waitForText("26-01-2025", {
      timeout: 30000,
    });
    expect(bodyText).toContain("26-01-2025");
  });
});
