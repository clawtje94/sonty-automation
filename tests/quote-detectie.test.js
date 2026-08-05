#!/usr/bin/env node
/**
 * REGRESSIETEST quote-detectie in e-mail (Daimy 2026-08-04, Winston Wareman #971468716).
 *
 * Wat er misging: Winston mailde alleen "Breedte moet 4500 worden mijn excuses." Zijn iPhone
 * plakte de hele offertemail eronder als quote. In die quote staat ONZE EIGEN FAQ-zin "Binnen hoe
 * snel lossen jullie een storing op?". Het woord "storing" telde mee als klachtsignaal, dus zijn
 * maatwijziging werd behandeld als storingsmelding en bleef bij Mens nodig liggen.
 *
 * De quote-detectie kende alleen Engelse en Outlook-vormen. De Nederlandse iPhone-vorm ontbrak,
 * en die plakt bovendien vaak aan de vorige regel vast: "Verstuurd vanaf mijn iPhoneOp 04.08.2026
 * om 09:03 heeft ...". Zonder spatie dus, waardoor een woordgrens niet werkt.
 *
 * LET OP bij het uitbreiden: de eerste versie van deze test gebruikte een netjes getypte zin met
 * een spatie tussen "iPhone" en "Op". Die slaagde, terwijl de echte mail bleef falen. De tekst
 * hieronder is daarom letterlijk overgenomen uit het echte ticket.
 *
 *   node tests/quote-detectie.test.js
 */
const fs = require('fs');
const path = require('path');
const { SERVICE_SIGNAAL } = require('../scripts/ai-ks/mag-sluiten.js');

const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'ai-ks', 'email-live.js'), 'utf8');
eval(src.slice(src.indexOf('const QUOTE_START'), src.indexOf('}', src.indexOf('function markeerQuote')) + 1));

const nieuwDeelVan = (tekst) =>
  markeerQuote(tekst).split('[EINDE NIEUW BERICHT')[0].replace('[NIEUW BERICHT] ', '');

// Letterlijk uit ticket #971468716, inclusief het ontbrekende spatie na "iPhone".
const WINSTON = 'Beste, Breedte moet 4500 worden mijn excuses.Groet,Winston Wareman Verstuurd vanaf mijn iPhoneOp 04.08.2026 om 09:03 heeft Aanvragen | Sonty <aanvragen@sonty.nl> het volgende geschreven: Beste Winston Wareman , Hartelijk dank voor je aanvraag! We hebben op basis van jouw wensen een prijsvoorstel opgesteld. Binnen hoe snel lossen jullie een storing op? We proberen een storing binnen 5 dagen op te lossen.';

// Letterlijk uit ticket #971369998 (juliaavo@gmail.com): zij vroeg om een inmeetafspraak, maar
// onder haar bericht stond de hele offertemail met ">" ervoor. Deze vorm heeft geen kopregel.
const JULIA = 'Geachte heer/mevrouw,\r\n\r\nVeel dank voor de prijsindicatie. Wij zouden graag een inmeetafspraak willen inplannen. Kunt u ons laten weten welke data en tijden nog beschikbaar zijn?\r\n\r\nMet vriendelijke groet,\r\nJulia\r\n\r\n> Beste Julia,\r\n> Hartelijk dank voor je aanvraag!\r\n> -Binnen hoe snel lossen jullie een storing op?\r\n> We proberen een storing binnen 5 dagen op te lossen.';

const GEVALLEN = [
  // [naam, mailtekst, moet als klacht tellen?]
  ['Julia, quote met > ervoor', JULIA, false],
  ['Winston, iPhone zonder spatie', WINSTON, false],
  ['Apple Mail met spatie', 'Graag aanpassen naar 4500. Op 4 augustus 2026 heeft Sonty het volgende geschreven: Hoe snel lossen jullie een storing op?', false],
  ['Gmail Nederlands', 'Prima, doe maar. Op 4 aug. 2026 om 09:03 schreef Sonty <info@sonty.nl>: Hoe snel lossen jullie een storing op?', false],
  ['Outlook Nederlands', 'Graag ontvangen. Van: Sonty Verzonden: maandag 4 augustus Aan: mij Onderwerp: offerte. Hoe snel lossen jullie een storing op?', false],
  ['Engels, kort antwoord', 'Yes please. On Aug 4, 2026, Sonty wrote: How fast do you fix a storing?', false],
  ['Oorspronkelijk bericht', 'Akkoord. -----Oorspronkelijk bericht----- Van Sonty: hoe snel lossen jullie een storing op?', false],
  // En deze MOETEN wel als klacht blijven tellen, anders blijft een echte melding liggen:
  ['echte storingsmelding', 'Mijn rolluik doet het niet meer, er is een storing. Kunnen jullie langskomen?', true],
  ['echt kapot', 'Het scherm is kapot na de storm, graag reparatie inplannen.', true],
  ['klacht in eigen tekst', 'Ik heb een klacht over de montage. Op 4 augustus 2026 heeft Sonty het volgende geschreven: bedankt voor je aanvraag.', true],
];

let fouten = 0;
console.log('Quote-detectie en klachtherkenning\n');
for (const [naam, tekst, moetKlacht] of GEVALLEN) {
  const nieuw = nieuwDeelVan(tekst);
  const alsKlacht = SERVICE_SIGNAAL.test(nieuw);
  const ok = alsKlacht === moetKlacht;
  if (!ok) fouten++;
  console.log(`  ${ok ? 'ok  ' : 'FOUT'}  ${naam.padEnd(32)} klacht=${alsKlacht}  ->  ${JSON.stringify(nieuw.trim().slice(0, 46))}`);
}

console.log('');
if (fouten) { console.error(`GEFAALD: ${fouten} van de ${GEVALLEN.length}`); process.exit(1); }
console.log(`GESLAAGD: geciteerde threads tellen niet meer mee (${GEVALLEN.filter((g) => !g[2]).length} vormen),`);
console.log('en echte service- en klachtmeldingen blijven wel bij een mens liggen.');
