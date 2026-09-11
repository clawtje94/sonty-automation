#!/bin/zsh
# Menselijk tempo: 1 mail per keer, 8-15 min ertussen, alleen tussen 09:00 en 18:00. Gebruik: <lijst>
cd ~/sonty
export NODE_PATH=/Users/clawdboot/sonty/node_modules
LIJST=$1
while read -r regel; do
  [ -z "$regel" ] && continue
  H=$(date +%H)
  while [ "$H" -ge 18 ] || [ "$H" -lt 9 ]; do echo "$(date '+%d-%m %H:%M') buiten kantoortijd, wachten"; sleep 1800; H=$(date +%H); done
  echo "$regel" > data/prijsonderzoek/.rustig_een.txt
  echo "== $(date '+%d-%m %H:%M') $regel"
  node scripts/prijsonderzoek-mail-batch.js data/prijsonderzoek/.rustig_een.txt
  P=$(( 480 + RANDOM % 420 ))
  echo "pauze $P s"; sleep $P
done < "$LIJST"
rm -f data/prijsonderzoek/.rustig_een.txt
echo "KLAAR $(date '+%d-%m %H:%M')"
