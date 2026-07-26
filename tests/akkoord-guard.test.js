#!/usr/bin/env node
/**
 * REGRESSIETEST akkoord-guard (Daimy 2026-07-26).
 *
 * Waarom dit bestand bestaat: de guard is drie keer aangepast en elke versie leek goed tegen
 * zelfbedachte voorbeelden, maar viel door de mand tegen de échte historie. Een eerste versie
 * blokkeerde 6 van de 26 echte akkoorden (dat kost deals), een tweede liet losse maatinfo door,
 * en een derde liet een citaat van 6 berichten terug passeren. Deze test draait de guard over
 * alle werkelijke doorzettingen uit data/ai-ks/log.jsonl en telt BEIDE foutsoorten.
 *
 * Draai dit na elke wijziging aan AKKOORD_TAAL of aan ctx.klantTeksten:
 *   node tests/akkoord-guard.test.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
// De regex uit de broncode lezen in plaats van kopiëren, zodat test en code niet uit de pas lopen.
const src = fs.readFileSync(path.join(ROOT, 'scripts/ai-ks/tools.js'), 'utf8');
const m = src.match(/const AKKOORD_TAAL = (\/.*\/i);/);
if (!m) { console.error('FOUT: AKKOORD_TAAL niet gevonden in tools.js'); process.exit(1); }
const AKKOORD_TAAL = eval(m[1]);

// Hoeveel klantberichten de guard mag zien (agent.js: .slice(-3)).
const VENSTER = Number((src.match(/slice\(-(\d)\)/) || [])[1]) || 3;

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function guard(citaat, zichtbaar) {
  const c = norm(citaat);
  const k = zichtbaar.map(norm).join(' | ');
  if (!c || (!(k.includes(c) || k.includes(c.slice(0, 15))) && c.length >= 12)) return 'BLOK';
  if (!AKKOORD_TAAL.test(citaat)) return 'BLOK';
  return 'DOOR';
}

// Handmatig vastgesteld na het teruglezen van de gesprekken: deze twee klanten zijn naar de
// planning gestuurd zonder ooit akkoord te geven. 963479853 vroeg "Welke kleuren doek zijn er",
// 965819789 (Max) stuurde alleen zijn telefoonnummer en vroeg daarna zelf of hij niet pas ná
// het inmeten hoefde te ondertekenen.
const GEEN_ECHT_AKKOORD = new Set([963479853, 965819789]);

const regels = fs.readFileSync(path.join(ROOT, 'data/ai-ks/log.jsonl'), 'utf8').trim().split('\n')
  .map((l) => { try { return JSON.parse(l); } catch { return null; } })
  .filter((x) => x && !x.fout);

const perTicket = new Map();
for (const x of regels) {
  const arr = perTicket.get(x.ticket) || [];
  arr.push(x);
  perTicket.set(x.ticket, arr);
}

let valsPositief = 0, valsNegatief = 0, okDoor = 0, okBlok = 0;
const fouten = [];
for (const [id, rs] of perTicket) {
  const i = rs.findIndex((r) => (r.acties || []).some((a) => a.type === 'inmeet_afspraak'));
  if (i < 0) continue;
  const klant = rs.slice(0, i + 1).map((r) => String(r.laatsteKlantBericht || '')).filter(Boolean);
  const zichtbaar = klant.slice(-VENSTER);
  // Beste zet van het model: het meest recente zichtbare bericht met akkoord-taal.
  const citaat = [...zichtbaar].reverse().find((t) => AKKOORD_TAAL.test(t)) || zichtbaar[zichtbaar.length - 1] || '';
  const uitkomst = guard(citaat, zichtbaar);
  const echtAkkoord = !GEEN_ECHT_AKKOORD.has(id);
  if (echtAkkoord && uitkomst === 'BLOK') { valsPositief++; fouten.push(`VALS-POSITIEF #${id}: echt akkoord geblokkeerd op "${citaat.slice(0, 70)}"`); }
  else if (!echtAkkoord && uitkomst === 'DOOR') { valsNegatief++; fouten.push(`VALS-NEGATIEF #${id}: nep akkoord doorgelaten op "${citaat.slice(0, 70)}"`); }
  else if (uitkomst === 'DOOR') okDoor++;
  else okBlok++;
}

console.log(`Regressietest akkoord-guard (venster: laatste ${VENSTER} klantberichten)`);
console.log(`  echte akkoorden correct doorgelaten: ${okDoor}`);
console.log(`  nep akkoorden correct geblokkeerd:   ${okBlok}`);
console.log(`  VALS-POSITIEF (kost een deal):       ${valsPositief}`);
console.log(`  VALS-NEGATIEF (kost planningstijd):  ${valsNegatief}`);
for (const f of fouten) console.log('  ' + f);

if (valsPositief || valsNegatief) { console.error('\nGEFAALD'); process.exit(1); }
console.log('\nGESLAAGD: geen fouten van beide soorten.');
