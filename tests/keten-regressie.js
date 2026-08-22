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

test('lege dag mag altijd geopend worden, ook door een verre klant (Daimy 09-08)', () => {
  // Sjoerd had eind september hele lege dagen terwijl klanten wachtten: op een lege
  // dag is er geen rit om op mee te liften, dus telt de hele reis als "extra" en viel
  // iedereen buiten de omrij-grens.
  const opener = { ...slotje('2026-09-28', 9, 52, true), dagOpener: true };
  const duurGeenOpener = { ...slotje('2026-09-29', 9, 52, true), dagOpener: false };
  assert.strictEqual(kiesAanbod([opener], 3, { wachtDagen: 0 }).length, 1, 'dagopener moet blijven staan');
  assert.strictEqual(kiesAanbod([duurGeenOpener], 3, { wachtDagen: 0 }).length, 0, 'dure invoeging op een volle dag blijft wél weggefilterd');
});

console.log('— dashboard-kaart: geen dubbele of botsende tijden (Daimy 09-08) —');
test('ontdubbelen op tijd+inmeter, ook bij verschillende objecten', () => {
  // zorgVoorDrieOpties haalt slots opnieuw op: hetzelfde moment komt terug als een
  // ANDER object en stond daardoor twee keer op de kaart (Marco Klok, Timo Goes).
  const { ontdubbelSlots } = require('../scripts/cron-inmeten-planner.js');
  const maak = (uur, inmeter) => ({ ...slotje('2026-09-22', uur, 10, true), inmeter });
  const lijst = [maak(14, 'Sjoerd'), maak(14, 'Sjoerd'), maak(14, 'Joey'), maak(15, 'Sjoerd')];
  const uniek = ontdubbelSlots(lijst);
  assert.strictEqual(uniek.length, 3, 'zelfde tijd bij dezelfde inmeter is één keuze');
  assert.strictEqual(uniek.filter((s) => s.inmeter === 'Sjoerd' && s.aankomst.getHours() === 14).length, 1);
  // zelfde tijd bij een ANDERE inmeter is wél een echte tweede keuze
  assert.ok(uniek.some((s) => s.inmeter === 'Joey' && s.aankomst.getHours() === 14));
});

