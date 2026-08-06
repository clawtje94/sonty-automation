#!/bin/bash
# Na ELKE wijziging aan planner/verzend/daemon-code draaien (les 06-08: de
# verzoek-daemon draaide uren met verouderde modules in het geheugen en stuurde
# daardoor kapotte berichten). Herstart alles wat keten-code in het geheugen houdt.
launchctl kickstart -k gui/501/nl.sonty.inmeet-verzoeken 2>/dev/null && echo "verzoek-daemon herstart"
launchctl kickstart -k gui/501/nl.sonty.sonny 2>/dev/null && echo "ai-ks-daemon herstart"
launchctl kickstart -k gui/501/nl.sonty.email 2>/dev/null && echo "email-daemon herstart"
