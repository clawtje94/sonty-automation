#!/usr/bin/env node
/**
 * REGRESSIETEST akkoord-guard (Daimy 2026-07-26).
 *
 * WAAROM DIT BESTAND ER ZO UITZIET
 * De eerste versie draaide op data/ai-ks/log.jsonl. Dat leek de juiste bron, maar de log bewaart
 * per ronde alleen het LAATSTE klantbericht: stuurt een klant twee berichten snel na elkaar, dan
 * verdwijnt het eerste. En berichten die een MENS afhandelde staan helemaal niet in de AI-log.
 *
 * Daardoor trok ik twee conclusies die niet waar waren:
 *  - "Ticket 963479853 is doorgezet zonder akkoord." Fout: de bot vroeg om 11:20 "Zal ik een
 *    inmeetafspraak inplannen?", de klant zei om 11:48 "Is goed" en stuurde om 11:49 nog een
 *    kleurvraag. In de log bleef alleen die kleurvraag over.
 *  - "Max Beije (965819789) is doorgezet zonder akkoord." Fout: hij mailde op 13 juli letterlijk
 *    "Akkoord met de offerte." Joey handelde dat af, dus het kwam nooit in de AI-log.
 *
 * Daarom test dit bestand tegen de ECHTE Trengo-gesprekken in
 * tests/fixtures-akkoord-gesprekken.json. Let op: de Trengo messages-endpoint pagineert met 20 per
 * pagina. De fixture is mét paginering opgehaald: 341 klantberichten in plaats van de 186 die je
 * met alleen pagina 1 krijgt.
 *
 * Draai na elke wijziging aan AKKOORD_TAAL of aan ctx.klantTeksten:
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

const gesprekken = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures-akkoord-gesprekken.json'), 'utf8'));

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Exact de guard uit tools.js: het citaat moet in een klantbericht van dit gesprek staan én
// instemming uitdrukken.
function guard(citaat, klantTeksten) {
  const c = norm(citaat);
  const k = klantTeksten.map(norm).join(' | ');
  if (!c || (!(k.includes(c) || k.includes(c.slice(0, 15))) && c.length >= 12)) return 'BLOK';
  if (!AKKOORD_TAAL.test(citaat)) return 'BLOK';
  return 'DOOR';
}

let valsPositief = 0, valsNegatief = 0;
const fouten = [];

// DEEL 1 — alle 33 klanten die daadwerkelijk naar de planning zijn doorgezet. Bij alle 33 is in
// het complete gesprek een akkoord terug te vinden, dus geen enkele mag geblokkeerd worden:
// elke blokkade hier is een gemiste deal.
for (const [id, msgs] of Object.entries(gesprekken)) {
  const teksten = msgs.map((x) => x.tekst);
  const citaat = [...teksten].reverse().find((t) => AKKOORD_TAAL.test(t));
  if (!citaat) {
    valsPositief++;
    fouten.push(`VALS-POSITIEF #${id}: geen akkoord herkend, terwijl deze klant wél akkoord gaf`);
    continue;
  }
  if (guard(citaat, teksten) !== 'DOOR') {
    valsPositief++;
    fouten.push(`VALS-POSITIEF #${id}: echt akkoord geblokkeerd op "${citaat.slice(0, 70)}"`);
  }
}

// DEEL 2 — hallucinaties en niet-akkoorden die geweigerd MOETEN worden. Het eerste geval is de
// vorm waarin het echt fout kan gaan: een citaat dat de bot zelf verzint.
const MOET_BLOKKEREN = [
  ['verzonnen citaat', 'bedankt voor het vertrouwen'],
  ['citaat bestaat niet in gesprek', 'ja ik ga akkoord met alles wat je voorstelt'],
  ['leeg citaat', ''],
  ['losse kleurvraag', 'Welke kleuren doek zijn er'],
  ['losse maatinfo', '3M breed 2m lang'],
  ['losse fotovraag', 'Kan je fotos sturen van het product'],
  ['alleen interesse in een product', 'Oke dan wil ik graag zonwering'],
  ['alleen een telefoonnummer', 'Mijn telefoonnummer is 0681144674'],
];
// De berichten van ticket 963479853 als context: die staan er echt in, dus alleen de
// akkoord-taal-check kan deze nog weren.
const CONTEXT = (gesprekken['963479853'] || []).map((x) => x.tekst);
for (const [naam, citaat] of MOET_BLOKKEREN) {
  if (guard(citaat, CONTEXT) === 'DOOR') {
    valsNegatief++;
    fouten.push(`VALS-NEGATIEF (${naam}): "${citaat.slice(0, 60)}" werd doorgelaten`);
  }
}

const n = Object.keys(gesprekken).length;
console.log('Regressietest akkoord-guard, op de ECHTE Trengo-gesprekken');
console.log(`  gesprekken in fixture:            ${n}`);
console.log(`  klantberichten:                   ${Object.values(gesprekken).reduce((a, v) => a + v.length, 0)}`);
console.log(`  echte akkoorden doorgelaten:      ${n - valsPositief}/${n}`);
console.log(`  VALS-POSITIEF (kost een deal):    ${valsPositief}`);
console.log(`  VALS-NEGATIEF (nep doorgelaten):  ${valsNegatief} van ${MOET_BLOKKEREN.length} gecontroleerd`);
for (const f of fouten) console.log('  ' + f);

if (valsPositief || valsNegatief) { console.error('\nGEFAALD'); process.exit(1); }
console.log('\nGESLAAGD: alle echte akkoorden gaan door, alle hallucinaties en niet-akkoorden worden geweigerd.');

// ── DEEL 3: een ondertekende offerte telt óók als akkoord ──
// Toegevoegd 27 juli na Tim Remmel (ticket 968210427). Hij tekende online, dus er stond nooit
// een akkoord-zin in de chat. De guard blokkeerde daardoor, de bot moest escaleren en zei
// "zodra jij akkoord geeft op de offerte", waarop Tim terecht antwoordde "ik heb al getekend".
// Deze test bewaakt dat de status-route in tools.js blijft bestaan, want die is de enige
// uitweg voor klanten die in het document tekenen in plaats van in de chat.
{
  const src2 = fs.readFileSync(path.join(ROOT, 'scripts/ai-ks/tools.js'), 'utf8');
  const heeftStatusRoute = /ACCEPTED\|SIGNED/.test(src2) && /getekendeOfferte/.test(src2);
  console.log(`\nOndertekende offerte telt als akkoord: ${heeftStatusRoute ? 'ja (goed)' : 'NEE'}`);
  if (!heeftStatusRoute) {
    console.error('GEFAALD: de route die een ACCEPTED offerte als akkoord accepteert is weg. Klanten die');
    console.error('online tekenen worden dan opnieuw geblokkeerd, zoals bij Tim Remmel op 27 juli.');
    process.exit(1);
  }
}
