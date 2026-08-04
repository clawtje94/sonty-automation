#!/usr/bin/env node
/**
 * REGRESSIETEST teamtags en bedankje-guard (Daimy 2026-08-04, casus Irene +31625002169).
 *
 * Twee dingen gingen daar mis, en allebei mogen ze niet terugkomen:
 *  1. Tanya werd nog getagd terwijl ze op vakantie was, omdat de tags op zes plekken hardcoded
 *     stonden en er geen plek was om dat een keer te regelen.
 *  2. Een simpel "Dank je wel!" na een keurig afgerond gesprek zette het ticket terug in Mens
 *     nodig, met opnieuw een tag naar twee collegas. Dat vervuilt de lijst met werk dat er niet is.
 *
 * Draai na elke wijziging aan team-tags.js of aan de bedankje-herkenning:
 *   node tests/team-tags.test.js
 */
const fs = require('fs');
const path = require('path');
const { teamTags, beschikbaar, OVERDRACHT_HERKENNING } = require('../scripts/ai-ks/team-tags.js');

let fouten = 0;
const check = (naam, echt, verwacht) => {
  const ok = JSON.stringify(echt) === JSON.stringify(verwacht);
  if (!ok) { fouten++; console.log(`  FOUT ${naam}: kreeg ${JSON.stringify(echt)}, verwacht ${JSON.stringify(verwacht)}`); }
  else console.log(`  ok   ${naam}`);
};

console.log('Teamtags\n');
// Wie nu afwezig is, staat in data/ai-ks/afwezig.json. De test kijkt naar het gedrag, niet naar
// wie er toevallig op vakantie is, zodat hij ook klopt als Tanya terug is.
const tags = teamTags();
check('er wordt altijd iemand getagd', tags.length > 0 && tags.startsWith('@'), true);
check('geen afwezige collega in de tags',
  tags.split(' ').every((t) => beschikbaar(t.replace('@', ''))), true);

console.log('\nHerkenning van een overdracht\n');
check('overdracht met twee tags', OVERDRACHT_HERKENNING.test('@jorren745487 @tanya748440\n\nDe AI kan dit niet aan'), true);
check('overdracht met een tag', OVERDRACHT_HERKENNING.test('@jorren745487\n\nKlant reageerde opnieuw'), true);
check('bevestiging is GEEN overdracht', OVERDRACHT_HERKENNING.test('@daimy736327 ✅ Verwerkt als vaste kennis.'), false);
check('sonny-opdracht is GEEN overdracht', OVERDRACHT_HERKENNING.test('@sonny kun je dit oppakken?'), false);
check('tag midden in de tekst telt niet', OVERDRACHT_HERKENNING.test('Klant vroeg naar @jorren745487 maar dit is geen overdracht'), false);

console.log('\nBedankje na een overdracht\n');
// De helper staat in daemon.js; hier uitgelezen zodat test en code niet uit de pas lopen.
const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'ai-ks', 'daemon.js'), 'utf8');
eval(src.match(/const BEVESTIG_WOORDEN_GEDEELD[\s\S]*?\n\}/)[0]);

const BEDANKJES = ['Dank je wel!', 'Bedankt hoor', 'Nogmaals bedankt en fijne dag', '👍', 'Prima, ga ik doen', 'Top bedankt!', 'Oke helder, tot ziens'];
const ECHTE_VRAGEN = [
  'Top. Liever donderdag niet bellen, dan is de uitvaart van mijn schoonmoeder.',
  'Kun je dat aanpassen?',
  'Ik wil toch een andere kleur',
  'Bedankt, maar ik wil eerst nog een andere offerte',
  'Wanneer komen jullie?',
];
for (const t of BEDANKJES) check(`bedankje: ${JSON.stringify(t.slice(0, 34))}`, isPuurBedankje(t), true);
for (const t of ECHTE_VRAGEN) check(`echt bericht: ${JSON.stringify(t.slice(0, 34))}`, isPuurBedankje(t), false);

console.log('');
if (fouten) { console.error(`GEFAALD: ${fouten} fout(en)`); process.exit(1); }
console.log('GESLAAGD: afwezige collegas worden niet getagd, en een bedankje heropent geen gesprek.');
