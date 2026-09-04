#!/bin/zsh
# DAGELIJKSE E-MAIL-SYNC (Daimy 2026-07-27).
#
# Houdt de klantdata in Klaviyo actueel. Dit VERSTUURT NIETS: het werkt alleen profielvelden bij,
# waarna de segmenten zichzelf opnieuw vullen.
#
# Waarom dit dagelijks moet: de fase van een klant schuift met de tijd. Wie vandaag "vers" is
# (offerte jonger dan 14 dagen) is over twee weken "lopend" en na twee maanden "koud". Zonder deze
# run blijft iedereen hangen in de fase van de dag van de eerste import, en dan krijgt straks de
# verkeerde groep de verkeerde mail.
#
# Even belangrijk: de opt-outs worden elke ronde opnieuw opgehaald. Zet de klantenservice iemand
# vandaag op "geen herinnering meer", dan valt die persoon morgen uit alle segmenten.
#
# Draait via launchd (nl.sonty.email-sync), elke dag om 06:30.

set -u
cd "$HOME/sonty" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

echo "===== $(date '+%Y-%m-%d %H:%M') ====="

echo "[1/3] Reuzenpanda uitlezen"
node scripts/email/rp-export.js || { echo "export mislukt, stoppen"; exit 1; }

echo "[2/3] Opt-outs markeren"
node scripts/email/verrijk-optout.js || { echo "opt-out-stap mislukt, stoppen om te voorkomen dat iemand alsnog een mail zou kunnen krijgen"; exit 1; }

echo "[3/3] Profielen bijwerken in Klaviyo"
node scripts/email/klaviyo-profielen.js --doe-het || { echo "profielsync mislukt"; exit 1; }

echo "[4/5] Akkoord-events naar Klaviyo (conversietracking)"
node scripts/email/akkoord-events.js || echo "akkoord-events mislukt (niet fataal)"

echo "[5/5] Montage-events naar Klaviyo (trigger flow E: nazorg + review PAS na montage, Daimy 04-09)"
node scripts/email/montage-events.js || echo "montage-events mislukt (niet fataal)"

echo "Klaar. Er is niets verstuurd."
