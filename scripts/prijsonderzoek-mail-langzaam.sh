#!/bin/zsh
# Verstuurt een batchlijst in porties van N met een pauze ertussen (Proton rate limit). Gebruik: <lijst> <per-portie> <pauze-sec>
cd ~/sonty
LIJST=$1; N=${2:-5}; PAUZE=${3:-3600}
export NODE_PATH=/Users/clawdboot/sonty/node_modules
split -l $N "$LIJST" data/prijsonderzoek/.portie_
for f in data/prijsonderzoek/.portie_*; do
  echo "== $(date '+%H:%M') portie $f"
  node scripts/prijsonderzoek-mail-batch.js "$f"
  rm -f "$f"
  ls data/prijsonderzoek/.portie_* >/dev/null 2>&1 || break
  echo "pauze $PAUZE s"; sleep $PAUZE
done
echo "KLAAR $(date '+%H:%M')"
