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
/opt/homebrew/bin/node scripts/lasten-import.js
python3 scripts/meta-campagne-import.py
/opt/homebrew/bin/node scripts/campagne-rendement.js
/opt/homebrew/bin/node scripts/landing-analyse.js
/opt/homebrew/bin/node scripts/ad-spend.js
/opt/homebrew/bin/node scripts/bouw-conversie-dashboard.js
cd /Users/clawdboot/sonty-website
# Eerst het dashboard zelf vastleggen, DAARNA pas pullen. Andersom faalt de rebase op
# "You have unstaged changes" en eindigt de taak met exit 128: het dashboard stond dan
# wel op schijf maar kwam nooit live (gezien 10-08).
if ! git diff --quiet public/dashboards/conversie.html; then
  git add public/dashboards/conversie.html
  git commit -q -m "dashboard: wekelijkse conversie-update $(date '+%Y-%m-%d')

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  # Andere losse wijzigingen in de repo (documenten, experimenten) mogen deze taak niet
  # blokkeren: even wegzetten, rebasen, terugzetten.
  STASH=$(git stash push -u -q -m "dashboard-update auto" 2>/dev/null && echo ja || echo nee)
  git pull --rebase --quiet || true
  [ "$STASH" = "ja" ] && git stash pop -q 2>/dev/null || true
  # Onder launchd is er geen toegang tot de GitHub-inloggegevens (geen keychain), dus
  # een push faalt daar met "could not read Username". Dat is geen reden om de hele
  # taak als mislukt te markeren: het dashboard is gemaakt en lokaal vastgelegd, en
  # gaat mee met de eerstvolgende push. Wel zichtbaar melden.
  if git push -q 2>/dev/null; then
    echo "dashboard bijgewerkt en gepusht"
  else
    echo "dashboard bijgewerkt en lokaal vastgelegd; pushen lukte niet (geen GitHub-toegang onder launchd) — gaat mee met de volgende push"
  fi
else
  echo "geen wijzigingen"
fi
