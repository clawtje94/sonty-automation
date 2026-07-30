#!/bin/bash
# Maandagochtend-datarapporten voor Daimy (databot). Volgorde vast:
# capaciteitsmonitor draait al los om 08:30 (nl.sonty.capaciteit); dit blok volgt om 08:35.
cd /Users/clawdboot/sonty
/opt/homebrew/bin/node scripts/conversie-per-kanaal.js --stuur
/opt/homebrew/bin/node scripts/conversie-productgroep-recent.js --stuur
