import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  onTestFailed,
} from "vitest";
import { type Bridge, createBridge } from "./lib/bridge-client";

declare const __SCREENSHOT_DIR__: string;
declare const __SCREENSHOT_ON_FAILURE__: boolean;

describe("Home Screen", () => {
  let bridge: Bridge;

  beforeAll(async () => {
    bridge = await createBridge();
  });

  afterAll(() => {
    bridge?.close();
  });

  beforeEach(() => {
    if (__SCREENSHOT_ON_FAILURE__) {
      onTestFailed(async ({ task }) => {
        const name = task.name.replace(/\s+/g, "-").toLowerCase();
        const path = `${__SCREENSHOT_DIR__}/fail-${name}-${Date.now()}.png`;
        await bridge.screenshot(path);
        console.log(`Screenshot saved: ${path}`);
      });
    }
  });

  it("shows a time-based greeting", async () => {
    const text = await bridge.getText("body");
    expect(text).toMatch(/Good (morning|afternoon|evening)/);
  });

  it("has a chat input", async () => {
    const count = await bridge.count("textarea");
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
