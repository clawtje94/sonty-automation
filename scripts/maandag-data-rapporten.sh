#!/bin/bash
# Maandagochtend-datarapporten voor Daimy (databot). Volgorde vast:
# capaciteitsmonitor draait al los om 08:30 (nl.sonty.capaciteit); dit blok volgt om 08:35.
cd /Users/clawdboot/sonty
# Eerst verse sheet-extractie, anders rapporteren de scripts de stand van vorige week!
/opt/homebrew/bin/node scripts/conversie-sheet.js --jaar 2026
/opt/homebrew/bin/node scripts/maak-conversie-tabellen.js --jaar 2026
/opt/homebrew/bin/node scripts/conversie-per-kanaal.js --stuur
/opt/homebrew/bin/node scripts/conversie-productgroep-recent.js --stuur
/opt/homebrew/bin/node scripts/montage-rapport.js --stuur
/opt/homebrew/bin/node scripts/conversie-per-bron.js --stuur
/opt/homebrew/bin/node scripts/openstaande-offertes.js --stuur
