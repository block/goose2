# Plan: Single-Layer Session Architecture

## Goal

Eliminate all client-side and Tauri-side session/message storage. The goose
binary (via ACP) is the **sole source of truth** for sessions and messages.
The frontend holds an in-memory view cache populated entirely from ACP events.

After this change there are zero JSON files written to `~/.goose/sessions/`,
zero `metadata.json` files, zero `localStorage` session caches, and zero
session-ID mapping files in `~/.goose/acp_sessions/`.

## Current State (what exists today)

Three redundant layers manage session state:

1. **Frontend Zustand** (`chatSessionStore`) — in-memory session list,
   messages, active session. Populated on startup from ACP `list_sessions`,
   but also creates sessions locally with `crypto.randomUUID()` before the
   backend knows about them.

2. **Rust `SessionStore`** (`src-tauri/src/services/sessions.rs`) — persists
   session metadata to `~/.goose/sessions/metadata.json` and messages to
   per-session JSON files. The `TauriMessageWriter` saves every streaming
   chunk here. The `TauriStore` reads messages back for replay matching.
   The `AcpService::send_prompt` saves user messages here and reads them
   back for persona catch-up context.

3. **ACP goose binary** (threads) — the actual server. Owns sessions, owns
   message history, replays messages on `load_session`, generates titles,
   handles archive/unarchive/delete.

Layer 2 is a shadow copy of Layer 3. Layer 1 invents session IDs that differ
from the goose binary's thread IDs, requiring a mapping file
(`~/.goose/acp_sessions/{id}.json`) and a dispatcher that translates between
the two ID spaces.

## Target State

One layer: **the goose binary owns everything**. The frontend is a view.

```
┌─────────────────────────────────────────────────────┐
│  Frontend (React/Zustand)                           │
│  - In-memory session list (from list_sessions)      │
│  - In-memory messages (from load_session + stream)  │
│  - Local-only UI state (active tab, unread dots)    │
└──────────────────┬──────────────────────────────────┘
                   │ Tauri commands + events
┌──────────────────▼──────────────────────────────────┐
│  Rust Tauri layer (thin passthrough)                │
│  - ACP manager (single goose process lifecycle)     │
│  - Event emitter (forwards ACP notifications)       │
│  - No message storage, no session metadata files    │
└──────────────────┬──────────────────────────────────┘
                   │ stdin/stdout JSON-RPC
┌──────────────────▼──────────────────────────────────┐
│  Goose binary (ACP server)                          │
│  - Source of truth for sessions (threads)           │
│  - Source of truth for messages                     │
│  - Generates titles, handles archive/delete         │
└─────────────────────────────────────────────────────┘
```

## Key Design Decisions

### One ID space

The goose binary assigns session IDs. The frontend never invents its own.
When creating a new session, the frontend shows the chat UI immediately with
a `null` session ID. The Rust layer calls `NewSessionRequest`, gets the real
ID back, and emits it to the frontend. Until the ID arrives, the input field
is visible but sending is deferred.

### No message persistence in Tauri

`TauriMessageWriter` emits Tauri events only. It does not write to disk.
When the user opens an existing session, `load_session` replays all messages
as `SessionNotification` events, which the frontend renders the same way it
renders live streaming.

### No Store trait implementation needed

The `Store` trait in `acp-client` requires `set_agent_session_id` and
`get_session_messages`. Both exist to maintain the mapping between "our ID"
and "goose's ID" and to feed replay matching. Since we use goose's ID
directly and don't persist messages locally, we use `NoOpStore` (or an
inline equivalent that returns `Ok(())` / `Ok(vec![])` for everything).

### Persona catch-up context

The current `build_catchup_context` reads all messages from `SessionStore`
to build a summary of what other personas said. Without local message
storage, this needs to either:

- Read from the frontend's in-memory message list (passed down to the Rust
  command as a parameter), or
- Be dropped for now (it's a multi-persona feature that can be re-added
  when the ACP protocol supports message retrieval), or
- Query messages from the goose binary if/when an API exists for that.

**Decision: drop catch-up context for now.** It only applies to the
multi-persona case. Re-add it later when ACP supports a message-retrieval
method, or pass the frontend's messages down as a command parameter.

## Out of Scope

- Listing archived sessions (ACP doesn't expose this yet).
- Persisting `projectId`/`personaId`/`providerId` to the backend (needs
  ACP ThreadMetadata support).
- Multi-persona catch-up context (re-add when ACP supports message retrieval).
