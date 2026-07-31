#!/bin/bash
# Wekelijkse verversing van het conversie-dashboard op sonty.nl (ma 07:45).
# Verse sheet-extractie -> tabellen -> statische pagina -> git push (Vercel deployt).
set -e
cd /Users/clawdboot/sonty
JAAR=$(date +%Y)
VORIG=$((JAAR-1))
/opt/homebrew/bin/node scripts/conversie-sheet.js --jaar $JAAR
/opt/homebrew/bin/node scripts/conversie-sheet.js --jaar $VORIG
/opt/homebrew/bin/node scripts/maak-conversie-tabellen.js --jaar $JAAR
/opt/homebrew/bin/node scripts/maak-conversie-tabellen.js --jaar $VORIG
python3 scripts/meta-campagne-import.py
/opt/homebrew/bin/node scripts/campagne-rendement.js
/opt/homebrew/bin/node scripts/landing-analyse.js
/opt/homebrew/bin/node scripts/ad-spend.js
/opt/homebrew/bin/node scripts/bouw-conversie-dashboard.js
cd /Users/clawdboot/sonty-website
git pull --rebase --quiet || true
if ! git diff --quiet public/dashboards/conversie.html; then
  git add public/dashboards/conversie.html
  git commit -q -m "dashboard: wekelijkse conversie-update $(date '+%Y-%m-%d')

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  git push -q
  echo "dashboard bijgewerkt en gepusht"
else
  echo "geen wijzigingen"
fi
