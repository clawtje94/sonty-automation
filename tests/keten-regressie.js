#!/usr/bin/env node
// Regressietests voor de inmeet-planner-keten.
// Elke test hier is een ECHTE bug die op 2026-08-04 gevonden is; deze suite houdt ze weg.
// Draaien: node tests/keten-regressie.js  (geen netwerk nodig, alles puur)
const assert = require('assert');
const { bezetteBlokken, kiesAanbod, rondAf5, MAX_EXTRA_RIJTIJD_MIN } = require('../scripts/lib/slotzoeker');
const { schatDuur, maatToeslag } = require('../scripts/lib/inmeetduur');

let ok = 0, fout = 0;
function test(naam, fn) {
  try { fn(); ok++; console.log(`  ✓ ${naam}`); }
  catch (e) { fout++; console.log(`  ✗ ${naam}\n    ${e.message}`); }
}

const dag = (t) => new Date(`2026-08-20T${t}:00`);

console.log('— slot-zoeker: overlappende afspraken —');

test('winkeldienst 09-17 slokt losse inmeet-uren op (bug 20 aug)', () => {
  // Joey had 09:00-10:00 inmeten, 09:00-17:00 winkeldienst, 10:00-11:00 inmeten.
  // De oude code zag na het eerste uur "ruimte" terwijl hij de hele dag in de winkel stond.
  const blokken = bezetteBlokken([
    { start: dag('09:00'), eind: dag('10:00'), adres: 'Rijswijk A' },
    { start: dag('09:00'), eind: dag('17:00'), adres: '' },
    { start: dag('10:00'), eind: dag('11:00'), adres: 'Rijswijk B' },
  ], dag('09:00'), dag('15:00'));
  assert.strictEqual(blokken.length, 1, `verwacht 1 samengevoegd blok, kreeg ${blokken.length}`);
  assert.strictEqual(+blokken[0].eind, +dag('17:00'), 'blok moet tot 17:00 lopen');
});

test('afspraak die vóór de werkdag begint maar erin doorloopt telt mee', () => {
  const blokken = bezetteBlokken([
    { start: dag('08:00'), eind: dag('10:30'), adres: 'X' },
  ], dag('09:00'), dag('15:00'));
  assert.strictEqual(blokken.length, 1, 'vroege afspraak moet meetellen');
});

test('niet-overlappende afspraken blijven losse blokken', () => {
  const blokken = bezetteBlokken([
    { start: dag('09:00'), eind: dag('10:00'), adres: 'A' },
    { start: dag('11:00'), eind: dag('12:00'), adres: 'B' },
  ], dag('09:00'), dag('15:00'));
  assert.strictEqual(blokken.length, 2);
});

test('afspraak buiten de werkdag telt niet mee', () => {
  const blokken = bezetteBlokken([
    { start: dag('16:00'), eind: dag('17:00'), adres: 'X' },
  ], dag('09:00'), dag('15:00'));
  assert.strictEqual(blokken.length, 0);
});

console.log('— roosters —');

test('rooster Joey: woensdag en vrijdag vrij, 09:00-15:00 (Daimy 04-08)', () => {
  const r = require('../data/inmeters-rooster.json').inmeters;
  assert.strictEqual(r.Joey.dagen.wo, null, 'Joey is woensdag vrij');
  assert.strictEqual(r.Joey.dagen.vr, null, 'Joey is (tijdelijk) vrijdag vrij');
  assert.strictEqual(r.Joey.dagen.ma.van, '09:00');
  assert.strictEqual(r.Joey.dagen.ma.tot, '15:00');
  assert.strictEqual(r.Sjoerd.dagen.wo.van, '09:00', 'Sjoerd werkt wo wel');
  assert.strictEqual(r.Sjoerd.dagen.vr, null, 'Sjoerd werkt ma-do');
});

console.log('— duurmodel —');

test('maat weegt mee: serre van 8m is geen screen van 1,5m (bug testlead)', () => {
  assert.strictEqual(maatToeslag(1500), 0);
  assert.ok(maatToeslag(4500) > 0, '4,5m moet toeslag krijgen');
  assert.ok(maatToeslag(8000) > maatToeslag(4500), '8m > 4,5m');
});

test('duurschatting testlead Daimy: 3 grote producten ≈ 55 min, niet 20', () => {
  const duur = schatDuur([
    { type: 'zip design 110', aantal: 1, breedte: 1500 },
    { type: 'suneye xl', aantal: 1, breedte: 4500 },
    { type: 'suncontrol 165 zip', aantal: 1, breedte: 8000 },
  ]);
  assert.ok(duur >= 45 && duur <= 70, `verwacht 45-70 min, kreeg ${duur}`);
});

test('1 rolluik blijft ~20 min (basislijn: mediaan 22)', () => {
  const duur = schatDuur([{ type: 'rolluik', aantal: 1 }]);
  assert.ok(duur >= 15 && duur <= 30, `verwacht 15-30, kreeg ${duur}`);
});

console.log('— RP-productparser —');

// Zelfde regex als in cron-inmeten-planner.js — bij wijzigen dáár, ook hier updaten.
const GEEN_PRODUCT = new RegExp([
  'inclusief montage', 'connectivity', 'app bediening', 'afstandsbediening',
  'korting', 'vanaf \\d+ stuks',
  '^(breedte|hoogte|diepte|oppervlakte)\\b',
  '\\btussen\\s+\\d+\\s*mm',
  'montage', 'transport', 'toeslag', 'garantie',
].join('|'), 'i');

