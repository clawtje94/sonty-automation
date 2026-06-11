#!/bin/bash

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$HOME/sonty}"

if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  source "$PROJECT_DIR/.env"
  set +a
fi

if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${TELEGRAM_CHAT_ID:-}" ]; then
  echo "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID"
  exit 1
fi

MESSAGE="${*:-No message provided}"

curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d "$(printf '{"chat_id":"%s","text":"%s"}' "$TELEGRAM_CHAT_ID" "$(printf '%s' "$MESSAGE" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read())[1:-1])')")" \
  > /dev/null

echo "Telegram notification sent."
