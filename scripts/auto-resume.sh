#!/bin/bash
# Auto-resume: check elke 5 min of Anthropic tokens beschikbaar zijn
# Als ja → start Claude Code met de sync taken
# Als nee → wacht en probeer opnieuw

LOGFILE="$HOME/sonty/logs/auto-resume.log"
LOCKFILE="/tmp/claude-auto-resume.lock"
WORK_DIR="$HOME/sonty"

# Voorkom dubbele runs
if [ -f "$LOCKFILE" ]; then
  PID=$(cat "$LOCKFILE")
  if kill -0 "$PID" 2>/dev/null; then
    exit 0
  fi
  rm -f "$LOCKFILE"
fi
echo $$ > "$LOCKFILE"
trap "rm -f $LOCKFILE" EXIT

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOGFILE"
}

log "Auto-resume check gestart"

# Check of Claude Code beschikbaar is (snelle test)
RESULT=$(cd "$WORK_DIR" && timeout 30 claude -p "echo ok" --no-input 2>&1)

if echo "$RESULT" | grep -qi "out of.*usage\|rate.limit\|quota\|token.*limit"; then
  log "Tokens nog niet beschikbaar. Wacht tot volgende check."
  exit 0
fi

if echo "$RESULT" | grep -q "ok"; then
  log "Tokens beschikbaar! Claude Code wordt gestart..."

  # Start Claude Code met de standaard taken
  cd "$WORK_DIR" && claude -p "$(cat <<'PROMPT'
Je bent weer online na een token reset. Doe het volgende:
1. Run de RP→HubSpot sync: cd ~/sonty && node scripts/cron-sync-rp-hubspot.js 2>&1 | tail -5
2. Check Telegram voor nieuwe berichten
3. Rapporteer kort wat er is gebeurd
PROMPT
)" --no-input >> "$LOGFILE" 2>&1

  log "Claude Code sessie afgerond."
else
  log "Onverwacht resultaat: $(echo "$RESULT" | head -3)"
fi
