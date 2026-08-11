#!/usr/bin/env node
// WIE ANTWOORDT ER OP TELEGRAM (Daimy 11-08: "reageer altijd alleen met de terminal die
// ermee bezig is, want je reageert nu met een paar tegelijk").
//
// Er draaien vaak meerdere Claude-sessies naast elkaar, en die lazen allemaal dezelfde
// inbox en antwoordden allemaal. Daimy kreeg drie versies van hetzelfde antwoord.
//
// Dit is de claim: een bestandje dat zegt welke sessie op dit moment het gesprek met
// Daimy voert. De REGEL (staat ook in memory, elke sessie leest hem bij de start):
//   - vóór je op een Telegram-bericht reageert: `node scripts/telegram-claim.js check <mijn-id>`
//     → exit 0 = jij mag antwoorden; exit 1 = een andere sessie is bezig, blijf stil.
//   - antwoord je, claim dan: `node scripts/telegram-claim.js claim <mijn-id> "<onderwerp>"`
//   - een claim verloopt vanzelf na 30 minuten stilte; klaar met het onderwerp → `release <mijn-id>`
//   - <mijn-id> = de sessie-uuid uit het scratchpad-pad van de sessie (uniek per terminal).
// Spreekt Daimy expliciet een ander onderwerp of andere terminal aan, dan mag een verse
// sessie claimen zodra de oude claim verlopen is.
const fs = require('fs');
const path = require('path');

const BESTAND = path.join(__dirname, '..', 'data', 'telegram-claim.json');
const VERLOOP_MIN = 30;

function lees() {
  try { return JSON.parse(fs.readFileSync(BESTAND, 'utf8')); } catch { return null; }
}
function verlopen(c) { return !c || (Date.now() - Date.parse(c.op)) > VERLOOP_MIN * 60000; }

const [actie, id, onderwerp] = process.argv.slice(2);
const claim = lees();

if (actie === 'check') {
  if (verlopen(claim) || claim.sessie === id) { console.log('vrij' + (claim && claim.sessie === id ? ' (eigen claim)' : '')); process.exit(0); }
  console.log(`bezet door sessie ${claim.sessie.slice(0, 8)} (${claim.onderwerp || '?'}, ${Math.round((Date.now() - Date.parse(claim.op)) / 60000)} min geleden) — NIET antwoorden`);
  process.exit(1);
} else if (actie === 'claim') {
  if (!verlopen(claim) && claim.sessie !== id) {
    console.log(`geweigerd: sessie ${claim.sessie.slice(0, 8)} is bezig met "${claim.onderwerp || '?'}"`);
    process.exit(1);
  }
  fs.writeFileSync(BESTAND, JSON.stringify({ sessie: id, onderwerp: onderwerp || '', op: new Date().toISOString() }, null, 1));
  console.log('geclaimd');
} else if (actie === 'release') {
  if (claim && claim.sessie === id) { fs.unlinkSync(BESTAND); console.log('vrijgegeven'); }
  else console.log('geen eigen claim');
} else {
  console.log('gebruik: telegram-claim.js check|claim|release <sessie-id> ["onderwerp"]');
  process.exit(2);
}
