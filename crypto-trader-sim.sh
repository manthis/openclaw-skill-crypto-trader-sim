#!/usr/bin/env bash
# ⚠️ EDUCATIONAL CRYPTO TRADING SIMULATOR — NOT FINANCIAL ADVICE
# Usage: crypto-trader-sim.sh --strategy conservative --capital 100 --coins BTC,ETH,SOL --simulate 30d

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Load config.env if present
[[ -f "$SCRIPT_DIR/config.env" ]] && export $(grep -v '^#' "$SCRIPT_DIR/config.env" | grep '=' | xargs)

# Build if needed
if [[ ! -d "$SCRIPT_DIR/dist" ]]; then
  echo "🔨 Building TypeScript..."
  cd "$SCRIPT_DIR" && npx tsc 2>/dev/null || {
    echo "⚠️ Build failed, trying ts-node..."
    cd "$SCRIPT_DIR" && npx ts-node src/index.ts "$@"
    exit $?
  }
fi

# Run
node "$SCRIPT_DIR/dist/index.js" "$@"
