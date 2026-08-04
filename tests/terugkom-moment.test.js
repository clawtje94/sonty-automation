#!/usr/bin/env node
/**
 * REGRESSIETEST terugkom-moment (Daimy 2026-08-04, Ebru +31616463983).
 *
 * Ebru schreef twee keer dat ze het "voor donderdag 6 augustus" zou laten weten, en kreeg
 * dinsdagochtend al een reminder. De opvolging stuurde namelijk altijd na ongeveer 22 uur,
 * ongeacht wat de klant had afgesproken. Precies het tegenovergestelde van wat ze vroeg.
 *
 * Daarnaast stond ze in Trengo met een emoji als naam, waardoor de bot letterlijk
 * "Hoi 🤷🏻‍♀️," stuurde.
 *
 *   node tests/terugkom-moment.test.js
 */
const { terugkomMoment, bruikbareVoornaam } = require('../scripts/ai-ks/terugkom-moment.js');

let fouten = 0;
const check = (naam, echt, verwacht) => {
  const ok = echt === verwacht;
  if (!ok) { fouten++; console.log(`  FOUT ${naam}: kreeg ${JSON.stringify(echt)}, verwacht ${JSON.stringify(verwacht)}`); }
  else console.log(`  ok   ${naam}`);
};
const dagNaam = (ms) => new Date(ms).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });

// Maandag 3 augustus 2026, 07:54 (het echte tijdstip van haar tweede bericht).
// Let op de weekdagen: 3 aug is maandag, 4 dinsdag, 5 woensdag, 6 donderdag.
const MAANDAG = new Date('2026-08-03T07:54:00+02:00').getTime();
const ZATERDAG = new Date('2026-08-01T13:56:00+02:00').getTime();

console.log('Het moment dat de klant zelf noemde\n');
check('Ebru: "voor donderdag 6 augustus" (zaterdag gezegd)',
  dagNaam(terugkomMoment('ik laat het weten voor donderdag 6 augustus', ZATERDAG).tijd), 'donderdag 6 augustus');
check('Ebru: "voor donderdag" (maandag gezegd)',
  dagNaam(terugkomMoment('ik laat het voor donderdag weten', MAANDAG).tijd), 'donderdag 6 augustus');
check('morgen', dagNaam(terugkomMoment('ik kom er morgen op terug', MAANDAG).tijd), 'dinsdag 4 augustus');
check('overmorgen', dagNaam(terugkomMoment('overmorgen laat ik het weten', MAANDAG).tijd), 'woensdag 5 augustus');
check('vanavond wordt de ochtend erna',
  dagNaam(terugkomMoment('ik laat het vanavond weten', MAANDAG).tijd), 'dinsdag 4 augustus');
check('volgende week is niet twee weken',
  dagNaam(terugkomMoment('volgende week hoor je het', MAANDAG).tijd), 'maandag 10 augustus');

console.log('\nGeen moment genoemd: dan de oude regel van 22 uur\n');
const zonder = terugkomMoment('ik moet even met mijn man overleggen', MAANDAG);
check('valt terug op 22 uur', Math.round((zonder.tijd - MAANDAG) / 3600000), 22);

console.log('\nNooit te vroeg\n');
for (const [tekst, minimaal] of [
  ['ik laat het voor donderdag weten', 24],
  ['ik kom er morgen op terug', 12],
  ['volgende week hoor je het', 24],
]) {
  const uren = (terugkomMoment(tekst, MAANDAG).tijd - MAANDAG) / 3600000;
  check(`"${tekst.slice(0, 34)}" wacht minstens ${minimaal}u`, uren >= minimaal, true);
}

console.log('\nAanhef\n');
check('emoji als naam wordt overgeslagen', bruikbareVoornaam('🤷🏻‍♀️'), null);
check('gewone naam', bruikbareVoornaam('Ebru'), 'Ebru');
check('kleine letter wordt hoofdletter', bruikbareVoornaam('ebru kilinc'), 'Ebru');
check('koppelnaam blijft heel', bruikbareVoornaam('Jan-Willem'), 'Jan-Willem');
check('cijfers zijn geen naam', bruikbareVoornaam('123'), null);
check('leeg is geen naam', bruikbareVoornaam(''), null);

console.log('');
if (fouten) { console.error(`GEFAALD: ${fouten} fout(en)`); process.exit(1); }
console.log('GESLAAGD: we volgen op wanneer de klant dat zei, en nooit met een emoji als aanhef.');
