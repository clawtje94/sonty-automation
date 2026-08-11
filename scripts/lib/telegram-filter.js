// TELEGRAM-POORTWACHTER (Daimy 11-08: "zorg dat ik niet steeds onnodig veel
// telegram-berichten krijg, alleen degene waar ik om heb gevraagd").
//
// Er stuurden tientallen scripts naar Telegram en elk vond zichzelf belangrijk.
// Daarom vanaf nu een allowlist: alleen wat Daimy expliciet heeft gevraagd komt door.
//
//   1. VRAGEN aan Daimy (kopje VRAAG, V1/V2-nummering) — hij moet kunnen antwoorden
//   2. BOEKINGEN (regel 09-08: alleen "GEBOEKT" in de planning-groep)
//   3. RAPPORTEN (dagrapport, conversie, teken, capaciteit, gesprek-lab-bevindingen)
//   4. LEERVRAGEN en URGENTE escalaties (instructie 20 juli)
//   5. ECHTE ALARMEN (iets is stuk of vraagt actie) — maar één keer per soort per
//      6 uur, want "aanbod-register onbereikbaar" om de tien minuten is ook ruis
//
// Al het andere — reminders verstuurd, nieuw aanbod aangevraagd, klant reageerde,
// procesgeluk — gaat naar logs/telegram-onderdrukt.log en NIET naar Daimy's telefoon.
const fs = require('fs');
const path = require('path');

const LOG = path.join(__dirname, '..', '..', 'logs', 'telegram-onderdrukt.log');
const DEDUP = path.join(__dirname, '..', '..', 'data', 'telegram-alarm-dedup.json');
const ALARM_VENSTER_UUR = 6;

const VRAAG = /(^|\n)\s*(VRAAG|V\d+[:\s])/m;
const BOEKING = /GEBOEKT/;
const RAPPORT = /AI-resultaten|Tekenrapport|onversie|apaciteit|Gesprek-lab|dagrapport|weekrapport|maandrapport|📊|✍️|🔬/;
const LEERVRAAG_URGENT = /🎓|🚨|LEERVRAAG|URGENT/i;
const ALARM = /actie nodig|handmatig|mens nodig|NIET geboekt|MISLUKT|GESTOPT|gecrasht|onbereikbaar|niet op te halen|SCHIJN-BOEKING|zelfcontrole|dood gesprek|dubbel/i;

/**
 * @param {string} tekst
 * @param {{boeking?: boolean}} opties
 * @returns {{door: boolean, reden: string}}
 */
function magDoor(tekst, { boeking = false } = {}) {
  const t = String(tekst || '');
  if (boeking || BOEKING.test(t)) return { door: true, reden: 'boeking' };
  if (VRAAG.test(t)) return { door: true, reden: 'vraag' };
  if (RAPPORT.test(t)) return { door: true, reden: 'rapport' };
  if (LEERVRAAG_URGENT.test(t)) return { door: true, reden: 'leervraag/urgent' };
  if (ALARM.test(t)) {
    // zelfde soort alarm maar één keer per venster
    const sleutel = t.replace(/\d+/g, '#').replace(/\s+/g, ' ').slice(0, 60);
    let dedup = {};
    try { dedup = JSON.parse(fs.readFileSync(DEDUP, 'utf8')); } catch { /* eerste keer */ }
    const laatst = Date.parse(dedup[sleutel] || 0);
    if (Date.now() - laatst < ALARM_VENSTER_UUR * 3600000) return { door: false, reden: 'alarm-herhaling' };
    dedup[sleutel] = new Date().toISOString();
    for (const [k, v] of Object.entries(dedup)) if (Date.now() - Date.parse(v) > 48 * 3600000) delete dedup[k];
    fs.writeFileSync(DEDUP, JSON.stringify(dedup, null, 1));
    return { door: true, reden: 'alarm' };
  }
  return { door: false, reden: 'procesmelding' };
}

/** Onderdrukt bericht vastleggen zodat niets stilletjes verdwijnt. */
function legVast(tekst, reden) {
  try {
    fs.appendFileSync(LOG, `[${new Date().toISOString()}] (${reden}) ${String(tekst).replace(/\n/g, ' | ').slice(0, 300)}\n`);
  } catch { /* log mag nooit een verzending blokkeren */ }
}

module.exports = { magDoor, legVast };
