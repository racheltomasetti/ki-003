#!/usr/bin/env bash
# Quick diagnostic loop for the propose_artifact tool-calling path — no UI
# click-through. Calls the deployed edge function directly and prints the
# full JSON response (response / citations / artifact), so we can see
# exactly what Claude did without checking Dashboard logs.
#
# Usage:
#   ACCESS_TOKEN=<jwt> ./scripts/test-artifact.sh chat "write me a short paragraph about starting over"
#   ACCESS_TOKEN=<jwt> PURSUIT_ID=<uuid> ./scripts/test-artifact.sh pursuit "draft a stance on this"
#
# Getting ACCESS_TOKEN: while signed into the app in your browser, open
# DevTools → Application → Local Storage → your Supabase project's origin →
# find the key starting with "sb-" and ending in "-auth-token" → copy the
# "access_token" field from its JSON value. It's a short-lived session
# token, not your password — safe to paste into a terminal for one-off use.

set -euo pipefail

ENV_FILE="$(dirname "$0")/../apps/web/.env.local"
SUPABASE_URL=$(grep NEXT_PUBLIC_SUPABASE_URL "$ENV_FILE" | cut -d '=' -f2-)
ANON_KEY=$(grep NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY "$ENV_FILE" | cut -d '=' -f2-)

MODE="${1:-}"
MESSAGE="${2:-}"

if [[ -z "$MODE" || -z "$MESSAGE" ]]; then
  echo "Usage: ACCESS_TOKEN=<jwt> [PURSUIT_ID=<uuid>] $0 <chat|pursuit> \"<message>\"" >&2
  exit 1
fi

if [[ -z "${ACCESS_TOKEN:-}" ]]; then
  echo "Missing ACCESS_TOKEN — see script header for how to get one." >&2
  exit 1
fi

if [[ "$MODE" == "pursuit" ]]; then
  if [[ -z "${PURSUIT_ID:-}" ]]; then
    echo "Missing PURSUIT_ID (required for pursuit mode)." >&2
    exit 1
  fi
  FN="pursuit-agent"
  BODY=$(printf '{"pursuit_id":"%s","message":"%s","conversation_history":[]}' "$PURSUIT_ID" "$MESSAGE")
elif [[ "$MODE" == "chat" ]]; then
  FN="chat-with-ki"
  BODY=$(printf '{"message":"%s","history":[]}' "$MESSAGE")
else
  echo "First argument must be 'chat' or 'pursuit', got: $MODE" >&2
  exit 1
fi

echo "→ POST $SUPABASE_URL/functions/v1/$FN"
echo "→ message: $MESSAGE"
echo ""

RESPONSE=$(curl -sS -X POST "$SUPABASE_URL/functions/v1/$FN" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "$BODY")

if command -v jq >/dev/null 2>&1; then
  echo "$RESPONSE" | jq .
else
  echo "$RESPONSE"
fi
