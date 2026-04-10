#!/bin/bash
# App E2E: Home screen smoke test
# Requires: Tauri app running with --features test-bridge
set -euo pipefail

BRIDGE="node tests/app-e2e/lib/bridge-client.mjs"

echo "=== Home Screen Smoke Test ==="

# 1. Take a snapshot of the home screen
echo "[1] Taking snapshot..."
SNAPSHOT=$($BRIDGE snapshot)
echo "$SNAPSHOT"

# 2. Verify greeting is visible
echo ""
echo "[2] Checking for greeting text..."
GREETING=$($BRIDGE getText "body")
if echo "$GREETING" | grep -qE "Good (morning|afternoon|evening)"; then
  echo "PASS: Greeting found"
else
  echo "FAIL: Expected greeting text not found"
  exit 1
fi

# 3. Verify chat input is present
echo ""
echo "[3] Checking for chat input..."
if echo "$SNAPSHOT" | grep -qi "textarea\|input.*placeholder"; then
  echo "PASS: Chat input found"
else
  echo "FAIL: Chat input not found"
  exit 1
fi

echo ""
echo "=== All checks passed ==="