test('geen tweede voorstel aan een klant die al een afspraak heeft (Daimy 10-08)', async () => {
  // Eric van der Meer kreeg op 10-08 een nieuw voorstel terwijl hij al op 18 augustus
  // stond, doordat er een verkeerd RP-id werd meegegeven. Dat mag nooit meer kunnen.
  const os = require('os');
  const pad = require('path').join(os.tmpdir(), 'test-boekingen-' + Date.now() + '.json');
  require('fs').writeFileSync(pad, JSON.stringify({
    'rp-1': { naam: 'Test', status: 'geboekt', aankomst: new Date(Date.now() + 7 * 86400000).toISOString(), inmeter: 'Joey' },
  }));
  const oud = process.env.INMEET_BOEKINGEN_PAD;
  process.env.INMEET_BOEKINGEN_PAD = pad;
  delete require.cache[require.resolve('../scripts/lib/inmeet-mutatie.js')];
  const { laadBoekingen } = require('../scripts/lib/inmeet-mutatie.js');
  const b = laadBoekingen()['rp-1'];
  assert.ok(b && b.status === 'geboekt' && Date.parse(b.aankomst) > Date.now(), 'lopende boeking moet vindbaar zijn voor de blokkade');
  process.env.INMEET_BOEKINGEN_PAD = oud;
  delete require.cache[require.resolve('../scripts/lib/inmeet-mutatie.js')];
  require('fs').unlinkSync(pad);
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
  // van Beek 22-08: klant woont zelf in Rijswijk — het oude |rijswijk-filter
  // (bedoeld voor Sonty's eigen blok) gooide elke Rijswijkse klant weg
  const vb = adresUitTekst('Sonty B.V.\nFrijdastraat 8F\n2288 EX Rijswijk\n\nvan Beek\nBrantingstraat 20, 2286 GH, Rijswijk, Nederland\nwildcart@me.com\n');
  assert.strictEqual(vb.volledigAdres, 'Brantingstraat 20, 2286GH, Rijswijk');
});
test('klantAdresregelUitTekst vindt de losse adresregel boven het mailadres (Hoogeveen 22-08)', () => {
  const { klantAdresregelUitTekst } = require('../scripts/lib/offerte-adres.js');
  const pdf = 'Sonty B.V.\nFrijdastraat 8F\n2288 EX Rijswijk\n\nHoogeveen\nCoba ritsemastraat 14 Woerden\nnonhoogeveen@gmail.com\n0640058879\n';
  assert.strictEqual(klantAdresregelUitTekst(pdf), 'Coba ritsemastraat 14 Woerden');
  // geen mailadres of alleen Sonty-blok = niets terug
  assert.strictEqual(klantAdresregelUitTekst('Sonty B.V.\nFrijdastraat 8F\n2288 EX Rijswijk\n'), null);
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
  assert.ok(/dinsdag 18 augustus/i.test(zonder) && zonder.includes('11:05'), 'dag/tijd moeten kloppen');
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
  // ONVREDE: instemmen én klagen is geen kale keuze — er hoort een mens bij
  // (Daimy 09-08, ECHTE bericht van Rita van Schagen; werd toch geboekt + opgewekt bevestigd)
  assert.strictEqual(leesKeuze('Hoi Ja doe dat maar. Maar ik had het wel op prijs gesteld dat je dit eerlijk zoe zeggen. Sorry maar van 3 naar 6 weken vind ik wel veel', een), null, 'instemming met klacht mag NOOIT automatisch boeken');
  assert.strictEqual(leesKeuze('Ja hoor maar dat is wel erg lang', een), null);
  assert.strictEqual(leesKeuze('Ja, maar ik ben er niet blij mee', een), null);
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

// CONNIE BIERMANN (10-08): "Dat past" om 13:32, en vijf minuten later "in Breda kan het
// inmeten alleen op dinsdag, donderdag of vrijdag". Zeven seconden na dat laatste bericht
// ging onze bevestiging eruit. Sindsdien telt het laatste woord van de klant; deze test
// bewaakt dat de duiding die berichten niet als instemming leest.
test('bericht na de keuze mag nooit als akkoord gelden', () => {
  const { leesKeuze } = require('../scripts/cron-aanbod-replies.js');
  const een = [{ aankomst: '2026-09-23T10:10:00.000Z' }];
  assert.strictEqual(leesKeuze('En in Breda kan het inmeten alleen op dinsdag, donderdag of vrijdag..', een), null);
  assert.strictEqual(leesKeuze('Sorry woensdag kan niet helaas', een), null);
  assert.strictEqual(leesKeuze('Hoi Sonty! De datum kan niet, kan alleen op dinsdag, donderdag of vrijdag in Breda', een), null);
  assert.strictEqual(leesKeuze('Jullie hebben wel het goede adres toch... Diderica Mijnssenstraat 22, 4822WH Breda', een), null, 'adresvraag is geen keuze');
  assert.strictEqual(leesKeuze('Wat zijn de kosten van het inmeten dan naast de 2895 van het zonnescherm', een), null, 'vraag is geen keuze');
});

// De verwerker moet de laatste-woord-check dragen, en de monitor moet ook na een boeking
// blijven luisteren. Zonder die twee kon een klant een afspraak intrekken zonder dat er
// iets gebeurde.
test('verwerker checkt het laatste klantbericht, monitor volgt ook geboekte klanten', () => {
  const fs2 = require('fs');
  const planner = fs2.readFileSync(__dirname + '/../scripts/cron-inmeten-planner.js', 'utf8');
  assert.ok(/laatste-woord-check|LAATSTE WOORD VAN DE KLANT/i.test(planner), 'laatste-woord-bewaker ontbreekt in de verwerker');
  assert.ok(/magBoeken\(duiding, tekstK/.test(planner), 'verwerker moet de boek-poort gebruiken');
  const monitor = fs2.readFileSync(__dirname + '/../scripts/cron-aanbod-replies.js', 'utf8');
  assert.ok(/naboeking:/.test(monitor), 'monitor moet berichten na de boeking oppakken');
  assert.ok(/VERS_MS/.test(monitor), 'monitor moet recent verstuurde aanbiedingen blijven volgen');
});

// De poort die bepaalt of een keuze echt geboekt mag worden. Deze regel wordt door de
// verwerker en door het gesprek-lab gebruikt; loopt hij uiteen, dan test het lab iets
// anders dan er gebeurt.
test('boek-poort: vraag mag boeken, andere dag/klacht/ander adres niet', () => {
  const { magBoeken } = require('../scripts/lib/boek-poort.js');
  const adres = 'Arembergstraat 47, 4761 KG Zevenbergen';
  assert.strictEqual(magBoeken({ intent: 'akkoord' }, 'Dat past', adres).mag, true);
  assert.strictEqual(magBoeken({ intent: 'vraag' }, 'Dankjewel! Hoelang duurt het?', adres).mag, true,
    'een vraag na het akkoord mag de afspraak niet ophouden');
  assert.strictEqual(magBoeken({ intent: 'ander-moment' }, 'Sorry woensdag kan niet', adres).mag, false);
  assert.strictEqual(magBoeken({ intent: 'klacht' }, 'Ja doe maar, maar ik ben er niet blij mee', adres).mag, false);
  assert.strictEqual(magBoeken({ intent: 'vraag' }, 'Jullie hebben wel het goede adres toch... Diderica Mijnssenstraat 22, 4822WH Breda', adres).mag,
    false, 'afwijkende postcode = eerst adres controleren');
  assert.strictEqual(magBoeken({ intent: 'vraag' }, 'Klopt, Arembergstraat 47, 4761KG', adres).mag, true,
    'eigen postcode bevestigen mag gewoon door');
});

// Th de Geest (10-08): vroeg op 1 augustus een offerte aan en ging vandaag akkoord. De
// wachttijd-melding rekende vanaf zijn aanvraag en riep "9 dagen vergeten" over een lead
// die er twee uur stond. De klok hoort te lopen vanaf het moment dat wij hem kregen.
test('vergeten-lead rekent vanaf de statusovergang, niet vanaf de offerte-aanvraag', () => {
  const bron = require('fs').readFileSync(__dirname + '/../scripts/cron-keten-zelfcontrole.js', 'utf8');
  const regel = bron.match(/const sinds = state\.gezien[\s\S]{0,260}?;/);
  assert.ok(regel, 'peildatum-regel niet gevonden');
  assert.ok(/timestamp_updated/.test(regel[0]), 'terugval moet de laatste wijziging zijn');
  assert.ok(regel[0].indexOf('timestamp_updated') < regel[0].indexOf('timestamp_created'),
    'de aanmaakdatum mag nooit vóór de statusovergang worden gekozen');
});

// Connie Biermann (10-08): ik gooide alleen de Planado-opdracht weg. De Outlook-afspraak
// bleef staan, de sync maakte daar een nieuwe naamloze opdracht van, en het dashboard
// bleef "geboekt" tonen op een datum die de klant had afgezegd. Annuleren moet alle drie
// de administraties raken, en Outlook eerst — anders zet de sync het terug.
test('annuleren ruimt Outlook, Planado en de administratie op, in die volgorde', () => {
  const bron = require('fs').readFileSync(__dirname + '/../scripts/lib/afspraak-annuleren.js', 'utf8');
  const outlook = bron.indexOf('1. OUTLOOK EERST');
  const planado = bron.indexOf('2. PLANADO');
  const admin = bron.indexOf('3. ONZE ADMINISTRATIE');
  assert.ok(outlook > 0 && planado > outlook && admin > planado,
    'volgorde moet Outlook -> Planado -> administratie zijn, anders zet de sync de opdracht terug');
  assert.ok(/status = 'geannuleerd'/.test(bron), 'het dashboard-record moet op geannuleerd');
  assert.ok(/OPTIE bot/.test(bron), 'optie-blokjes mogen niet als afspraak worden verwijderd');
});

// Taico (10-08): "wij zijn niet beschikbaar t/m 23 augustus" — en hij kreeg drie keer
// 17 augustus terug. Een uitgesloten periode is hard: liever geen voorstel dan een
// voorstel dat de klant al heeft afgewezen.
test('vanaf-datum is hard: geen terugval op eerdere tijden', () => {
  const { pasBijVoorkeur } = require('../scripts/lib/planning-antwoord.js');
  const slots = [
    { aankomst: '2026-08-17T13:40:00.000Z' },
    { aankomst: '2026-08-25T08:00:00.000Z' },
    { aankomst: '2026-09-08T14:00:00.000Z' },
  ];
  const na = pasBijVoorkeur(slots, { vanaf: '2026-08-24' });
  assert.strictEqual(na.length, 2, 'alles vóór 24 aug moet wegvallen');
  assert.ok(na.every((s) => new Date(s.aankomst) >= new Date('2026-08-24T00:00:00+02:00')));
  const leeg = pasBijVoorkeur([slots[0]], { vanaf: '2026-08-24' });
  assert.strictEqual(leeg.length, 0, 'niets na de datum = LEEG, nooit terugvallen op een afgewezen tijd');
});

test('planner draagt vanaf/nietDeze door alle codepaden (ook de aanvuller)', () => {
  const bron = require('fs').readFileSync(__dirname + '/../scripts/cron-inmeten-planner.js', 'utf8');
  assert.ok(/beperking\?\.vanaf/.test(bron), 'maakEnVerstuurAanbod moet de vanaf-grens na het aanvullen afdwingen');
  assert.ok(/m\.nietDeze/.test(bron), 'afgewezen tijden moeten uit het nieuwe aanbod worden gefilterd');
  assert.ok(/ligt vóór de datum die de klant zelf noemde/.test(bron), 'poort op de vanaf-datum ontbreekt');
  const monitor = require('fs').readFileSync(__dirname + '/../scripts/cron-aanbod-replies.js', 'utf8');
  assert.ok(/reeksTekst/.test(monitor), 'monitor moet berichten-reeksen als geheel lezen');
  assert.ok(/nietDeze: gemeld\['afgewezen:/.test(monitor), 'monitor moet ALLE ooit-afgewezen tijden meesturen (cumulatief, Mandy 13-08)');
  assert.ok(/replyrondes:/.test(monitor), 'pingpong-rem: max 2 automatische nieuwe voorstellen per klant per dag');
});

// Taico deel 2 (10-08): "Dinsdag 8 september 1600 is prima" — de poort las "1600 is"
// als postcode 1600IS en blokkeerde zijn eigen akkoord. Een tijd is geen postcode.
test('boek-poort: tijd als vier cijfers is geen postcode', () => {
  const { magBoeken } = require('../scripts/lib/boek-poort.js');
  const adres = 'Breedkapper 1, 2614 SX, Delft';
  assert.strictEqual(magBoeken({ intent: 'akkoord' }, 'Dinsdag 8 september 1600 is prima', adres).mag, true);
  assert.strictEqual(magBoeken({ intent: 'akkoord' }, 'Kom om 0900 en dan is het goed', adres).mag, true);
  assert.strictEqual(magBoeken({ intent: 'akkoord' }, 'Klopt, 2614 SX', adres).mag, true, 'eigen postcode blijft gewoon mogen');
  assert.strictEqual(magBoeken({ intent: 'vraag' }, 'Het adres is 4822WH Breda he', adres).mag, false, 'echte afwijkende postcode blijft blokkeren');
});

// 13-08: kale agenda-afspraken gaven klanten geen bevestigingsmail en geen medewerker-
// koppeling in Bookings (alles onder "geen medewerker" als Bezet). Boeken loopt nu
// via lib/inmeet-boeken.js: echte Bookings-afspraak, kale afspraak alleen als vangnet
// met alarm.
test('planner boekt via Bookings, kale afspraak alleen als gemeld vangnet', () => {
  const fs2 = require('fs');
  const planner = fs2.readFileSync(__dirname + '/../scripts/cron-inmeten-planner.js', 'utf8');
  assert.ok((planner.match(/boekInmeetAfspraak/g) || []).length >= 2, 'beide boek-routes moeten via boekInmeetAfspraak lopen');
  assert.ok(!/outlookEventId = await maakDefinitief/.test(planner), 'directe maakDefinitief-boekingen mogen niet meer bestaan in de planner');
  const lib = fs2.readFileSync(__dirname + '/../scripts/lib/inmeet-boeken.js', 'utf8');
  assert.ok(/staffIds/.test(lib) && /locatie/.test(lib), 'Bookings-boeking moet medewerker en adres meegeven');
  assert.ok(/GEEN automatische bevestiging/.test(lib), 'vangnet moet alarmeren dat de klant geen bevestiging kreeg');
});

// Debby (13-08): de verwerker stuurde na een afgeketste keuze direct nieuwe tijden,
// maar dat pad laadde de vakanties niet — ze werd geboekt op Sjoerds eerste
// vakantiedag. Elk pad dat tijden aanbiedt of boekt moet eerst laadVakanties draaien.
test('verwerker laadt vakanties voordat hij boekt of nieuwe tijden stuurt', () => {
  const bron = require('fs').readFileSync(__dirname + '/../scripts/cron-inmeten-planner.js', 'utf8');
  const fn = bron.slice(bron.indexOf('async function verwerkAanbiedingen'));
  assert.ok(/^[\s\S]{0,600}await laadVakanties\(\)/.test(fn), 'verwerkAanbiedingen moet met laadVakanties beginnen');
});

// 13-08: het avondrapport meldde zes "akkoorden in het gesprek" met namen die niet
// eens in de logs voorkwamen — het taalmodel verzon ze. Akkoord mag alleen nog uit
// harde bronnen komen: RP-handtekeningen en inmeet_afspraak-acties uit de eigen log.
test('avondrapport: akkoord komt nooit uit het taalmodel', () => {
  const bron = require('fs').readFileSync(__dirname + '/../scripts/cron-getekend-rapport.js', 'utf8');
  assert.ok(!/akkoord_details/.test(bron), 'akkoord_details (model-oordeel) mag niet meer bestaan');
  assert.ok(!/akkoord_tickets/.test(bron), 'akkoord_tickets (model-oordeel) mag niet meer bestaan');
  assert.ok(/inmeet_afspraak/.test(bron), 'akkoord moet uit de inmeet-acties in de log komen');
  assert.ok(/AKKOORD KOMT NOOIT MEER UIT EEN TAALMODEL/.test(bron), 'de les moet gedocumenteerd blijven');
  assert.ok(/OVERTUIGD BETEKENT/.test(bron) && /overtuigdEcht/.test(bron), 'overtuigd moet geverifieerd worden tegen harde akkoorden (Levi-les 13-08)');
});

// Charles Gevers (14-08): "Dat is zaak omdraaien" matchte "dat is..." en werd geboekt
// terwijl hij midden in een discussie met Daimy zat. "Dat is" telt alleen met een
// positief vervolg.
test('"dat is" zonder positief vervolg is nooit een keuze', () => {
  const { leesKeuze } = require('../scripts/cron-aanbod-replies.js');
  const een = [{ aankomst: '2026-09-21T10:25:00.000Z' }];
  assert.strictEqual(leesKeuze('Dat is zaak omdraaien. Ik verwacht morgen antwoord op evt. andere planning', een), null);
  assert.strictEqual(leesKeuze('Dat is niet wat ik vroeg', een), null);
  assert.strictEqual(leesKeuze('Dat is goed', een), 0);
  assert.strictEqual(leesKeuze('Dat past', een), 0);
});


// HERHAAL-BERICHTEN (Jan van Wageningen 15-08): drie klantberichten in 8 minuten
// leverden twee keer exact dezelfde "ik zoek het even uit"-tekst op, over twee
// monitor-rondes heen. Elke ontvangstbevestiging moet door de 2-uurs-cooldown.
test('elke bevestigOntvangst-aanroep zit achter de magBevestigen-cooldown', () => {
  const bron = require('fs').readFileSync(__dirname + '/../scripts/cron-aanbod-replies.js', 'utf8');
  const aanroepen = bron.match(/await bevestigOntvangst\(/g) || [];
  const bewaakt = bron.match(/if \(magBevestigen\(gemeld, ticketId\)\) await bevestigOntvangst\(/g) || [];
  assert.ok(aanroepen.length > 0, 'geen bevestigOntvangst-aanroepen gevonden');
  assert.strictEqual(bewaakt.length, aanroepen.length, 'onbewaakte bevestigOntvangst-aanroep gevonden');
  assert.ok(/2 \* 3600000/.test(bron), 'cooldown van 2 uur ontbreekt');
});

// ANNULERING NA BOEKING (Ana Franca 13-08): afzegging kreeg een canned "kom er
// vandaag op terug" en daarna stilte; de afspraak bleef 2 dagen in Planado staan.
test('annulering na boeking: eigen intent, bewakingslijst en geen loze belofte', () => {
  const fsx = require('fs');
  const antwoord = fsx.readFileSync(__dirname + '/../scripts/lib/planning-antwoord.js', 'utf8');
  assert.ok(antwoord.includes("'annuleren'"), 'intent annuleren ontbreekt in leesReactie');
  const monitor = fsx.readFileSync(__dirname + '/../scripts/cron-aanbod-replies.js', 'utf8');
  assert.ok(monitor.includes("duidingB.intent === 'annuleren'"), 'monitor behandelt annuleren niet apart');
  assert.ok(monitor.includes('annuleringen-open.json'), 'annulering komt niet op de bewakingslijst');
  const blok = monitor.slice(monitor.indexOf("duidingB.intent === 'annuleren'"), monitor.indexOf("duidingB.intent !== 'akkoord'"));
  assert.ok(blok.includes('annulering direct door'), 'annulering-antwoord aan de klant ontbreekt');
  assert.ok(!blok.includes('wanneerTerug()'), 'annulering-tekst bevat nog een terugkom-belofte');
  const annBlok = monitor.slice(monitor.indexOf("duidingB.intent === 'annuleren'"), monitor.indexOf("duidingB.intent !== 'akkoord'"));
  assert.ok(annBlok.includes('1821764'), 'annulering gaat niet naar Mens nodig (label ontbreekt)');
  assert.ok(annBlok.includes('tag: true'), 'annulering-notitie tagt het team niet');
  const zelf = fsx.readFileSync(__dirname + '/../scripts/cron-keten-zelfcontrole.js', 'utf8');
  assert.ok(zelf.includes('ANNULERING OPEN'), 'zelfcontrole bewaakt open annuleringen niet');
  assert.ok(zelf.includes('klantStil'), 'annulerings-bevestiging heeft geen stil-lijst-poort');
});


// SHEET-WACHTRIJ (Barbara Weeink + Ganesh 15-08): volle maandtab + beveiligde
// kolommen = append geweigerd, en het 1'tje/datum/inmeter viel stil uit de
// conversie-administratie. Falen moet in de wachtrij, elke run opnieuw proberen.
test('gefaalde sheet-schrijfacties gaan in de wachtrij en worden opnieuw geprobeerd', () => {
  const fsx = require('fs');
  const planner = fsx.readFileSync(__dirname + '/../scripts/cron-inmeten-planner.js', 'utf8');
  assert.ok(planner.includes('zetInWachtrij'), 'planner zet gefaalde schrijfactie niet in de wachtrij');
  assert.ok(planner.includes('verwerkWachtrij'), 'planner probeert de wachtrij niet opnieuw');
  const lib = fsx.readFileSync(__dirname + '/../scripts/lib/sheet-wachtrij.js', 'utf8');
  assert.ok(lib.includes('grippNr === payload.grippNr'), 'wachtrij dedupt niet op Gripp-nummer');
});

console.log(`\n${ok} geslaagd, ${fout} gefaald`);
process.exit(fout ? 1 : 0);
