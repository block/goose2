# Session Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add session history view, search-as-you-type filtering, and AI-generated session naming to goose2.

**Architecture:** Three vertical slices built in dependency order: (1) smart naming adds `userSetName` to the session model, a backend Tauri command, and a frontend hook; (2) session history view adds a new `AppView` route, card grid component, and date grouping utility; (3) sidebar search uncomments and wires the existing search bar markup using a shared filter utility also used by the history view.

**Tech Stack:** React 19, TypeScript, Zustand, Tailwind CSS 4, Tauri 2 IPC, Vitest + React Testing Library

---

## File Map

### New files

| File | Responsibility |
|------|---------------|
| `src/features/sessions/lib/groupSessionsByDate.ts` | Groups sessions into labeled date buckets (Today, Yesterday, full date) |
| `src/features/sessions/lib/groupSessionsByDate.test.ts` | Tests for date grouping |
| `src/features/sessions/lib/filterSessions.ts` | Shared metadata filter used by history view and sidebar |
| `src/features/sessions/lib/filterSessions.test.ts` | Tests for filter utility |
| `src/features/sessions/ui/SessionHistoryView.tsx` | Full-page session history with card grid and search |
| `src/features/sessions/ui/SessionCard.tsx` | Individual session card component |
| `src/features/sessions/ui/__tests__/SessionCard.test.tsx` | Tests for session card rendering and actions |
| `src/features/sessions/hooks/useSessionAutoTitle.ts` | Hook that triggers AI title generation after first exchange |
| `src/features/sessions/hooks/__tests__/useSessionAutoTitle.test.ts` | Tests for auto-title hook |

### Modified files

| File | Change |
|------|--------|
| `src/shared/types/chat.ts` | Add `userSetName?: boolean` to `Session` interface |
| `src/features/chat/stores/chatSessionStore.ts` | Add `userSetName` to `ChatSession`, pass through in `sessionToChatSession`, include in `updateSession` backend patch |
| `src/shared/api/chat.ts` | Add `generateSessionTitle(sessionId)` API function, add `userSetName` to `updateSession` parameter type |
| `src/features/chat/ui/ChatView.tsx` | Call `useSessionAutoTitle` hook |
| `src/app/AppShell.tsx` | Add `"session-history"` to `AppView`, render `SessionHistoryView`, update `handleRenameChat` to set `userSetName: true` |
| `src/features/sidebar/ui/Sidebar.tsx` | Add "Session History" nav item, uncomment search bar, wire filter |

---

## Task 1: Add `userSetName` to session model

**Files:**
- Modify: `src/shared/types/chat.ts:50-63`
- Modify: `src/features/chat/stores/chatSessionStore.ts:14-27,95-109,206-235`

- [ ] **Step 1: Add `userSetName` to the backend `Session` type**

In `src/shared/types/chat.ts`, add the field to the `Session` interface:

```typescript
export interface Session {
  id: string;
  title: string;
  agentId?: string;
  projectId?: string | null;
  providerId?: string;
  personaId?: string;
  modelName?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  messageCount: number;
  userSetName?: boolean;
}
```

- [ ] **Step 2: Add `userSetName` to the frontend `ChatSession` type**

In `src/features/chat/stores/chatSessionStore.ts`, add the field to `ChatSession`:

```typescript
export interface ChatSession {
  id: string;
  title: string;
  projectId?: string | null;
  agentId?: string;
  providerId?: string;
  personaId?: string;
  modelName?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  messageCount: number;
  draft?: boolean;
  userSetName?: boolean;
}
```

- [ ] **Step 3: Pass `userSetName` through in `sessionToChatSession`**

In the same file, update the mapping function:

```typescript
function sessionToChatSession(session: Session): ChatSession {
  return {
    id: session.id,
    title: session.title,
    agentId: session.agentId,
    projectId: session.projectId,
    providerId: session.providerId,
    personaId: session.personaId,
    modelName: session.modelName,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    archivedAt: session.archivedAt,
    messageCount: session.messageCount,
    userSetName: session.userSetName,
  };
}
```

- [ ] **Step 4: Include `userSetName` in the `updateSession` backend patch**

In `src/features/chat/stores/chatSessionStore.ts`, update the `updateSession` action's `backendPatch` type and logic to include `userSetName`:

```typescript
const backendPatch: {
  title?: string;
  providerId?: string;
  personaId?: string;
  modelName?: string;
  projectId?: string | null;
  userSetName?: boolean;
} = {};
if (patch.title) backendPatch.title = patch.title;
if (patch.providerId) backendPatch.providerId = patch.providerId;
if (patch.personaId) backendPatch.personaId = patch.personaId;
if (patch.modelName) backendPatch.modelName = patch.modelName;
if ("projectId" in patch) {
  backendPatch.projectId = patch.projectId ?? null;
}
if ("userSetName" in patch) {
  backendPatch.userSetName = patch.userSetName;
}
```