test('maatstaffels tellen niet als product (bug Josua Lausberg)', () => {
  assert.ok(GEEN_PRODUCT.test('Breedte tussen 1000 mm - 3000 mm'));
  assert.ok(GEEN_PRODUCT.test('Inclusief montage screen solar'));
  assert.ok(GEEN_PRODUCT.test('Somfy connectivity app bediening'));
});

test('echte producten blijven producten', () => {
  for (const naam of ['Windvast', 'Rolluik', 'Suneye dichte cassette', 'Markiezen', 'Zip Design 110']) {
    assert.ok(!GEEN_PRODUCT.test(naam), `"${naam}" mag niet weggefilterd worden`);
  }
});

console.log('— clusteren (kiesAanbod) —');

const slotje = (dagStr, uur, extra, betrouwbaar) => ({
  datum: dagStr, aankomst: new Date(`${dagStr}T${String(uur).padStart(2,'0')}:00:00`),
  extraRijtijdMin: extra, kostenBetrouwbaar: betrouwbaar,
});

test('rangschikt op minste extra rijtijd, ook bij vuile agenda', () => {
  const gekozen = kiesAanbod([
    slotje('2026-09-01', 9, 40, false),
    slotje('2026-09-02', 9, 8, false),   // naast een buur: goedkoopst
    slotje('2026-09-03', 9, 25, false),
  ], 3);
  assert.strictEqual(gekozen[0].extraRijtijdMin, 8, 'goedkoopste (buur) moet eerst');
});

test('vuile agenda: duur slot wordt NIET weggefilterd (wel achteraan)', () => {
  const gekozen = kiesAanbod([slotje('2026-09-01', 9, 90, false)], 3);
  assert.strictEqual(gekozen.length, 1, 'op vuile kosten mag je geen leads laten liggen');
});

test('schone agenda: boven de grens valt af', () => {
  const gekozen = kiesAanbod([
    slotje('2026-09-01', 9, MAX_EXTRA_RIJTIJD_MIN + 10, true),
    slotje('2026-09-02', 9, 5, true),
  ], 3);
  assert.strictEqual(gekozen.length, 1);
  assert.strictEqual(gekozen[0].extraRijtijdMin, 5);
});

test('spreiding: niet 3x hetzelfde dagdeel op dezelfde dag', () => {
  const gekozen = kiesAanbod([
    slotje('2026-09-01', 9, 5, true),
    slotje('2026-09-01', 10, 6, true),
    slotje('2026-09-02', 9, 7, true),
  ], 2);
  const sleutels = gekozen.map((s) => s.datum + (s.aankomst.getHours() < 12 ? 'o' : 'm'));
  assert.strictEqual(new Set(sleutels).size, sleutels.length, 'zelfde dag+dagdeel dubbel aangeboden');
});

console.log('— ronde tijden —');

test('aankomst rondt naar boven af op hele 5 minuten (Daimy 05-08)', () => {
  assert.strictEqual(rondAf5(new Date('2026-09-15T11:38:00')).getMinutes(), 40);
  assert.strictEqual(rondAf5(new Date('2026-09-15T11:41:00')).getMinutes(), 45);
  assert.strictEqual(rondAf5(new Date('2026-09-15T11:40:00')).getMinutes(), 40, 'al rond blijft rond');
  assert.ok(+rondAf5(new Date('2026-09-15T11:38:00')) >= +new Date('2026-09-15T11:38:00'), 'nooit eerder dan haalbaar');
});

console.log('— advies-poort —');

const ADVIES = /weet (nog )?niet|advies/i;
test('advieswaarden worden herkend, echte keuzes niet', () => {
  assert.ok(ADVIES.test('Weet nog niet / advies'));
  assert.ok(ADVIES.test('Weet niet / advies'));
  assert.ok(!ADVIES.test('Rolluik S-42 (RollSUPER)'));
  assert.ok(!ADVIES.test('Somfy IO (RS100)'));
});

console.log('— Gripp-koppelsleutels —');

const { adresSleutel, straatSleutel } = require('../scripts/planado-gripp-verrijken.js');
test('adresSleutel pakt postcode + huisnummer, ook zonder spatie in de postcode', () => {
  assert.deepStrictEqual(adresSleutel('Frijdastraat 8, 2288 EZ Rijswijk'), { pc: '2288EZ', nr: '8' });
  assert.deepStrictEqual(adresSleutel('Molenbrink 36 2553BC Den Haag'), { pc: '2553BC', nr: '36' });
  assert.strictEqual(adresSleutel('Aalbersestraat 41 Naaldwijk, Nederland'), null, 'zonder postcode geen pc-sleutel');
});
test('straatSleutel vangt adressen zonder postcode (Outlook-locaties, geval Mariska 05-08)', () => {
  assert.deepStrictEqual(straatSleutel('Aalbersestraat 41 Naaldwijk, Nederland'), { straat: 'Aalbersestraat', nr: '41' });
  assert.deepStrictEqual(straatSleutel("'s-Gravenzandseweg 12a Wateringen"), { straat: "'s-Gravenzandseweg", nr: '12' });
  assert.strictEqual(straatSleutel(''), null);
  assert.strictEqual(straatSleutel('12 34'), null, 'alleen cijfers is geen straat');
});

console.log(`\n${ok} geslaagd, ${fout} gefaald`);
process.exit(fout ? 1 : 0);
