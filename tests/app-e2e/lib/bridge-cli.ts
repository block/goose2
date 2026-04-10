#!/usr/bin/env tsx
import { createBridge } from "./bridge-client";

const [action, selector, value] = process.argv.slice(2);

if (!action) {
  console.log(`Usage:
  bridge snapshot
  bridge getText "h1"
  bridge count "button"
  bridge click "[data-tid='e1']"
  bridge fill "textarea" "hello"
  bridge keypress "textarea" Enter
  bridge waitForText "expected text"
  bridge scroll down|up|top|bottom
  bridge screenshot [output.png]`);
  process.exit(0);
}

try {
  const bridge = await createBridge();
  let result: string | number;

  if (action === "screenshot") {
    result = await bridge.screenshot(
      selector || `tests/app-e2e/screenshots/screenshot-${Date.now()}.png`,
    );
  } else if (action === "fill") {
    result = await bridge.fill(selector, value);
  } else if (action === "keypress") {
    result = await bridge.keypress(selector, value);
  } else if (action === "waitForText") {
    result = await bridge.waitForText(selector);
  } else if (action === "scroll") {
    result = await bridge.scroll(selector);
  } else if (action === "count") {
    result = await bridge.count(selector);
  } else if (action === "click") {
    result = await bridge.click(selector);
  } else if (action === "getText") {
    result = await bridge.getText(selector);
  } else if (action === "snapshot") {
    result = await bridge.snapshot();
  } else {
    console.error(`Unknown action: ${action}`);
    process.exit(1);
  }

  console.log(result);
  bridge.close();
} catch (err) {
  console.error("Error:", (err as Error).message);
  process.exit(1);
}