- [ ] **Step 5: Run typecheck to verify**

Run: `cd /Users/tulsi/Documents/GitHub/goose2 && pnpm typecheck`
Expected: PASS with no errors

- [ ] **Step 6: Commit**

```bash
git add src/shared/types/chat.ts src/features/chat/stores/chatSessionStore.ts
git commit -m "feat: add userSetName field to session model"
```

---

## Task 2: Set `userSetName: true` on manual rename

**Files:**
- Modify: `src/app/AppShell.tsx:274-279`

- [ ] **Step 1: Update `handleRenameChat` to set the flag**

In `src/app/AppShell.tsx`, update the `handleRenameChat` callback:

```typescript
const handleRenameChat = useCallback(
  (sessionId: string, nextTitle: string) => {
    sessionStore.updateSession(sessionId, {
      title: nextTitle,
      userSetName: true,
    });
  },
  [sessionStore],
);
```

- [ ] **Step 2: Run typecheck**

Run: `cd /Users/tulsi/Documents/GitHub/goose2 && pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/AppShell.tsx
git commit -m "feat: set userSetName flag on manual session rename"
```

---

## Task 3: Add `generateSessionTitle` API function

**Files:**
- Modify: `src/shared/api/chat.ts`

- [ ] **Step 1: Add `userSetName` to the `updateSession` parameter type**

In `src/shared/api/chat.ts`, update the `updateSession` function signature:

```typescript
export async function updateSession(
  sessionId: string,
  update: {
    title?: string;
    providerId?: string;
    personaId?: string;
    modelName?: string;
    projectId?: string | null;
    userSetName?: boolean;
  },
): Promise<void> {
  return invoke("update_session", { sessionId, update });
}
```

- [ ] **Step 2: Add the `generateSessionTitle` API function**

Append to `src/shared/api/chat.ts`:

```typescript
export async function generateSessionTitle(
  sessionId: string,
): Promise<string> {
  return invoke("generate_session_title", { sessionId });
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd /Users/tulsi/Documents/GitHub/goose2 && pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/shared/api/chat.ts
git commit -m "feat: add generateSessionTitle API function"
```

---

## Task 4: Build `useSessionAutoTitle` hook

**Files:**
- Create: `src/features/sessions/hooks/useSessionAutoTitle.ts`
- Create: `src/features/sessions/hooks/__tests__/useSessionAutoTitle.test.ts`

- [ ] **Step 1: Write the test**

Create `src/features/sessions/hooks/__tests__/useSessionAutoTitle.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { useChatSessionStore } from "@/features/chat/stores/chatSessionStore";

// Mock the API module
vi.mock("@/shared/api/chat", () => ({
  generateSessionTitle: vi.fn(),
}));

import { generateSessionTitle } from "@/shared/api/chat";
import { useSessionAutoTitle } from "../useSessionAutoTitle";

const mockGenerateTitle = vi.mocked(generateSessionTitle);

function seedSession(
  id: string,
  overrides: Partial<{
    title: string;
    userSetName: boolean;
    draft: boolean;
    messageCount: number;
  }> = {},
) {
  const now = new Date().toISOString();
  useChatSessionStore.setState({
    sessions: [
      {
        id,
        title: overrides.title ?? "New Chat",
        createdAt: now,
        updatedAt: now,
        messageCount: overrides.messageCount ?? 0,
        draft: overrides.draft,
        userSetName: overrides.userSetName,
      },
    ],
  });
}

describe("useSessionAutoTitle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.setState({
      messagesBySession: {},
      sessionStateById: {},
      draftsBySession: {},
      activeSessionId: null,
      isConnected: false,
    });
    useChatSessionStore.setState({
      sessions: [],
      activeSessionId: null,
      isLoading: false,
      contextPanelOpenBySession: {},
    });
  });

  it("does not trigger when session has userSetName", () => {
    seedSession("s1", { userSetName: true, messageCount: 2 });
    useChatStore.getState().setChatState("s1", "idle");

    renderHook(() => useSessionAutoTitle("s1"));

    expect(mockGenerateTitle).not.toHaveBeenCalled();
  });

  it("does not trigger when messageCount is not 2", () => {
    seedSession("s1", { messageCount: 0 });
    useChatStore.getState().setChatState("s1", "idle");

    renderHook(() => useSessionAutoTitle("s1"));

    expect(mockGenerateTitle).not.toHaveBeenCalled();
  });

  it("generates title when first exchange completes", async () => {
    seedSession("s1", { messageCount: 2 });
    mockGenerateTitle.mockResolvedValue("Fix sidebar resize bug");

    // Start in streaming state
    useChatStore.getState().setChatState("s1", "streaming");

    const { rerender } = renderHook(() => useSessionAutoTitle("s1"));

    // Transition to idle (stream completed)
    useChatStore.getState().setChatState("s1", "idle");
    rerender();

    // Wait for the async call
    await vi.waitFor(() => {
      expect(mockGenerateTitle).toHaveBeenCalledWith("s1");
    });
  });

  it("uses fallback title on API failure", async () => {
    seedSession("s1", { messageCount: 2 });
    mockGenerateTitle.mockRejectedValue(new Error("LLM unavailable"));

    // Add a user message so fallback can extract text
    useChatStore.getState().addMessage("s1", {
      id: "msg-1",
      role: "user",
      created: Date.now(),
      content: [
        {
          type: "text",
          text: "Help me fix the authentication middleware in the login flow",
        },
      ],
      metadata: { userVisible: true },
    });

    useChatStore.getState().setChatState("s1", "streaming");

    const { rerender } = renderHook(() => useSessionAutoTitle("s1"));

    useChatStore.getState().setChatState("s1", "idle");
    rerender();

    await vi.waitFor(() => {
      expect(mockGenerateTitle).toHaveBeenCalledWith("s1");
    });

    // Should have updated session with fallback (first 50 chars of user message)
    const session = useChatSessionStore.getState().getSession("s1");
    expect(session?.title).toBe(
      "Help me fix the authentication middleware in the",
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/tulsi/Documents/GitHub/goose2 && pnpm vitest run src/features/sessions/hooks/__tests__/useSessionAutoTitle.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the hook implementation**

Create `src/features/sessions/hooks/useSessionAutoTitle.ts`:

```typescript
import { useEffect, useRef } from "react";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { useChatSessionStore } from "@/features/chat/stores/chatSessionStore";
import { generateSessionTitle } from "@/shared/api/chat";

