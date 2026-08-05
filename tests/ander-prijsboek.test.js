#!/usr/bin/env node
/**
 * REGRESSIETEST ander prijsboek (Daimy 2026-08-05, Silvia +31621557981).
 *
 * Silvia kreeg serre zonwering geoffreerd voor haar lichtstraat. Dat product bleek langer te
 * worden dan de uitbouw zelf, dus het paste helemaal niet. Zulk werk loopt via een ander
 * prijsboek dan het gewone assortiment: de prijzen die de bot kent gelden daar niet.
 *
 * Daarom is dit een harde blokkade in de tools en niet alleen een regel in de prompt. Een
 * instructie kan een model naast zich neerleggen, een geweigerde tool niet.
 *
 *   node tests/ander-prijsboek.test.js
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'ai-ks', 'tools.js'), 'utf8');
const blok = src.match(/const ANDER_PRIJSBOEK[\s\S]*?\n\}/);
if (!blok) { console.error('GEFAALD: de blokkade voor het andere prijsboek is weg uit tools.js.'); process.exit(1); }
eval(blok[0]);

let fouten = 0;
const check = (naam, invoer, gesprek, moetGeblokkeerd) => {
  const r = raaktAnderPrijsboek({ klantTeksten: gesprek }, invoer);
  const ok = r === moetGeblokkeerd;
  if (!ok) { fouten++; console.log(`  FOUT ${naam}: ${r ? 'geblokkeerd' : 'toegestaan'}, verwacht ${moetGeblokkeerd ? 'geblokkeerd' : 'toegestaan'}`); }
  else console.log(`  ok   ${(r ? 'geblokkeerd' : 'toegestaan ')}  ${naam}`);
};

console.log('Moet geblokkeerd worden\n');
check('serre zonwering in de invoer', { product: 'SunControl serre zonwering' }, [], true);
check('lichtstraat in het gesprek', {}, ['ik wil zonwering op mijn lichtstraat'], true);
check('zadeldak', {}, ['het gaat om een zadeldak boven de uitbouw'], true);
check('veranda', {}, ['veranda achter het huis'], true);
check('glazen dak', {}, ['we hebben een glazen dak op de aanbouw'], true);
check('lichtstraten meervoud', {}, ['kunnen jullie ook lichtstraten doen?'], true);

console.log('\nMoet gewoon door kunnen\n');
check('rolluik', { product: 'Rolluik' }, ['gewoon een rolluik voor het slaapkamerraam'], false);
check('screens', { product: 'Zip Design 110' }, ['screens voor de woonkamer'], false);
check('knikarmscherm', { product: 'SunEye' }, ['een knikarmscherm boven het terras'], false);
check('gordijnen', { product: 'Duette' }, ['gordijnen voor de slaapkamer'], false);

console.log('');
if (fouten) { console.error(`GEFAALD: ${fouten} fout(en)`); process.exit(1); }
console.log('GESLAAGD: lichtstraat, zadeldak, serre en veranda gaan naar een mens; de rest kan de bot gewoon doen.');
