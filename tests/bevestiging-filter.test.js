#!/usr/bin/env node
/**
 * REGRESSIETEST bevestigingsfilter (Daimy 2026-07-27).
 *
 * Het filter negeert korte bevestigingen ("top, bedankt") zodat de bot niet blijft doorpraten na
 * een afgerond gesprek. Maar het keek alleen naar wat de klant zei, niet naar wat wij net vroegen.
 * Bij ticket 968750981 vroeg de bot "Zal ik alvast een prijsindicatie klaarzetten?", antwoordde de
 * klant "Prima", en gebeurde er 2,5 uur niets omdat "prima" in de bevestigingslijst staat.
 *
 * Deze test draait beide kanten over de echte WhatsApp-gesprekken:
 *  - een kort ja NA een vraag van ons moet doorgaan (anders kost het een deal)
 *  - een kort bedankje na een gewoon bericht moet blijven zwijgen (anders gaat hij doorzeuren)
 *
 * Draai na elke wijziging aan BEVESTIG_WOORDEN of aan de isBevestiging-regel:
 *   node tests/bevestiging-filter.test.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'scripts/ai-ks/daemon.js'), 'utf8');
const woorden = src.match(/const BEVESTIG_WOORDEN = new Set\(\[([\s\S]*?)\]\)/)[1]
  .replace(/[\n\s']/g, '').split(',').filter(Boolean);

// Controleer dat de contextregel er nog in zit; zonder die regel valt de bug terug.
if (!/wijVroegenIets/.test(src)) {
  console.error('GEFAALD: de check op "vroegen wij net iets" is weg uit daemon.js.');
  console.error('Zonder die check zwijgt de bot weer als een klant kort ja zegt op zijn eigen vraag.');
  process.exit(1);
}

// Exact de regel uit daemon.js.
function zwijgt(klantTekst, onsLaatsteBericht) {
  const zonderEmoji = String(klantTekst).replace(/[\p{Extended_Pictographic}‍️\u{1F3FB}-\u{1F3FF}]/gu, '').trim();
  const w = zonderEmoji.toLowerCase().replace(/[!.,;:👍🤝🙏😊🎉'"()-]/g, ' ').split(/\s+/).filter(Boolean);
  const wijVroegenIets = /\?/.test(String(onsLaatsteBericht || '').slice(-200));
  return !wijVroegenIets && !/\?/.test(klantTekst) && zonderEmoji.length <= 45
    && (w.length === 0 || w.every((x) => woorden.includes(x)));
}

const gesprekken = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/trengo-alle-gesprekken.json'), 'utf8'))
  .filter((x) => x.channel_type === 'WA_BUSINESS');

let gemistNaVraag = 0, correctStil = 0, correctDoor = 0, tochDoorgezeurd = 0;
for (const t of gesprekken) {
  const m = (t.messages || []).slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  for (let i = 1; i < m.length; i++) {
    const cur = m[i], prev = m[i - 1];
    const isInbound = cur.type === 'INBOUND' || cur.direction === 'inbound';
    const prevIsBot = prev.type === 'OUTBOUND' || prev.direction === 'outbound';
    if (!isInbound || !prevIsBot) continue;
    const tekst = String(cur.body || cur.message || '').trim();
    const prevTekst = String(prev.body || prev.message || '').trim();
    if (!tekst) continue;
    // alleen de korte bevestigingen zijn interessant
    const zonderEmoji = tekst.replace(/[\p{Extended_Pictographic}‍️\u{1F3FB}-\u{1F3FF}]/gu, '').trim();
    const w = zonderEmoji.toLowerCase().replace(/[!.,;:👍🤝🙏😊🎉'"()-]/g, ' ').split(/\s+/).filter(Boolean);
    const isKortJa = !/\?/.test(tekst) && zonderEmoji.length <= 45 && (w.length === 0 || w.every((x) => woorden.includes(x)));
    if (!isKortJa) continue;

    const wijVroegen = /\?/.test(prevTekst.slice(-200));
    const stil = zwijgt(tekst, prevTekst);
    if (wijVroegen && stil) gemistNaVraag++;
    else if (wijVroegen && !stil) correctDoor++;
    else if (!wijVroegen && stil) correctStil++;
    else tochDoorgezeurd++;
  }
}

console.log('Regressietest bevestigingsfilter, op de echte WhatsApp-gesprekken\n');
console.log(`  kort ja NA onze vraag, bot pakt door:      ${correctDoor}  (goed)`);
console.log(`  kort ja NA onze vraag, bot zwijgt:         ${gemistNaVraag}  (fout, kost een deal)`);
console.log(`  afsluitend bedankje, bot zwijgt:           ${correctStil}  (goed)`);
console.log(`  afsluitend bedankje, bot praat door:       ${tochDoorgezeurd}  (fout, gaat zeuren)`);

if (gemistNaVraag > 0 || tochDoorgezeurd > 0) { console.error('\nGEFAALD'); process.exit(1); }
console.log('\nGESLAAGD: doorpakken waar de klant ja zegt, zwijgen waar het een afscheid is.');
