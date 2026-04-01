# Artifact V1 Debug + Fix Summary (April 1, 2026)

## 1) Objective and scope

This branch implemented a **stateless Artifact V1** focused on one job:

1. Detect likely output files from tool calls and markdown links.
2. Enforce local path scope policy.
3. Offer a simple `Open file` / `Open folder` action in chat.
4. Keep one prominent artifact action per assistant message, with secondary outputs collapsed.

Non-goals stayed out of scope:

1. No artifact store.
2. No artifact detail page.
3. No sidecar renderer.
4. No context panel integration.

---

## 2) High-level architecture that shipped

1. `src/features/chat/lib/artifactPathPolicy.ts`
   - Path extraction (tool args, write-result text, markdown href).
   - Path resolution and scope allow/block checks.
   - Message-level candidate ranking and dedupe.
2. `src/features/chat/hooks/ArtifactPolicyContext.tsx`
   - Computes per-message rankings for visible assistant messages.
   - Maps tool-card args object identity to tool-call IDs.
   - Exposes `resolveToolCardDisplay`, `resolveMarkdownHref`, `openResolvedPath`.
3. `src/features/chat/ui/ChatView.tsx`
   - Provides allowed roots and working-dir context into artifact policy.
4. `src/features/chat/ui/ToolCallCard.tsx`
   - Renders one primary artifact action + collapsed secondary outputs.
5. `src/features/chat/ui/MarkdownContent.tsx`
   - Routes local links through artifact scope/open policy.

---

## 3) Issues encountered and fixes

| Symptom | Root cause | Fix | Key files |
|---|---|---|---|
| `opener.open_path not allowed` when clicking artifact action | Tauri capability missing `opener:allow-open-path` | Added opener capability and scoped path permissions | `src-tauri/capabilities/default.json`, `src-tauri/gen/schemas/capabilities.json` |
| Artifact action pills disappeared after reopening chat | Assistant messages were persisted as text-only; tool blocks were lost on reload | Persisted structured assistant content (`toolRequest`, `toolResponse`, `text`) and paired requests/responses correctly | `src-tauri/src/services/acp/writer.rs`, `src-tauri/src/services/acp/mod.rs` |
| Massive false-positive artifact candidates (`</html>`, old files from `ls`, etc.) | Regex extraction on general tool output was too permissive | Limited result-text extraction to write-oriented tools; filtered HTML tags; improved extraction heuristics | `src/features/chat/lib/artifactPathPolicy.ts` |
| Wrong primary action (blocked absolute path selected while allowed relative existed) | Ranking ignored allow/block when choosing primary candidate | Primary candidate now prefers first allowed candidate; blocked paths move to secondary list | `src/features/chat/lib/artifactPathPolicy.ts` |
| HTML output opened multiple times | Rapid repeated open calls triggered duplicate opens | Added short same-path debounce in open wrapper | `src/features/chat/hooks/ArtifactPolicyContext.tsx` |
| In no-project chat, output saved to home (`~/file`) and artifact scope mismatched | Backend default working dir was home; frontend policy was mostly project roots + artifacts root | Standardized no-project default working dir to `~/.goose/artifacts`; ensured directory creation; frontend uses same fallback | `src-tauri/src/commands/acp.rs`, `src/features/chat/ui/ChatView.tsx` |
| Artifact action clicked but appeared to do nothing in some cases | Candidate mismatch plus path policy mismatch caused primary to point at non-useful or blocked path | Combined ranking fix + working-dir/roots alignment fix | `artifactPathPolicy.ts`, `ChatView.tsx`, `acp.rs` |
| Too many tool pills drowned out main artifact action | Existing tool-call UI showed every internal command step equally | Added internal-step collapsing (`Show internal steps (N)`) and subtle styling for hidden internal cards; made primary artifact button visually stronger | `src/features/chat/ui/MessageBubble.tsx`, `src/features/chat/ui/ToolCallCard.tsx` |

---

## 4) Behavior changes after fixes

### No-project chats

1. Default working dir is now `~/.goose/artifacts`.
2. Agent outputs should land under `/Users/<user>/.goose/artifacts/...`.
3. Artifact scope is aligned with that location.

### Artifact action selection

1. Exactly one primary artifact action per assistant message.
2. If top-ranked path is blocked but another candidate is allowed, allowed candidate is promoted.
3. Secondary candidates remain accessible under `More outputs (N)`.

### Tool-step noise reduction

1. Important steps remain visible by default.
2. Low-signal/internal shell steps are grouped behind `Show internal steps (N)`.
3. Hidden internal steps are intentionally less visually prominent.

---

## 5) Test coverage added/updated

### Unit tests

1. `src/features/chat/lib/__tests__/artifactPathPolicy.test.ts`
   - Write-tool precedence.
   - Filename/path boosts.
   - Appearance tie-breaks.
   - Dedupe behavior.
   - Allowed vs blocked roots.
   - HTML-tag false-positive prevention.
   - Allowed-primary promotion when blocked candidate exists.
2. `src/features/chat/hooks/__tests__/ArtifactPolicyContext.test.tsx`
   - Context ranking + args identity mapping behavior.
3. `src/features/chat/ui/__tests__/ToolCallCard.test.tsx`
   - Primary host only.
   - `More outputs` behavior.
   - Blocked candidate disabled state + reason.
4. `src/features/chat/ui/__tests__/MarkdownContent.test.tsx`
   - Allowed local link open.
   - Blocked local link handling.
   - External link unchanged.
5. `src/features/chat/ui/__tests__/MessageBubble.test.tsx`
   - Internal-step collapsing behavior and toggle expansion.

### Checks run

1. `pnpm typecheck` (pass).
2. Targeted Vitest suites for artifact policy/context/UI (pass).
3. `cargo check --manifest-path src-tauri/Cargo.toml` (pass).

---

## 6) Current known limitations

1. Scope checks are prefix-based; canonical symlink resolution is not yet implemented.
2. Artifact V1 still opens paths in OS/default apps only; no inline rich renderer yet.
3. Candidate extraction still uses heuristics; some ambiguous tool outputs may still need tuning.
4. Internal-step collapse rules are heuristic (tool name + shell-pattern based), not semantic.

---

## 7) Suggested areas for additional testing criteria

Please propose additional tests for:

1. **Security/path policy**
   - Path traversal attempts (`../`), mixed slashes, Unicode edge cases.
   - Symlink escape scenarios.
   - `file://` variants and URL-encoded path inputs.
2. **Ranking/candidate quality**
   - Multi-tool messages with several write calls.
   - Mixed absolute + relative + tilde paths.
   - Extremely long tool result payloads and noisy shell output.
3. **Persistence/reload**
   - Reopen app/session after restart and verify artifact actions still render.
   - Partial stream interruption and resumed history rendering.
4. **UX clarity**
   - Verify primary action remains discoverable with long tool chains.
   - Ensure internal-step toggle does not hide errors or important steps.
5. **Cross-platform**
   - macOS/Linux/Windows path formats and opener behavior.
6. **Permissions**
   - Tauri capability scoping correctness and denial messaging quality.
7. **Regression safety**
   - MessageBubble, ToolCallCard, MarkdownContent interactions under persona/multi-agent contexts.

---

## 8) Branch/work summary

Branch: `codex/tulsi/artifacts` (rebased on current `origin/main` before implementation work).  
Date: April 1, 2026.

