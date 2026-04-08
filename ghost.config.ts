import { defineConfig } from "@ghost/core";

export default defineConfig({
  designSystems: [
    {
      name: "goose2",
      // TODO: Switch to https://block.github.io/ghost/registry.json once
      // block/ghost#25 lands and the Pages deploy includes registry.json.
      // Tracking: https://github.com/block/ghost/pull/25
      registry:
        "https://raw.githubusercontent.com/block/ghost/main/packages/ghost-ui/registry.json",
      componentDir: "src/shared/ui",
      styleEntry: "src/shared/styles/globals.css",
    },
  ],
  scan: {
    values: true,
    structure: true,
    visual: false,
    analysis: false,
  },
  rules: {
    "hardcoded-color": "error",
    "token-override": "warn",
    "missing-token": "warn",
    "structural-divergence": "error",
    "missing-component": "warn",
  },
});
