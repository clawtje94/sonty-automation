#!/bin/bash
# Telegram helper voor Claude <> Daimy communicatie
# Gebruik:
#   telegram.sh send "bericht"        — stuur bericht
#   telegram.sh knock "bericht"       — stuur 3x met 5s pauze (voor notificaties)
#   telegram.sh poll [timeout_sec]    — wacht op nieuw bericht (default 60s)
#   telegram.sh check                 — check laatste bericht (geen wacht)

set -euo pipefail

TOKEN="8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40"
CHAT_ID="1700128390"
API="https://api.telegram.org/bot${TOKEN}"

send() {
  local text="$1"
  curl -s -X POST "${API}/sendMessage" \
    -H "Content-Type: application/json" \
    -d "$(python3 -c "import json; print(json.dumps({'chat_id': '${CHAT_ID}', 'text': '''${text}'''}))")" \
    | python3 -c "import sys,json; r=json.load(sys.stdin); print('sent' if r.get('ok') else 'error')"
}

knock() {
  local text="$1"
  send "🔔 ${text}"
  sleep 5
  send "🔔🔔 ${text}"
  sleep 5
  send "🔔🔔🔔 Ik heb je goedkeuring nodig! Check bovenstaand bericht."
}

check() {
  curl -s "${API}/getUpdates" | python3 -c "
import sys, json
data = json.load(sys.stdin)
msgs = data.get('result', [])
if msgs:
    last = msgs[-1]['message']
    print(f\"[{last['date']}] {last['from']['first_name']}: {last['text']}\")
else:
    print('geen berichten')
"
}

poll() {
  local timeout="${1:-60}"
  local interval=5
  local elapsed=0

  # Haal huidige laatste update_id op
  local last_id=$(curl -s "${API}/getUpdates" | python3 -c "
import sys, json
data = json.load(sys.stdin)
msgs = data.get('result', [])
print(msgs[-1]['update_id'] if msgs else 0)
")

  echo "Wachten op nieuw bericht (max ${timeout}s)..."

  while [ $elapsed -lt $timeout ]; do
    sleep $interval
    elapsed=$((elapsed + interval))

    local new_msg=$(curl -s "${API}/getUpdates" | python3 -c "
import sys, json
data = json.load(sys.stdin)
msgs = data.get('result', [])
for m in msgs:
    if m['update_id'] > ${last_id} and not m['message']['from'].get('is_bot', False):
        print(m['message']['text'])
        break
")

    if [ -n "$new_msg" ]; then
      echo "ANTWOORD: $new_msg"
      exit 0
    fi
  done

  echo "TIMEOUT: geen antwoord na ${timeout}s"
  exit 1
}

case "${1:-help}" in
  send)  send "${2:-Geen bericht}" ;;
  knock) knock "${2:-Ik heb je aandacht nodig!}" ;;
  check) check ;;
  poll)  poll "${2:-60}" ;;
  *)     echo "Gebruik: telegram.sh {send|knock|poll|check} [bericht/timeout]" ;;
esac
