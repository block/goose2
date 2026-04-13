# Default recipe
default:
    @just --list

# ── Dev Environment ──────────────────────────────────────────

# Sync and build the managed local goose checkout used for goose2 integration.
goose-sync:
    GOOSE_DEV_MODE=required ./scripts/ensure-local-goose.sh

# Install dependencies
setup:
    pnpm install
    GOOSE_DEV_MODE=required ./scripts/ensure-local-goose.sh
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
    pnpm exec biome format .
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

    if [[ -n "${GOOSE_BIN:-}" ]]; then
        echo "Using explicitly set GOOSE_BIN: ${GOOSE_BIN}"
    else
        LOCAL_GOOSE_BIN="$(./scripts/ensure-local-goose.sh --check-bin)" || {
            rc=$?
            if [[ $rc -eq 2 ]]; then
                echo "❌ Local goose binary is not ready. Run 'just setup' first." >&2
                exit 1
            fi
            exit $rc
        }
        if [[ -n "${LOCAL_GOOSE_BIN}" ]]; then
            export GOOSE_BIN="${LOCAL_GOOSE_BIN}"
            echo "Using local goose binary: ${GOOSE_BIN}"
        fi
    fi

    # Derive a stable port from the working directory so the same worktree
    # always gets the same port. This avoids changing TAURI_CONFIG between
    # runs, which would invalidate Cargo's build cache and trigger a full
    # Rust rebuild every time.
    VITE_PORT=$(python3 -c "import hashlib,os; h=int(hashlib.sha256(os.getcwd().encode()).hexdigest(),16); print(10000 + h % 55000)")
    export VITE_PORT
    TAURI_CONFIG="{\"build\":{\"devUrl\":\"http://localhost:${VITE_PORT}\",\"beforeDevCommand\":{\"script\":\"exec ./node_modules/.bin/vite --port ${VITE_PORT} --strictPort\",\"cwd\":\"..\",\"wait\":false}}}"

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
                TAURI_CONFIG=$(python3 -c "import json,sys; a=json.loads(sys.argv[1]); a['bundle']={'icon':['$DEV_ICON']}; print(json.dumps(a))" "$TAURI_CONFIG")
            fi
        fi
    fi

    pnpm tauri dev --config "$TAURI_CONFIG"

# Start the desktop app with dev config
dev-debug:
    #!/usr/bin/env bash
    set -euo pipefail

    if [[ -n "${GOOSE_BIN:-}" ]]; then
        echo "Using explicitly set GOOSE_BIN: ${GOOSE_BIN}"
    else
        LOCAL_GOOSE_BIN="$(./scripts/ensure-local-goose.sh --check-bin)" || {
            rc=$?
            if [[ $rc -eq 2 ]]; then
                echo "❌ Local goose binary is not ready. Run 'just setup' first." >&2
                exit 1
            fi
            exit $rc
        }
        if [[ -n "${LOCAL_GOOSE_BIN}" ]]; then
            export GOOSE_BIN="${LOCAL_GOOSE_BIN}"
            echo "Using local goose binary: ${GOOSE_BIN}"
        fi
    fi

    VITE_PORT=$(python3 -c "import hashlib,os; h=int(hashlib.sha256(os.getcwd().encode()).hexdigest(),16); print(10000 + h % 55000)")
    export VITE_PORT
    EXTRA_CONFIG="--config {\"build\":{\"devUrl\":\"http://localhost:${VITE_PORT}\",\"beforeDevCommand\":{\"script\":\"exec ./node_modules/.bin/vite --port ${VITE_PORT} --strictPort\",\"cwd\":\"..\",\"wait\":false}}}"

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
                EXTRA_CONFIG="$EXTRA_CONFIG --config {\"bundle\":{\"icon\":[\"$DEV_ICON\"]}}"
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
    rm -rf node_modules
