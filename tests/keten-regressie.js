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

test('vroegste datum wint binnen de omrij-grens (Josua-casus 07-08: 15 okt +9 won van 23 sep +13)', () => {
  const gekozen = kiesAanbod([
    slotje('2026-10-15', 9, 9, true),   // goedkoop naast een ver sync-anker
    slotje('2026-09-23', 11, 13, true), // 3 weken eerder, 4 min duurder
    slotje('2026-10-05', 10, 15, true),
  ], 3);
  assert.strictEqual(gekozen[0].datum, '2026-09-23', 'klant mag niet maanden schuiven om minuten rijtijd');
  // boven de grens blijft de goedkoopste-eerst-volgorde (dag-4-route)
  const duur = kiesAanbod([
    slotje('2026-10-15', 9, 45, true),
    slotje('2026-09-23', 11, 133, true),
  ], 3, { wachtDagen: 999 });
  assert.strictEqual(duur[0].extraRijtijdMin, 45, 'boven de grens beslist rijtijd, niet datum');
});

test('eerder-willen: negeerGrens toont vroegste ongeacht omrijden (geval Rene 07-08)', () => {
  const slots = [
    slotje('2026-09-17', 9, 12, true),  // binnen grens, laat
    slotje('2026-08-31', 9, 45, true),  // boven grens, 2,5 week eerder
  ];
  // standaardroute verstopt 31 aug (boven de grens)
  assert.strictEqual(kiesAanbod(slots, 3, { wachtDagen: 999 })[0].datum, '2026-09-17');
  // eerder-willen-route toont hem gewoon
  assert.strictEqual(kiesAanbod(slots, 3, { negeerGrens: true })[0].datum, '2026-08-31');
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

console.log('— winkel-keuzelijst (Daimy 09-08) —');
test('kiesWinkelOpties: 5 gevarieerde opties met labels vroegste en minste rijtijd', () => {
  const { kiesWinkelOpties } = require('../scripts/lib/slotzoeker');
  const slots = [
    slotje('2026-09-01', 9, 55, true),   // vroegste, maar duur
    slotje('2026-09-01', 13, 60, true),  // zelfde dag, middag
    slotje('2026-09-08', 10, 5, true),   // goedkoopst
    slotje('2026-09-15', 9, 20, true),
    slotje('2026-09-22', 11, 25, true),
    slotje('2026-09-29', 9, 30, true),
  ];
  const opties = kiesWinkelOpties(slots, 5);
  assert.strictEqual(opties.length, 5, 'winkel wil 5 keuzes zien');
  // chronologisch, zodat de winkel de lijst kan voorlezen
  for (let i = 1; i < opties.length; i++) {
    assert.ok(+opties[i].aankomst >= +opties[i - 1].aankomst, 'moet op tijd oplopen');
  }
  const vroegste = opties.find((o) => /vroegste/.test(o.label || ''));
  const goedkoopste = opties.find((o) => /minste rijtijd/.test(o.label || ''));
  assert.strictEqual(vroegste.datum, '2026-09-01', 'vroegste moet gelabeld zijn');
  assert.strictEqual(goedkoopste.extraRijtijdMin, 5, 'goedkoopste moet gelabeld zijn');
  // de dure-maar-snelle plek mag NIET wegvallen (winkel moet haast kunnen bedienen)
  assert.ok(opties.some((o) => o.extraRijtijdMin === 55), 'vroegste blijft zichtbaar ook al is hij duur');
});

test('kiesWinkelOpties: één slot dat zowel vroegste als goedkoopste is krijgt beide labels', () => {
  const { kiesWinkelOpties } = require('../scripts/lib/slotzoeker');
  const opties = kiesWinkelOpties([slotje('2026-09-01', 9, 5, true), slotje('2026-09-08', 9, 40, true)], 5);
  assert.strictEqual(opties[0].label, 'vroegste + minste rijtijd');
  assert.strictEqual(opties.length, 2, 'niet meer opties verzinnen dan er gaten zijn');
});

console.log('— adres uit offerte-PDF (geval Franken/Kenny 07-08) —');
test('adresUitTekst pakt het klant-adres en slaat Sonty zelf over', () => {
  const { adresUitTekst } = require('../scripts/lib/offerte-adres.js');
  const pdfTekst = 'Sonty B.V.\nFrijdastraat 8F\n2288 EX Rijswijk\n\nFranken\nHaarlemmermeer 10, 2151DV, Nieuw-Vennep, Nederland\nfamiliefranken13@gmail.com\n0653638650\n';
  const a = adresUitTekst(pdfTekst);
  assert.strictEqual(a.volledigAdres, 'Haarlemmermeer 10, 2151DV, Nieuw-Vennep');
  assert.strictEqual(a.plaats, 'Nieuw-Vennep');
  assert.strictEqual(adresUitTekst('Sonty B.V.\nFrijdastraat 8F\n2288 EX Rijswijk\n'), null, 'alleen ons eigen adres = geen klant-adres');
  // Kenny 07-08: RP rendert een dubbele komma en een spatie in de postcode
  const k = adresUitTekst('Kenny van Hooijdonk\nTexellaan 22,, 2809 SB, Gouda, Nederland\n');
  assert.strictEqual(k.volledigAdres, 'Texellaan 22, 2809SB, Gouda');
});
test('adres-correctie in de lead blokkeert het vangnet (Franken: Houtrijk vs Haarlemmermeer)', () => {
  const { heeftAdresCorrectie } = require('../scripts/lib/offerte-adres.js');
  assert.ok(heeftAdresCorrectie('LET OP adres corrigeren: bezoek/adres moet zijn Houtrijk 10, NIET Haarlemmermeer 10'));
  assert.ok(!heeftAdresCorrectie('Naam: Kenny van Hooijdonk\nTelefoonnummer: 0648086057'));
  assert.ok(!heeftAdresCorrectie(''));
});

console.log('— annuleringslijst (geval Rene 07-08) —');
test('kandidatenVoor: alleen wie echt eerder geholpen is, langst wachtend eerst', () => {
  const { kandidatenVoor } = require('../scripts/lib/eerder-willen.js');
  // Relatief aan vandaag: vaste datums lieten deze test verlopen zodra de dag
  // voorbij was (gemerkt 09-08) — een test die op de kalender stukgaat verbergt
  // echte fouten.
  const dagen = (n) => new Date(Date.now() + n * 86400000).toISOString();
  const morgen = dagen(1);
  const lijst = {
    rene: { naam: 'Rene', wilEerderDan: dagen(40), sinds: '2026-08-07T10:00:00Z' },
    eerder: { naam: 'Al vroeg', wilEerderDan: dagen(10), sinds: '2026-08-01T10:00:00Z' },
  };
  // plek morgen: beide geholpen (morgen < dag 10 < dag 40), langst wachtend eerst
  const k1 = kandidatenVoor(morgen, lijst);
  assert.deepStrictEqual(k1.map((k) => k.naam), ['Al vroeg', 'Rene']);
  // plek over 20 dagen: alleen Rene (Al vroeg staat al op dag 10, dus eerder)
  const k2 = kandidatenVoor(dagen(20), lijst);
  assert.deepStrictEqual(k2.map((k) => k.naam), ['Rene']);
  // plek in het verleden of ongeldig: niemand
  assert.deepStrictEqual(kandidatenVoor('2020-01-01T09:00:00Z', lijst), []);
  assert.deepStrictEqual(kandidatenVoor('nonsens', lijst), []);
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

console.log('— template-verzending —');
test('template weigert lege tijden (incident 06-08)', async () => {
  const { stuurWhatsApp } = require('../scripts/lib/aanbod-versturen.js');
  const echteFetch = global.fetch;
  let verstuurd = false;
  global.fetch = async () => { verstuurd = true; return { ok: true, json: async () => ({}) }; };
  try {
    const r = await stuurWhatsApp({ lead: { naam: 'Test', telefoon: '0612345678' }, duurMin: 25, slots: [] }, 'x');
    assert.strictEqual(r.ok, false, 'lege slots mogen nooit verstuurd worden');
  } finally { global.fetch = echteFetch; }
});

test('WA-bevestiging bevat nooit "undefined" als de inmeternaam ontbreekt (incident Eric 06-08)', () => {
  const { bevestigingsTekst } = require('../scripts/cron-aanbod-replies.js');
  const zonder = bevestigingsTekst({ aankomst: '2026-08-18T09:05:00.000Z' });
  assert.ok(!/undefined/.test(zonder), `tekst bevat "undefined": ${zonder}`);
  assert.ok(zonder.includes('dinsdag 18 augustus') && zonder.includes('11:05'), 'dag/tijd moeten kloppen');
  const met = bevestigingsTekst({ aankomst: '2026-08-18T09:05:00.000Z', inmeter: 'Joey' });
  assert.ok(met.includes('onze inmeter Joey'), 'met naam moet de naam genoemd worden');
});

console.log('— 1-moment-aanbod —');
test('leesKeuze bij 1 slot: bevestiging = akkoord, twijfel = mens (Daimy 07-08)', () => {
  const { leesKeuze } = require('../scripts/cron-aanbod-replies.js');
  const een = [{ aankomst: '2026-08-25T11:00:00.000Z' }];
  assert.strictEqual(leesKeuze('Dat past', een), 0);
  assert.strictEqual(leesKeuze('ja', een), 0);
  assert.strictEqual(leesKeuze('👍', een), 0);
  assert.strictEqual(leesKeuze('1', een), 0);
  assert.strictEqual(leesKeuze('Ander moment', een), null, '"Ander moment" mag nooit boeken');
  assert.strictEqual(leesKeuze('past niet', een), null);
  assert.strictEqual(leesKeuze('ja maar liever een ander moment', een), null, 'gemengd bericht = mens');
  // acceptatie met extra tekst (audit 07-08, ECHTE bericht van Marjolein: bleef liggen)
  assert.strictEqual(leesKeuze('Hi! Dat is prima! Ik zou de offerte per mail nog krijgen maar heb deze niet meer gehad. Wij hadden toen 2 offertes laten maken. Het gaat om de hor voor de schuifpui en 1 zonnescherm. Groetjes Marjolein', een), 0, 'acceptatie + losse vraag moet gewoon boeken');
  assert.strictEqual(leesKeuze('is goed', een), 0);
  assert.strictEqual(leesKeuze('Ja hoor, tot dan!', een), 0);
  assert.strictEqual(leesKeuze('Dat past prima, kan de monteur aanbellen bij de buren?', een), 0);
  assert.strictEqual(leesKeuze('Prima, maar kan het ook een andere dag?', een), null, 'andere dag = mens');
  assert.strictEqual(leesKeuze('Helaas, dan lukt niet, liever volgende week', een), null);
});
test('1-moment-template wordt NIET verstuurd zolang hij niet bestaat', async () => {
  const { stuurWhatsApp } = require('../scripts/lib/aanbod-versturen.js');
  const echteFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({ data: [] }) });
  try {
    const r = await stuurWhatsApp({ lead: { naam: 'Test', telefoon: '0612345678' }, duurMin: 25, slots: [{ aankomst: '2026-08-25T11:00:00.000Z' }] }, 'x');
    assert.strictEqual(r.ok, false, 'zonder moment-template mag er niets via WA gaan');
    assert.ok(/moment-template/.test(r.reden || ''), `reden moet het template noemen: ${r.reden}`);
  } finally { global.fetch = echteFetch; }
});

console.log(`\n${ok} geslaagd, ${fout} gefaald`);
process.exit(fout ? 1 : 0);
