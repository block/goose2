import { defineConfig } from "@ghost/core";

export default defineConfig({
  designSystems: [
    {
      name: "goose2",
      registry: "https://block.github.io/ghost/registry.json",
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
