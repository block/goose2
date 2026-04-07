# Session Management Features — Design Spec

**Date:** 2026-04-07
**Scope:** Session History view, Search-as-you-type, Smart session naming
**Out of scope:** Open in new window, import/export, fork (deferred)

---

## 1. Session History View

### Overview

A dedicated "Session History" page accessible from a new sidebar nav item. Displays all sessions (active and archived) in a responsive card grid grouped by date. Follows the same layout conventions as `ProjectsView`.

### Navigation

- New sidebar nav item labeled **"Session History"** added to the `NAV_ITEMS` array in `Sidebar.tsx`
- Positioned after the existing nav items (Home, Personas, Skills)
- New `AppView` variant: `"session-history"`
- Routed through `AppShell.tsx` like other views

### Layout

```
┌─────────────────────────────────────────┐
│  Session History                        │
│  Browse and search past sessions        │
│                                         │
│  [────── Search sessions... ──────────] │
│                                         │
│  Today                                  │
│  ┌──────┐ ┌──────┐ ┌──────┐            │
│  │ Card │ │ Card │ │ Card │            │
│  └──────┘ └──────┘ └──────┘            │
│                                         │
│  Yesterday                              │
│  ┌──────┐ ┌──────┐                      │
│  │ Card │ │ Card │                      │
│  └──────┘ └──────┘                      │
└─────────────────────────────────────────┘
```

- Wrapper: `max-w-5xl mx-auto w-full px-6 py-8` (matches `ProjectsView`)
- Header: `text-lg font-semibold font-display tracking-tight` for title
- Card grid: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` with `gap-3`
- Date group headers: sticky, same typography as sidebar section headers

### Session Card

Each card displays:

| Field | Source | Display |
|-------|--------|---------|
| Title | `session.title` | `line-clamp-2`, primary text |
| Updated date | `session.updatedAt` | Relative format ("2h ago", "Yesterday") |
| Message count | `session.messageCount` | Icon + count |
| Persona | `session.personaId` → agent store lookup | Name text, omitted if none |
| Project | `session.projectId` → project store lookup | Color dot + name, omitted if none |
| Working directory | Project's `workingDirs[0]` | Truncated path, only for project-scoped sessions |

Archived sessions are visually distinguished with reduced opacity (`opacity-60`) and an "Archived" text label in `text-muted-foreground text-xs`.

Card styling uses design tokens:
- `border border-border rounded-lg`
- `shadow-card` on hover
- `bg-background` base
- `text-muted-foreground` for metadata

### Card Actions (on hover)

- **Open**: Navigate to chat view (click anywhere on card)
- **Rename**: Inline edit (same mechanism as `SidebarChatRow`)
- **Archive/Unarchive**: Toggle archive status

### Data Source

- Active sessions: `useChatSessionStore` (already loaded)
- Archived sessions: `listArchivedSessions()` API call on mount
- Combined into a single sorted list, then grouped by date

### Date Grouping

Utility function `groupSessionsByDate(sessions)` in `src/features/sessions/lib/groupSessionsByDate.ts`:
- **Today** — sessions updated today
- **Yesterday** — sessions updated yesterday
- **Full date** (e.g., "March 28, 2026") — all other sessions, grouped by calendar day
- Sorted newest-first within each group

### File Structure

```
src/features/sessions/
  ui/
    SessionHistoryView.tsx    — Main page component
    SessionCard.tsx           — Individual session card
  lib/
    groupSessionsByDate.ts    — Date grouping utility
    filterSessions.ts         — Shared search/filter logic
  hooks/
    useSessionAutoTitle.ts    — Smart naming hook
```

---

## 2. Search-as-you-type

### Overview

Client-side filtering of sessions by metadata fields. Available in two locations: the Session History page and the sidebar.

### Searchable Fields

The filter matches against a concatenated searchable string per session:
- Session title
- Persona name (resolved from `personaId` via agent store)
- Project name (resolved from `projectId` via project store)
- Formatted date string (so "March" or "yesterday" matches)

Matching is case-insensitive `includes()` — same approach as `ProjectsView`.

### Shared Filter Utility

`filterSessions(sessions, query, resolvers)` in `src/features/sessions/lib/filterSessions.ts`

```typescript
interface FilterResolvers {
  getPersonaName: (personaId: string) => string | undefined;
  getProjectName: (projectId: string) => string | undefined;
}

