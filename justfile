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
ci: check clippy build tauri-check

# ── Run ──────────────────────────────────────────────────────

# Start the desktop app in dev mode
dev:
    pnpm tauri dev

# Start the desktop app with dev config
dev-debug:
    pnpm tauri dev --config src-tauri/tauri.dev.conf.json

# Start only the frontend dev server
dev-frontend:
    pnpm dev

# ── Utilities ────────────────────────────────────────────────

# Clean build artifacts
clean:
    cd src-tauri && cargo clean
    rm -rf dist
