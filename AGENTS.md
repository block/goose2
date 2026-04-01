# AGENTS.md

Guidelines for AI agents (and developers) working on this codebase.

## Project Overview

Goose2 is a Tauri 2 + React 19 desktop app. It uses TypeScript strict mode, Vite, and Tailwind CSS 3. The codebase follows a feature-sliced architecture organized under `src/app/`, `src/features/`, and `src/shared/`.

## Architecture & File Structure

```
src/
  app/           — App shell, entry point, top-level providers
  features/      — Feature modules (see Feature Organization below)
    <feature>/
      ui/        — React components (required)
      hooks/     — Custom React hooks for feature logic (when needed)
      stores/    — Zustand state management (when feature needs shared state)
      api/       — Backend API integration (when feature calls backend)
      types.ts   — Feature-specific type definitions (when needed)
  shared/
    types/       — Canonical shared type definitions (single source of truth)
      agents.ts  — Agent, Persona, Provider types
      chat.ts    — ChatState, TokenState, Session, SSE events
      messages.ts — Message, MessageContent, type guards
    ui/          — Reusable UI components (button, etc.)
    lib/         — Utilities (cn.ts for class merging)
    theme/       — Theme provider, appearance settings
    styles/      — Global CSS, design tokens
    hooks/       — Shared hooks
    api/         — API integration
    constants/   — Shared constants
    context/     — Shared contexts
```

### Feature Organization

Not every feature needs every subdirectory. Use only what the feature requires:

| Pattern              | Structure                        | Examples             |
|----------------------|----------------------------------|----------------------|
| **Full-featured**    | `stores/` + `hooks/` + `ui/`    | agents, chat         |
| **Data-driven**      | `stores/` + `api/` + `ui/`      | projects             |
| **API features**     | `api/` + `ui/`                   | skills               |
| **Simple features**  | `ui/` only                       | home, settings, sidebar, status |
| **Tabs**             | `ui/` + `types.ts`               | tabs                 |

### Import Rules for Features

- Shared types live in `src/shared/types/` — this is the single source of truth for cross-feature types.
- There should be NO root-level `src/stores/` or `src/types/` directories.
- Feature stores use feature-relative imports (e.g., `../stores/featureStore`).
- Cross-feature imports use `@/features/*/stores/` or `@/shared/types/`.

## Coding Conventions

- Use `cn()` from `@/shared/lib/cn` for Tailwind class merging.
- Import paths use the `@/` alias (maps to `./src`).
- Components are controlled where possible (state lifted to parent).
- Use `lucide-react` for icons.
- All `<button>` elements must have `type="button"` to prevent form submission.
- Use semantic HTML (`<aside>`, `<nav>`, `<header>`, `<main>`).

## Theming System

ThemeProvider manages three axes:

| Axis         | Values                          | Persistence     | Mechanism                                    |
|--------------|---------------------------------|-----------------|----------------------------------------------|
| Theme mode   | `light`, `dark`, `system`       | localStorage    | `.dark` class on `<html>`                    |
| Accent color | Any hex value                   | localStorage    | `--color-accent` CSS variable                |
| Density      | `compact`, `comfortable`, `spacious` | localStorage | `--density-spacing` CSS variable (0.75/1/1.25) |

- CSS variables are defined in `globals.css` with light/dark variants.
- Tailwind config maps CSS variables to semantic color names.
- Color palette tokens: `background` (primary/secondary/tertiary), `foreground` (primary/secondary/tertiary), `border`, `ring`, plus semantic variants (`info`, `danger`, `success`, `warning`).

## Component Patterns

- Small, focused components — aim for under 200 lines.
- Props interfaces live in the component file, or in `types.ts` for shared types.
- Use `forwardRef` for components that need ref forwarding (React 19 makes this optional, but the pattern is still used).
- Animations: CSS transitions via Tailwind classes; respect `prefers-reduced-motion`.
- Entrance animations: use the `isLoaded` state pattern with `useEffect` + short timeout.

## Accessibility

- ARIA roles on interactive elements (`role="tab"`, `role="tablist"`, `role="status"`).
- `aria-label` on icon-only buttons.
- `aria-hidden` on visually hidden content.
- `aria-selected` on selectable items.
- Color-only indicators must have text alternatives.
- `prefers-reduced-motion` is respected globally.

## Tauri Integration

- The window starts hidden and is shown via `getCurrentWindow().show()` after React mounts.
- Use `data-tauri-drag-region` on header areas for window dragging.
- Title bar uses `titleBarStyle: "Overlay"` with `hiddenTitle: true` for a custom titlebar.
- `tauri-plugin-window-state` persists window size and position.
- Traffic light offset: `pl-20` (80px) to accommodate macOS window controls.

## Backend Architecture

All AI communication goes through **ACP (Agent Communication Protocol)**:
- The Rust backend spawns ACP agent binaries as child processes and communicates via **stdin/stdout JSON-RPC**.
- Responses stream back to the frontend through **Tauri events** (`acp:text`, `acp:tool_call`, `acp:tool_result`, `acp:done`, etc.).
- The frontend listens to these events via `@tauri-apps/api/event` (see `useAcpStream` hook).

For non AI communication, such as configuration:
- Use **Tauri commands** (`invoke()` from `@tauri-apps/api/core`) for request/response operations (sessions, personas, skills, projects, etc.).
- Use **Tauri events** (`listen()` from `@tauri-apps/api/event`) for streaming data from ACP.
- Do **not** add HTTP fetch calls to a backend server, `apiFetch` utilities, or sidecar process management.

## Tooling

| Tool        | Purpose                                        |
|-------------|-------------------------------------------------|
| **Hermit**  | Manages toolchain (node, pnpm, biome, just, lefthook) |
| **Just**    | Task runner (`just dev`, `just build`, `just check`) |
| **Lefthook**| Git hooks (pre-commit, pre-push)               |
| **Biome**   | Linting and formatting                          |
| **pnpm**    | Package manager                                 |

## Testing (Planned)

- E2E tests with Playwright or similar.
- Component tests with Vitest + React Testing Library.
- File size enforcement via `scripts/check-file-sizes.mjs`.

## Key Dependencies

- `react` 19.1, `react-dom` 19.1
- `@tauri-apps/api` 2.x
- `@tanstack/react-query` 5.x
- `tailwindcss` 3.x with `tailwindcss-animate`
- `lucide-react` for icons
- `class-variance-authority` for component variants
- `clsx` + `tailwind-merge` for class merging
- `@radix-ui/react-slot` for polymorphic components

## Don'ts

- Don't import from `../` across feature boundaries — use `@/` paths.
- Don't put business logic in UI components — extract to hooks or utilities.
- Don't use inline styles except for dynamic values (like animation delays).
- Don't add dependencies without checking if an existing one covers the need.
- Don't skip `type="button"` on buttons.
- Don't use color-only indicators without text alternatives.
- Never use `--no-verify` when pushing — fix the underlying lint/hook issues.
- Don't create root-level `src/types/` or `src/stores/` directories — types belong in `src/shared/types/`, stores belong in `src/features/<feature>/stores/`.
- Don't duplicate type definitions across files — each type has one canonical location.
- Don't add a goosed sidecar, HTTP fetch utilities, or any backend HTTP server — all backend communication uses Tauri commands and ACP via stdin/stdout.
