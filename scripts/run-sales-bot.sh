#!/bin/bash
cd /Users/clawdboot/sonty
export ANTHROPIC_API_KEY=$(cat scripts/.anthropic-api-key.txt)
export NODE_NO_WARNINGS=1
node scripts/ai-sales-bot.js once 2>> logs/sales-bot-error.log || true
