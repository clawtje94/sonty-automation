#!/usr/bin/env node
/**
 * REGRESSIETEST Reuzenpanda-zoeken (Daimy 2026-07-27, ticket 968814545 / Markus Naumer).
 *
 * WAT ER MISGING
 * Markus vroeg via WhatsApp om offerte 202610354, die hij vrijdag in de showroom had gekregen.
 * De bot vond die niet, pakte de enige offerte die hij wél zag (20269576 uit een ander dossier) en
 * stuurde die. Twee losse bugs kwamen daar samen:
 *
 *  1. TELEFOONMATCH. findRpOffertes plakte alle cijfers van een dossier aan elkaar en zocht daar
 *     "31622223964" in. Het showroomdossier had het nummer als "0622223964" staan, en daar zit die
 *     reeks niet in. Het dossier werd dus niet gevonden. Nu vergelijken we de laatste 9 cijfers.
 *  2. V4-CHECK. Op 202610354 waren de vier productregels vet (dus door de offertecontrole heen),
 *     maar er stond met de hand een Situo 5 handzender bij die niet vet was. De check eiste dat
 *     álle regels vet waren en blokkeerde daardoor de link van een gewoon goede offerte.
 *
 * Deze test draait tegen de ECHTE RP-data, want juist de opslagnotatie van RP was het probleem —
 * met een verzonnen fixture zou die bug niet terugkomen. Hij leest alleen, hij schrijft niets.
 *
 *   node tests/rp-zoeken.test.js
 */
const { findRpOffertes } = require('../scripts/ai-ks/klant-context.js');

// Markus Naumer heeft twee dossiers: het configurator-dossier (+31622223964, offerte 20269576) en
// het winkeldossier (0622223964, offertes 202610354 en 202610355). Beide moeten gevonden worden.
const TELEFOON = '+31622223964';
const MOET_VINDEN = ['20269576', '202610355', '202610354'];

(async () => {
  const res = await findRpOffertes({ phone: TELEFOON });
  if (res?.fout) { console.error('OVERGESLAGEN: Reuzenpanda niet bereikbaar — ' + res.fout); process.exit(0); }

  const offertes = (res || []).flatMap((d) => d.offertes || []);
  const nummers = offertes.map((o) => String(o.nummer));
  let fouten = 0;

  console.log('Regressietest RP-zoeken (echte data)');
  console.log(`  dossiers gevonden op ${TELEFOON}: ${res.length}`);
  console.log(`  offertes gevonden:                ${nummers.join(', ') || '(geen)'}`);

  for (const nr of MOET_VINDEN) {
    if (!nummers.includes(nr)) {
      fouten++;
      console.log(`  ONTBREEKT: offerte ${nr} wordt niet gevonden op het telefoonnummer.`);
    }
  }

  // 202610354 is door V4 verwerkt (productregels vet) met daarna een handmatig accessoire erbij.
  // Die moet een deelbare link houden, anders staat de bot met lege handen bij een goede offerte.
  const winkel = offertes.find((o) => String(o.nummer) === '202610354');
  if (winkel && !winkel.link) {
    fouten++;
    console.log('  GEBLOKKEERD: 202610354 heeft geen link, terwijl de productregels wél vet zijn.');
    console.log('  De V4-check is dan weer te streng voor een handmatig toegevoegd accessoire.');
  }

  if (fouten) { console.error('\nGEFAALD'); process.exit(1); }
  console.log('\nGESLAAGD: beide dossiers van dezelfde klant worden gevonden, ook met het nummer in');
  console.log('nationale notatie, en de handmatig aangevulde showroomofferte houdt een deelbare link.');
})();