function filterSessions(
  sessions: ChatSession[],
  query: string,
  resolvers: FilterResolvers
): ChatSession[];
```

Both the Session History view and sidebar use this same function.

### Session History Page

- Uses existing `SearchBar` component
- Filters the combined active + archived session list
- Updates the date-grouped display reactively
- Empty state: "No matching sessions" with suggestion to try a different term

### Sidebar

- Uncomment the existing search bar markup in `Sidebar.tsx` (lines 306-341)
- Wire `onChange` to filter sessions passed to `SidebarProjectsSection`
- Projects remain visible if any child session matches OR the project name matches
- Filter state is local to the sidebar (not persisted)
- Keyboard shortcut `Cmd+K` focuses the search input

### Deferred

Full-text message search is not included in this scope. The `filterSessions` utility is designed to accept additional search callbacks in the future without breaking the existing interface.

---

## 3. Smart Session Naming

### Overview

AI-generated session titles after the first exchange completes. Replaces the current behavior of using "New Chat" or the first 100 characters of the first message.

### Trigger Flow

1. User sends first message, assistant streams response
2. `useChat` hook detects stream completion (`chatState`: `"streaming"` → `"idle"`)
3. `useSessionAutoTitle` hook checks:
   - `messageCount === 2` (1 user + 1 assistant)
   - `session.userSetName !== true`
4. Frontend calls: `invoke("generate_session_title", { sessionId })`
5. Backend returns generated title
6. Frontend updates: `sessionStore.updateSession(id, { title, userSetName: false })`
7. Sidebar and history view reactively update via Zustand

### Session Model Change

Add `userSetName` field to `ChatSession`:

```typescript
interface ChatSession {
  // ... existing fields
  userSetName?: boolean; // true when user manually renamed; prevents auto-naming
}
```

- Defaults to `false` (or `undefined`, treated as `false`)
- Set to `true` when the user renames via sidebar or history view
- Auto-naming is skipped when `userSetName === true`

### Naming Prompt

- Input: first user message + first assistant response (text content only)
- Instruction: generate a concise, descriptive title of **7 words or fewer**
- Style: noun-phrase or short description, no punctuation, no markdown, no quotes
- Examples: "Fix sidebar resize snap behavior", "Add pagination to REST API", "Debug auth token expiration issue"

### Backend Command

`generate_session_title(sessionId: String) -> String`

- Reads first 2 messages from the session
- Calls the configured LLM provider with the naming prompt
- Returns the generated title string
- **Fallback on failure:** first 50 characters of the user's first message (better than "New Chat")

### Hook

`useSessionAutoTitle(sessionId)` in `src/features/sessions/hooks/useSessionAutoTitle.ts`

- Called from `ChatView`
- Watches `chatState` and `messageCount` for the given session
- Fires once per session lifecycle (first exchange only)
- Isolated from core `useChat` streaming logic

### Interaction with Manual Rename

- Manual rename (sidebar or history view) sets `userSetName: true`
- Auto-naming checks this flag and skips if `true`
- If a user renames then clears the title, `userSetName` remains `true` — no re-triggering

---

## Dependencies Between Features

```
Smart Naming ──► better titles ──► more useful Search & History cards
                                        │
Sidebar Search ◄── shared filterSessions ──► History Search
```

Recommended build order:
1. **Smart naming** — improves all downstream features
2. **Session History view** — the main new page
3. **Sidebar search** — reuses filter logic from history view

---

## Design Tokens Reference

All new UI uses existing tokens from `globals.css`:

| Usage | Token |
|-------|-------|
| Card background | `bg-background` |
| Card border | `border border-border` |
| Card radius | `rounded-lg` |
| Card hover shadow | `shadow-card` |
| Primary text | `text-foreground` |
| Secondary text | `text-muted-foreground` |
| Date group headers | `text-sm font-medium text-muted-foreground` |
| Search input | `SearchBar` component (uses `border-input`, `bg-background`) |
| Empty state icon | `opacity-30` on lucide icon |

No new tokens needed.