/**
 * Automatically generates a session title after the first exchange completes.
 * Watches for the transition from streaming → idle when messageCount === 2.
 * Skips sessions where the user has manually set a title.
 */
export function useSessionAutoTitle(sessionId: string) {
  const firedRef = useRef(false);
  const prevChatStateRef = useRef<string | null>(null);

  const chatState = useChatStore(
    (s) => s.getSessionRuntime(sessionId).chatState,
  );
  const session = useChatSessionStore((s) =>
    s.sessions.find((candidate) => candidate.id === sessionId),
  );

  useEffect(() => {
    if (firedRef.current) return;
    if (!session || session.userSetName) return;
    if (session.messageCount !== 2) {
      prevChatStateRef.current = chatState;
      return;
    }

    const wasStreaming = prevChatStateRef.current === "streaming";
    prevChatStateRef.current = chatState;

    if (chatState !== "idle" || !wasStreaming) return;

    firedRef.current = true;

    generateSessionTitle(sessionId)
      .then((title) => {
        useChatSessionStore
          .getState()
          .updateSession(sessionId, { title, userSetName: false });
      })
      .catch(() => {
        // Fallback: use first 50 chars of first user message
        const messages =
          useChatStore.getState().messagesBySession[sessionId] ?? [];
        const firstUserMessage = messages.find((m) => m.role === "user");
        const textBlock = firstUserMessage?.content.find(
          (c) => c.type === "text",
        );
        if (textBlock && "text" in textBlock) {
          const fallback = textBlock.text.trim().slice(0, 50);
          useChatSessionStore
            .getState()
            .updateSession(sessionId, { title: fallback, userSetName: false });
        }
      });
  }, [sessionId, chatState, session]);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/tulsi/Documents/GitHub/goose2 && pnpm vitest run src/features/sessions/hooks/__tests__/useSessionAutoTitle.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/sessions/hooks/useSessionAutoTitle.ts src/features/sessions/hooks/__tests__/useSessionAutoTitle.test.ts
git commit -m "feat: add useSessionAutoTitle hook for AI session naming"
```

---

## Task 5: Wire auto-title hook into ChatView

**Files:**
- Modify: `src/features/chat/ui/ChatView.tsx:1-2,51-62`

- [ ] **Step 1: Import and call the hook**

Add the import at the top of `src/features/chat/ui/ChatView.tsx`:

```typescript
import { useSessionAutoTitle } from "@/features/sessions/hooks/useSessionAutoTitle";
```

Then inside the `ChatView` component, after the `useChat` call (after line 295), add:

```typescript
useSessionAutoTitle(activeSessionId);
```

- [ ] **Step 2: Run typecheck and tests**

Run: `cd /Users/tulsi/Documents/GitHub/goose2 && pnpm typecheck && pnpm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/features/chat/ui/ChatView.tsx
git commit -m "feat: wire auto-title hook into ChatView"
```

---

## Task 6: Build `groupSessionsByDate` utility

**Files:**
- Create: `src/features/sessions/lib/groupSessionsByDate.ts`
- Create: `src/features/sessions/lib/groupSessionsByDate.test.ts`

- [ ] **Step 1: Write the test**

Create `src/features/sessions/lib/groupSessionsByDate.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { groupSessionsByDate } from "./groupSessionsByDate";
import type { ChatSession } from "@/features/chat/stores/chatSessionStore";

function makeSession(
  id: string,
  updatedAt: string,
): ChatSession {
  return {
    id,
    title: `Session ${id}`,
    createdAt: updatedAt,
    updatedAt,
    messageCount: 5,
  };
}

describe("groupSessionsByDate", () => {
  beforeEach(() => {
    // Fix "now" to 2026-04-07T12:00:00Z (Tuesday)
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-07T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("groups sessions into Today, Yesterday, and dated buckets", () => {
    const sessions = [
      makeSession("a", "2026-04-07T10:00:00Z"), // Today
      makeSession("b", "2026-04-07T08:00:00Z"), // Today
      makeSession("c", "2026-04-06T15:00:00Z"), // Yesterday
      makeSession("d", "2026-03-28T12:00:00Z"), // March 28, 2026
    ];

    const groups = groupSessionsByDate(sessions);

    expect(groups).toHaveLength(3);
    expect(groups[0].label).toBe("Today");
    expect(groups[0].sessions).toHaveLength(2);
    expect(groups[0].sessions[0].id).toBe("a"); // newest first
    expect(groups[1].label).toBe("Yesterday");
    expect(groups[1].sessions).toHaveLength(1);
    expect(groups[2].label).toBe("March 28, 2026");
    expect(groups[2].sessions).toHaveLength(1);
  });

  it("returns empty array for no sessions", () => {
    expect(groupSessionsByDate([])).toEqual([]);
  });

  it("sorts sessions within each group newest-first", () => {
    const sessions = [
      makeSession("early", "2026-04-07T06:00:00Z"),
      makeSession("late", "2026-04-07T11:00:00Z"),
      makeSession("mid", "2026-04-07T09:00:00Z"),
    ];

    const groups = groupSessionsByDate(sessions);
    const ids = groups[0].sessions.map((s) => s.id);
    expect(ids).toEqual(["late", "mid", "early"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/tulsi/Documents/GitHub/goose2 && pnpm vitest run src/features/sessions/lib/groupSessionsByDate.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `src/features/sessions/lib/groupSessionsByDate.ts`:

```typescript
import type { ChatSession } from "@/features/chat/stores/chatSessionStore";

export interface SessionDateGroup {
  label: string;
  sessions: ChatSession[];
}

function startOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatDateLabel(date: Date, today: Date): string {
  const todayStart = startOfDay(today);
  const dateStart = startOfDay(date);
  const diff = todayStart - dateStart;

  if (diff === 0) return "Today";
  if (diff === 86_400_000) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function groupSessionsByDate(
  sessions: ChatSession[],
): SessionDateGroup[] {
  if (sessions.length === 0) return [];

  const now = new Date();
  const buckets = new Map<string, ChatSession[]>();
  const labelOrder: string[] = [];

  // Sort all sessions newest-first
  const sorted = [...sessions].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  for (const session of sorted) {
    const date = new Date(session.updatedAt);
    const label = formatDateLabel(date, now);

    if (!buckets.has(label)) {
      buckets.set(label, []);
      labelOrder.push(label);
    }
    buckets.get(label)!.push(session);
  }

  return labelOrder.map((label) => ({
    label,
    sessions: buckets.get(label)!,
  }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/tulsi/Documents/GitHub/goose2 && pnpm vitest run src/features/sessions/lib/groupSessionsByDate.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/sessions/lib/groupSessionsByDate.ts src/features/sessions/lib/groupSessionsByDate.test.ts
git commit -m "feat: add groupSessionsByDate utility"
```

---

## Task 7: Build `filterSessions` utility

**Files:**
- Create: `src/features/sessions/lib/filterSessions.ts`
- Create: `src/features/sessions/lib/filterSessions.test.ts`

- [ ] **Step 1: Write the test**

Create `src/features/sessions/lib/filterSessions.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { filterSessions } from "./filterSessions";
import type { ChatSession } from "@/features/chat/stores/chatSessionStore";

const resolvers = {
  getPersonaName: (id: string) =>
    id === "p1" ? "Code Assistant" : undefined,
  getProjectName: (id: string) =>
    id === "proj1" ? "Goose2 Frontend" : undefined,
};

function makeSession(
  overrides: Partial<ChatSession> & { id: string },
): ChatSession {
  return {
    title: "Untitled",
    createdAt: "2026-04-07T12:00:00Z",
    updatedAt: "2026-04-07T12:00:00Z",
    messageCount: 3,
    ...overrides,
  };
}

describe("filterSessions", () => {
  const sessions: ChatSession[] = [
    makeSession({ id: "1", title: "Fix sidebar bug", personaId: "p1" }),
    makeSession({
      id: "2",
      title: "Add pagination",
      projectId: "proj1",
    }),
    makeSession({ id: "3", title: "Debug auth flow" }),
  ];

  it("returns all sessions for empty query", () => {
    expect(filterSessions(sessions, "", resolvers)).toEqual(sessions);
  });

  it("filters by title", () => {
    const result = filterSessions(sessions, "sidebar", resolvers);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("filters by persona name", () => {
    const result = filterSessions(sessions, "code assistant", resolvers);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("filters by project name", () => {
    const result = filterSessions(sessions, "frontend", resolvers);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("is case-insensitive", () => {
    const result = filterSessions(sessions, "DEBUG", resolvers);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("3");
  });

  it("matches across multiple fields", () => {
    const result = filterSessions(sessions, "fix", resolvers);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/tulsi/Documents/GitHub/goose2 && pnpm vitest run src/features/sessions/lib/filterSessions.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `src/features/sessions/lib/filterSessions.ts`:

```typescript
import type { ChatSession } from "@/features/chat/stores/chatSessionStore";

export interface FilterResolvers {
  getPersonaName: (personaId: string) => string | undefined;
  getProjectName: (projectId: string) => string | undefined;
}

function buildSearchableString(
  session: ChatSession,
  resolvers: FilterResolvers,
): string {
  const parts: string[] = [session.title];

  if (session.personaId) {
    const name = resolvers.getPersonaName(session.personaId);
    if (name) parts.push(name);
  }

  if (session.projectId) {
    const name = resolvers.getProjectName(session.projectId);
    if (name) parts.push(name);
  }

  const date = new Date(session.updatedAt);
  parts.push(
    date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  );

  return parts.join(" ").toLowerCase();
}

export function filterSessions(
  sessions: ChatSession[],
  query: string,
  resolvers: FilterResolvers,
): ChatSession[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return sessions;

  return sessions.filter((session) =>
    buildSearchableString(session, resolvers).includes(trimmed),
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/tulsi/Documents/GitHub/goose2 && pnpm vitest run src/features/sessions/lib/filterSessions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/sessions/lib/filterSessions.ts src/features/sessions/lib/filterSessions.test.ts
git commit -m "feat: add filterSessions utility for search-as-you-type"
```

---

## Task 8: Build `SessionCard` component

**Files:**
- Create: `src/features/sessions/ui/SessionCard.tsx`
- Create: `src/features/sessions/ui/__tests__/SessionCard.test.tsx`

- [ ] **Step 1: Write the test**

Create `src/features/sessions/ui/__tests__/SessionCard.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SessionCard } from "../SessionCard";

describe("SessionCard", () => {
  const defaultProps = {
    id: "s1",
    title: "Fix sidebar bug",
    updatedAt: new Date().toISOString(),
    messageCount: 12,
    onSelect: vi.fn(),
  };

  it("renders title and message count", () => {
    render(<SessionCard {...defaultProps} />);

    expect(screen.getByText("Fix sidebar bug")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("renders persona name when provided", () => {
    render(<SessionCard {...defaultProps} personaName="Code Assistant" />);

    expect(screen.getByText("Code Assistant")).toBeInTheDocument();
  });

  it("renders project name with color dot when provided", () => {
    render(
      <SessionCard
        {...defaultProps}
        projectName="My Project"
        projectColor="#3b82f6"
      />,
    );

    expect(screen.getByText("My Project")).toBeInTheDocument();
  });

  it("calls onSelect when clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<SessionCard {...defaultProps} onSelect={onSelect} />);

    await user.click(screen.getByText("Fix sidebar bug"));

    expect(onSelect).toHaveBeenCalledWith("s1");
  });

  it("shows archived styling when archivedAt is set", () => {
    const { container } = render(
      <SessionCard {...defaultProps} archivedAt="2026-04-01T00:00:00Z" />,
    );

    expect(container.firstChild).toHaveClass("opacity-60");
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/tulsi/Documents/GitHub/goose2 && pnpm vitest run src/features/sessions/ui/__tests__/SessionCard.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write the component**

Create `src/features/sessions/ui/SessionCard.tsx`:

```typescript
import { Calendar, MessageSquare, Folder, Bot } from "lucide-react";
import { cn } from "@/shared/lib/cn";

function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

interface SessionCardProps {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
  personaName?: string;
  projectName?: string;
  projectColor?: string;
  workingDir?: string;
  archivedAt?: string;
  onSelect?: (id: string) => void;
}

export function SessionCard({
  id,
  title,
  updatedAt,
  messageCount,
  personaName,
  projectName,
  projectColor,
  workingDir,
  archivedAt,
  onSelect,
}: SessionCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(id)}
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-background p-4 text-left transition-shadow hover:shadow-card",
        archivedAt && "opacity-60",
      )}
    >
      <p className="text-sm font-medium line-clamp-2 break-words">{title}</p>

      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Calendar className="size-3 shrink-0" />
          <span>{formatRelativeDate(updatedAt)}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <MessageSquare className="size-3 shrink-0" />
          <span>{messageCount}</span>
        </div>

        {personaName && (
          <div className="flex items-center gap-1.5">
            <Bot className="size-3 shrink-0" />
            <span className="truncate">{personaName}</span>
          </div>
        )}

        {projectName && (
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block size-2 shrink-0 rounded-full"
              style={projectColor ? { backgroundColor: projectColor } : undefined}
            />
            <span className="truncate">{projectName}</span>
          </div>
        )}

        {workingDir && (
          <div className="flex items-center gap-1.5">
            <Folder className="size-3 shrink-0" />
            <span className="truncate">{workingDir}</span>
          </div>
        )}

        {archivedAt && (
          <span className="text-muted-foreground text-xs">Archived</span>
        )}
      </div>
    </button>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/tulsi/Documents/GitHub/goose2 && pnpm vitest run src/features/sessions/ui/__tests__/SessionCard.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/sessions/ui/SessionCard.tsx src/features/sessions/ui/__tests__/SessionCard.test.tsx
git commit -m "feat: add SessionCard component"
```

---

## Task 9: Build `SessionHistoryView` page

**Files:**
- Create: `src/features/sessions/ui/SessionHistoryView.tsx`

- [ ] **Step 1: Write the component**

Create `src/features/sessions/ui/SessionHistoryView.tsx`:

```typescript
import { useCallback, useEffect, useState } from "react";
import { History } from "lucide-react";
import { SearchBar } from "@/shared/ui/SearchBar";
import { SessionCard } from "./SessionCard";
import { groupSessionsByDate } from "../lib/groupSessionsByDate";
import { filterSessions } from "../lib/filterSessions";
import { useChatSessionStore } from "@/features/chat/stores/chatSessionStore";
import { useAgentStore } from "@/features/agents/stores/agentStore";
import { useProjectStore } from "@/features/projects/stores/projectStore";
import { listArchivedSessions } from "@/shared/api/chat";
import type { ChatSession } from "@/features/chat/stores/chatSessionStore";

interface SessionHistoryViewProps {
  onSelectSession?: (sessionId: string) => void;
}

export function SessionHistoryView({
  onSelectSession,
}: SessionHistoryViewProps) {
  const activeSessions = useChatSessionStore((s) =>
    s.sessions.filter((session) => !session.draft),
  );
  const [archivedSessions, setArchivedSessions] = useState<ChatSession[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    listArchivedSessions()
      .then((sessions) =>
        setArchivedSessions(
          sessions.map((s) => ({
            id: s.id,
            title: s.title,
            projectId: s.projectId,
            agentId: s.agentId,
            providerId: s.providerId,
            personaId: s.personaId,
            modelName: s.modelName,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
            archivedAt: s.archivedAt,
            messageCount: s.messageCount,
            userSetName: s.userSetName,
          })),
        ),
      )
      .catch(() => setArchivedSessions([]));
  }, []);

  const allSessions = [...activeSessions, ...archivedSessions];

  const getPersonaName = useCallback(
    (personaId: string) =>
      useAgentStore.getState().getPersonaById(personaId)?.displayName,
    [],
  );

  const projects = useProjectStore((s) => s.projects);
  const getProjectName = useCallback(
    (projectId: string) => projects.find((p) => p.id === projectId)?.name,
    [projects],
  );

  const getProjectColor = useCallback(
    (projectId: string) => projects.find((p) => p.id === projectId)?.color,
    [projects],
  );

  const getWorkingDir = useCallback(
    (projectId: string) =>
      projects.find((p) => p.id === projectId)?.workingDirs[0],
    [projects],
  );

  const resolvers = { getPersonaName, getProjectName };
  const filtered = filterSessions(allSessions, search, resolvers);
  const dateGroups = groupSessionsByDate(filtered);

  return (
    <div className="flex flex-1 flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-5xl mx-auto w-full px-6 py-8 space-y-5 page-transition">
          {/* Header */}
          <div>
            <h1 className="text-lg font-semibold font-display tracking-tight">
              Session History
            </h1>
            <p className="text-xs text-muted-foreground">
              Browse and search past sessions
            </p>
          </div>

          {/* Search */}
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search sessions by title, persona, or project..."
          />

          {/* Session cards grouped by date */}
          {dateGroups.length > 0 &&
            dateGroups.map((group) => (
              <div key={group.label} className="space-y-2">
                <h2 className="text-sm font-medium text-muted-foreground sticky top-0 bg-background py-1 z-10">
                  {group.label}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {group.sessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      id={session.id}
                      title={session.title}
                      updatedAt={session.updatedAt}
                      messageCount={session.messageCount}
                      personaName={
                        session.personaId
                          ? getPersonaName(session.personaId)
                          : undefined
                      }
                      projectName={
                        session.projectId
                          ? getProjectName(session.projectId)
                          : undefined
                      }
                      projectColor={
                        session.projectId
                          ? getProjectColor(session.projectId)
                          : undefined
                      }
                      workingDir={
                        session.projectId
                          ? getWorkingDir(session.projectId)
                          : undefined
                      }
                      archivedAt={session.archivedAt}
                      onSelect={onSelectSession}
                    />
                  ))}
                </div>
              </div>
            ))}

          {/* Empty state */}
          {dateGroups.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <History className="h-10 w-10 opacity-30" />
              <div className="text-center">
                <p className="text-sm font-medium">
                  {allSessions.length === 0
                    ? "No sessions yet"
                    : "No matching sessions"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {allSessions.length === 0
                    ? "Start a chat to see it here."
                    : "Try a different search term."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd /Users/tulsi/Documents/GitHub/goose2 && pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/features/sessions/ui/SessionHistoryView.tsx
git commit -m "feat: add SessionHistoryView page component"
```

---

## Task 10: Add "session-history" route to AppShell and Sidebar

**Files:**
- Modify: `src/app/AppShell.tsx:1-10,24,420-453`
- Modify: `src/features/sidebar/ui/Sidebar.tsx:6,39-42`

- [ ] **Step 1: Add `"session-history"` to the `AppView` type**

In `src/app/AppShell.tsx`, update the type:

```typescript
export type AppView = "home" | "chat" | "skills" | "agents" | "projects" | "session-history";
```

- [ ] **Step 2: Import and render `SessionHistoryView`**

Add import at top of `src/app/AppShell.tsx`:

```typescript
import { SessionHistoryView } from "@/features/sessions/ui/SessionHistoryView";
```

Update `renderContent` to add the case before the `"chat"` / `"home"` case:

```typescript
const renderContent = () => {
  switch (activeView) {
    case "skills":
      return <SkillsView />;
    case "agents":
      return <AgentsView />;
    case "projects":
      return <ProjectsView onStartChat={handleStartChatFromProject} />;
    case "session-history":
      return (
        <SessionHistoryView onSelectSession={handleSelectSession} />
      );
    case "chat":
    case "home":
      return activeSession ? (
        // ... existing ChatView code
```

- [ ] **Step 3: Add "Session History" nav item to Sidebar**

In `src/features/sidebar/ui/Sidebar.tsx`, add `History` to the lucide-react imports:

```typescript
import { BookOpen, Bot, History, Home } from "lucide-react";
```

Update the `NAV_ITEMS` array to include Session History:

```typescript
const NAV_ITEMS: readonly { id: AppView; label: string; icon: typeof Bot }[] = [
  { id: "agents", label: "Personas", icon: Bot },
  { id: "skills", label: "Skills", icon: BookOpen },
  { id: "session-history", label: "Session History", icon: History },
];
```

- [ ] **Step 4: Run typecheck and tests**

Run: `cd /Users/tulsi/Documents/GitHub/goose2 && pnpm typecheck && pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/AppShell.tsx src/features/sidebar/ui/Sidebar.tsx
git commit -m "feat: add Session History route and sidebar nav item"
```

---

## Task 11: Wire sidebar search

**Files:**
- Modify: `src/features/sidebar/ui/Sidebar.tsx:2,6,46-64,82,99-147,306-341`

- [ ] **Step 1: Add search state and filter import**

In `src/features/sidebar/ui/Sidebar.tsx`, add `Search` to lucide imports and add the filter import:

```typescript
import { BookOpen, Bot, History, Home, Search } from "lucide-react";
```

Add import for the filter utility:

```typescript
import { filterSessions } from "@/features/sessions/lib/filterSessions";
import { useAgentStore } from "@/features/agents/stores/agentStore";
import { useProjectStore } from "@/features/projects/stores/projectStore";
```

Add search state inside the `Sidebar` component (after the existing `expanded` state):

```typescript
const [sidebarSearch, setSidebarSearch] = useState("");
const searchInputRef = useRef<HTMLInputElement>(null);
```

- [ ] **Step 2: Uncomment and wire the search bar**

Replace the commented-out search bar block (lines 306-341) with:

```typescript
<button
  type="button"
  onClick={() => searchInputRef.current?.focus()}
  title={collapsed ? "Search ⌘K" : undefined}
  className={cn(
    "flex items-center w-full rounded-md transition-all duration-300 ease-out",
    collapsed
      ? "justify-center p-3 text-muted-foreground"
      : "gap-2 border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-transparent",
  )}
>
  {collapsed ? (
    <Search className="size-3.5 flex-shrink-0" />
  ) : (
    <>
      <Search className="size-3.5 flex-shrink-0" />
      <input
        ref={searchInputRef}
        type="search"
        value={sidebarSearch}
        onChange={(e) => setSidebarSearch(e.target.value)}
        placeholder="Search..."
        className={cn(
          "bg-transparent border-none outline-none text-xs flex-1 min-w-0 placeholder:text-muted-foreground",
          labelTransition,
          labelVisible
            ? "opacity-100 w-auto"
            : "opacity-0 w-0 overflow-hidden",
        )}
        onClick={(e) => e.stopPropagation()}
      />
      <kbd
        className={cn(
          "text-[10px] text-muted-foreground px-1 py-0.5 rounded font-mono flex-shrink-0",
          labelTransition,
          labelVisible
            ? "opacity-100 w-auto"
            : "opacity-0 w-0 overflow-hidden px-0",
        )}
      >
        ⌘K
      </kbd>
    </>
  )}
</button>
```

- [ ] **Step 3: Filter sessions before passing to SidebarProjectsSection**

Add the filtering logic before the `SidebarProjectsSection` render. Build resolvers using the agent and project stores, then filter the `projectSessions` data:

```typescript
const agentStoreState = useAgentStore();
const projectStoreState = useProjectStore();

const sidebarResolvers = {
  getPersonaName: (personaId: string) =>
    agentStoreState.getPersonaById(personaId)?.displayName,
  getProjectName: (projectId: string) =>
    projectStoreState.projects.find((p) => p.id === projectId)?.name,
};
```

Then filter the `projectSessions` computed value. Wrap the existing `projectSessions` computation and add a filtered version after it:

```typescript
const filteredProjectSessions = (() => {
  if (!sidebarSearch.trim()) return projectSessions;

  const allSessionItems = [
    ...Object.values(projectSessions.byProject).flat(),
    ...projectSessions.standalone,
  ];
  const matchingIds = new Set(
    filterSessions(
      allSessionItems.map((item) => ({
        id: item.id,
        title: item.title,
        projectId: item.projectId,
        createdAt: item.updatedAt,
        updatedAt: item.updatedAt,
        messageCount: 0,
      })),
      sidebarSearch,
      sidebarResolvers,
    ).map((s) => s.id),
  );

  const filteredByProject: Record<string, typeof projectSessions.standalone> = {};
  for (const [projectId, items] of Object.entries(projectSessions.byProject)) {
    const matching = items.filter((item) => matchingIds.has(item.id));
    // Show project if any child matches or project name matches
    const projectNameMatches = sidebarResolvers
      .getProjectName(projectId)
      ?.toLowerCase()
      .includes(sidebarSearch.trim().toLowerCase());
    if (matching.length > 0 || projectNameMatches) {
      filteredByProject[projectId] =
        matching.length > 0 ? matching : items;
    }
  }

  return {
    byProject: filteredByProject,
    standalone: projectSessions.standalone.filter((item) =>
      matchingIds.has(item.id),
    ),
  };
})();
```

Then pass `filteredProjectSessions` instead of `projectSessions` to `SidebarProjectsSection`:

```typescript
<SidebarProjectsSection
  projects={projects}
  projectSessions={filteredProjectSessions}
  // ... rest of props unchanged
/>
```

- [ ] **Step 4: Add Cmd+K keyboard shortcut**

Add to the existing keyboard handler in `Sidebar` (or add a new effect):

```typescript
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === "k" && e.metaKey) {
      e.preventDefault();
      searchInputRef.current?.focus();
    }
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, []);
```

- [ ] **Step 5: Run typecheck and tests**

Run: `cd /Users/tulsi/Documents/GitHub/goose2 && pnpm typecheck && pnpm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/features/sidebar/ui/Sidebar.tsx
git commit -m "feat: add search-as-you-type to sidebar"
```

---

## Task 12: Final integration test

**Files:** None — verification only

- [ ] **Step 1: Run the full test suite**

Run: `cd /Users/tulsi/Documents/GitHub/goose2 && pnpm test`
Expected: All tests PASS

- [ ] **Step 2: Run typecheck**

Run: `cd /Users/tulsi/Documents/GitHub/goose2 && pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Run lint/format check**

Run: `cd /Users/tulsi/Documents/GitHub/goose2 && pnpm check`
Expected: PASS

- [ ] **Step 4: Verify the app builds**

Run: `cd /Users/tulsi/Documents/GitHub/goose2 && pnpm build`
Expected: Build succeeds

---

## Summary

| Task | Feature | Files |
|------|---------|-------|
| 1 | Smart naming | `chat.ts`, `chatSessionStore.ts` — model change |
| 2 | Smart naming | `AppShell.tsx` — `userSetName` on rename |
| 3 | Smart naming | `chat.ts` — API function |
| 4 | Smart naming | `useSessionAutoTitle.ts` + test |
| 5 | Smart naming | `ChatView.tsx` — wire hook |
| 6 | History view | `groupSessionsByDate.ts` + test |
| 7 | Search | `filterSessions.ts` + test |
| 8 | History view | `SessionCard.tsx` + test |
| 9 | History view | `SessionHistoryView.tsx` |
| 10 | History view | `AppShell.tsx`, `Sidebar.tsx` — routing |
| 11 | Search | `Sidebar.tsx` — sidebar search |
| 12 | All | Final verification |
