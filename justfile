# Default recipe
default:
    @just --list

# ── Dev Environment ──────────────────────────────────────────

# Install dependencies
setup:
    pnpm install
    cd src-tauri && cargo build

# ── Build & Check ────────────────────────────────────────────

# Run all checks (lint, format, typecheck, file sizes)
check:
    pnpm check
    pnpm typecheck

# Format code
fmt:
    pnpm format
    cd src-tauri && cargo fmt

# Check formatting without modifying
fmt-check:
    biome format .
    cd src-tauri && cargo fmt --check

# Run clippy on Tauri backend
clippy:
    cd src-tauri && cargo clippy -- -D warnings

# Build the frontend
build:
    pnpm build

# Check Tauri Rust formatting
tauri-fmt-check:
    cd src-tauri && cargo fmt --check

# Check Tauri Rust types
tauri-check:
    cd src-tauri && cargo check

# Full CI gate
ci: check clippy test build tauri-check

# ── Test ─────────────────────────────────────────────────────

# Run unit/component tests
test:
    pnpm test

# Run tests in watch mode
test-watch:
    pnpm test:watch

# Run tests with coverage
test-coverage:
    pnpm test:coverage

# Run E2E smoke tests (builds first)
test-e2e:
    pnpm test:e2e:smoke

# Run all E2E tests (builds first)
test-e2e-all:
    pnpm test:e2e

# ── Run ──────────────────────────────────────────────────────

# Start the desktop app in dev mode
dev:
    #!/usr/bin/env bash
    set -euo pipefail

    TAURI_CONFIG="{}"

    # In worktrees, generate a labeled icon so you can tell instances apart
    if git rev-parse --is-inside-work-tree &>/dev/null; then
        GIT_DIR=$(git rev-parse --git-dir)
        if [[ "$GIT_DIR" == *".git/worktrees/"* ]]; then
            BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)
            WORKTREE_LABEL="${BRANCH_NAME##*/}"

            ICON_DIR="$(pwd)/src-tauri/target/dev-icons"
            mkdir -p "$ICON_DIR"
            DEV_ICON="$ICON_DIR/icon.icns"

            if swift scripts/generate-dev-icon.swift src-tauri/icons/icon.icns "$DEV_ICON" "$WORKTREE_LABEL"; then
                echo "🌳 Worktree: ${WORKTREE_LABEL}"
                TAURI_CONFIG="{\"bundle\":{\"icon\":[\"$DEV_ICON\"]}}"
            fi
        fi
    fi

    pnpm tauri dev --config "$TAURI_CONFIG"

# Start the desktop app with dev config
dev-debug:
    #!/usr/bin/env bash
    set -euo pipefail

    EXTRA_CONFIG=""

    # In worktrees, generate a labeled icon so you can tell instances apart
    if git rev-parse --is-inside-work-tree &>/dev/null; then
        GIT_DIR=$(git rev-parse --git-dir)
        if [[ "$GIT_DIR" == *".git/worktrees/"* ]]; then
            BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)
            WORKTREE_LABEL="${BRANCH_NAME##*/}"

            ICON_DIR="$(pwd)/src-tauri/target/dev-icons"
            mkdir -p "$ICON_DIR"
            DEV_ICON="$ICON_DIR/icon.icns"

            if swift scripts/generate-dev-icon.swift src-tauri/icons/icon.icns "$DEV_ICON" "$WORKTREE_LABEL"; then
                echo "🌳 Worktree: ${WORKTREE_LABEL}"
                EXTRA_CONFIG="--config {\"bundle\":{\"icon\":[\"$DEV_ICON\"]}}"
            fi
        fi
    fi

    pnpm tauri dev --config src-tauri/tauri.dev.conf.json $EXTRA_CONFIG

# Start only the frontend dev server
dev-frontend:
    pnpm dev

# ── Utilities ────────────────────────────────────────────────

# Clean build artifacts
clean:
    cd src-tauri && cargo clean
    rm -rf dist
