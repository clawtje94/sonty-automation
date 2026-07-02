#!/bin/bash
# Veilige v4-runner: draait de offertecontrole alleen als de code gezond is.
# Beschermt tegen half-bewerkte code (er wordt in deze repo live gewerkt) —
# faalt de syntax-check of de regressietest, dan draait de laatste goede
# versie en gaat er een Telegram-alert uit.

SCRIPTS=/Users/clawdboot/sonty/scripts
NODE=/opt/homebrew/bin/node
V4=$SCRIPTS/cron-offerte-controle-v4-combined.js
LASTGOOD=$SCRIPTS/.v4-last-good.js
TG_TOKEN="8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40"
TG_CHAT="1700128390"

tg() {
  curl -s -X POST "https://api.telegram.org/bot$TG_TOKEN/sendMessage" \
    -d chat_id=$TG_CHAT --data-urlencode "text=$1" > /dev/null 2>&1
}

cd /Users/clawdboot/sonty || exit 1

if $NODE --check "$V4" 2>/dev/null && $NODE "$SCRIPTS/tests/verify-fixes.js" > /tmp/v4-pretest.log 2>&1; then
  cp "$V4" "$LASTGOOD"
  exec $NODE "$V4"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] PRE-CHECK GEFAALD — zie /tmp/v4-pretest.log"
  tail -5 /tmp/v4-pretest.log 2>/dev/null
  if [ -f "$LASTGOOD" ]; then
    tg "⚠️ v4-code faalt de pre-check (syntax of regressietest) — de LAATSTE GOEDE versie draait nu in plaats daarvan. Check wie er in het script aan het werk is."
    exec $NODE "$LASTGOOD"
  else
    tg "❌ v4-code faalt de pre-check en er is nog geen last-good versie — run OVERGESLAGEN."
    exit 1
  fi
fi
