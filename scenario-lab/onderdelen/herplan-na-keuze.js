// Onderdeel: HERPLAN-NA-KEUZE — klant kiest een tijd via de keuzelink, maar zijn
// laatste bericht zegt iets anders. Wat doet de keten: boeken, automatisch
// herplannen, of naar een mens?
//
// Aanleiding (Daimy 26-08): "waarom handelt de bot dit soort dingen niet gewoon
// zelf af tot er wel een datum wordt gekozen? heb dit al vaker gevraagd."
// Janos (buitenland tot 3 sep), Rick (wo/do wel), Reinhard (ma niet), Jacqueline
// (28 sep 11:10 niet) belandden allemaal geparkeerd in het dashboard, terwijl hun
// bericht precies vertelde wanneer het wél kon.
//
// Draait de ECHTE beslisfunctie naKeuzeBesluit + magBoeken uit lib/boek-poort.js.
//
// Orakel (beleid):
//  - kale instemming / afsluiter / duimpje      → boeken
//  - vraag (over levertijd, product, factuur)   → boeken, vraag apart beantwoorden
//  - ander moment (met óf zonder voorkeur)      → herplan: nieuwe tijden met de
//    genoemde beperking (dagen/dagdeel/vanaf), nooit de afgewezen tijden opnieuw
//  - ander moment maar al 2x herpland vandaag   → mens (pingpong-rem, Mandy 13-08)
//  - klacht                                     → mens
//  - annuleren                                  → mens (NOOIT boeken)
//  - ander adres in het bericht                 → mens (Connie: verkeerd adres = rit)
//  - tijd die op een postcode lijkt ("1600 is prima") → gewoon boeken (Taico 10-08)
//  - niet te duiden (AI-storing → intent 'vraag' met lege duiding) → boeken mag,
//    want de fallback-duiding is 'vraag' en de vraag-route is veilig (mens leest mee)
const { combinaties } = require('../matrix.js');
const path = require('path');
const { naKeuzeBesluit, laatsteWoordNa } = require(path.join(__dirname, '..', '..', 'scripts', 'lib', 'boek-poort.js'));

const ADRES = 'Buitensingel 103, 2286KZ, Rijswijk';

// Echte gevallen uit de historie + varianten. duiding = wat leesReactie teruggeeft
// (die classificatie test klantreactie.js al; hier testen we de beslislaag erna).
const REACTIE = {
  'instemming-kaal': { tekst: 'Dat past, tot dan!', duiding: { intent: 'akkoord' }, wil: 'boeken' },
  'instemming-emoji': { tekst: '👍', duiding: { intent: 'akkoord' }, wil: 'boeken' },
  'vraag-levertijd': { tekst: 'Is goed. Hoe lang is de levertijd eigenlijk?', duiding: { intent: 'vraag', overigeVraag: 'levertijd' }, wil: 'boeken' },
  'ander-vanaf': { tekst: 'Wij zitten tot woensdag 3 september in het buitenland, kan het daarna?', duiding: { intent: 'ander-moment', vanaf: '2026-09-04' }, wil: 'herplan' }, // Janos 26-08
  'ander-dagen': { tekst: 'Helaas komt donderdag niet uit, woensdag en donderdag erna zijn wel opties', duiding: { intent: 'ander-moment', dagen: [3, 4] }, wil: 'herplan' }, // Rick 10-08
  'ander-kaal': { tekst: 'Die maandag lukt echt niet', duiding: { intent: 'ander-moment' }, wil: 'herplan' }, // Reinhard 25-08
  'ander-dagdeel': { tekst: 'Alleen in de ochtend graag, ik werk s middags', duiding: { intent: 'ander-moment', dagdeel: 'ochtend' }, wil: 'herplan' },
  'ander-tijdstip': { tekst: 'Maandag 28 september om 11:10 kan ik niet', duiding: { intent: 'ander-moment' }, wil: 'herplan' }, // Jacqueline 25-08
  klacht: { tekst: 'Dit duurt allemaal veel te lang, ik ben er klaar mee.', duiding: { intent: 'klacht' }, wil: 'mens' },
  annuleren: { tekst: 'Ik zie toch af van de opdracht.', duiding: { intent: 'annuleren' }, wil: 'mens' },
  'ander-adres': { tekst: 'Dat past. Het adres is trouwens 4811AB Breda', duiding: { intent: 'akkoord' }, wil: 'mens' }, // Connie 10-08
  'tijd-als-postcode': { tekst: 'Dinsdag 8 september 1600 is prima', duiding: { intent: 'akkoord' }, wil: 'boeken' }, // Taico 10-08
  'ai-storing': { tekst: 'Hmm lastig, even denken', duiding: { intent: 'vraag', samenvatting: 'niet automatisch te duiden' }, wil: 'boeken' },
};

const dimensies = [
  { naam: 'reactie', waarden: Object.keys(REACTIE).map((k) => ({ label: k })) },
  { naam: 'herplans', waarden: [{ label: '0-vandaag', n: 0 }, { label: '1-vandaag', n: 1 }, { label: '2-vandaag', n: 2 }] },
  // keten-moment: de duiding kan óók voorkeuren bevatten die er niet toe doen
  // (bv. dagen genoemd in een klacht) — het besluit mag daar nooit op herplannen
  { naam: 'ruis', waarden: [{ label: 'schoon' }, { label: 'dagen-in-duiding', extra: { dagen: [2] } }] },
  // keten-moment 2 (Hensing 26-08): is het klantbericht van NA dit aanbod, of is het
  // een OUD bericht over het vorige voorstel (keuzelink-keuze is geen appje)? Een oud
  // bericht mag NOOIT als laatste woord tellen: dan gewoon boeken.
  { naam: 'moment', waarden: [{ label: 'na-aanbod', voorAanbod: false }, { label: 'voor-aanbod', voorAanbod: true }] },
];

function scenarios() {
  return combinaties(dimensies);
}

function orakel(s) {
  // Een bericht van vóór het aanbod telt niet als laatste woord: gewoon boeken.
  if (s.moment.voorAanbod) return { wil: 'boeken' };
  const r = REACTIE[s.reactie.label];
  // pingpong-rem geldt alleen voor herplan-gevallen
  if (r.wil === 'herplan' && s.herplans.n >= 2) return { wil: 'mens' };
  return { wil: r.wil };
}

function voerUit(s) {
  const r = REACTIE[s.reactie.label];
  // eerst de berichtselectie zoals de verwerker die doet: telt dit bericht überhaupt?
  const verstuurdOp = '2026-08-25T08:38:08.420Z'; // aanbod verstuurd (echte Hensing-tijd)
  const berichtTijd = s.moment.voorAanbod ? '2026-08-25 10:30:59' : '2026-08-25 10:43:00'; // Amsterdamse tijd, zoals Trengo
  const relevant = laatsteWoordNa([{ created_at: berichtTijd, message: r.tekst }], verstuurdOp);
  if (!relevant) {
    // geen bericht ná het aanbod → geen laatste-woord-bezwaar → boeken
    return { uitkomst: 'boeken', melding: false };
  }
  const duiding = { ...r.duiding, ...(s.ruis.extra && r.duiding.intent !== 'ander-moment' ? s.ruis.extra : {}) };
  const besluit = naKeuzeBesluit(duiding, r.tekst, ADRES, { herplansVandaag: s.herplans.n });
  // melding: herplan stuurt 🔁 + klantbericht, mens stuurt ✋ + klantbericht — beide
  // zichtbaar; alleen een verkeerde boeking zou stil zijn.
  return { uitkomst: besluit.actie, melding: besluit.actie !== 'boeken', voorkeur: besluit.voorkeur };
}

function vergelijk(verwacht, echt, s) {
  if (verwacht.wil !== echt.uitkomst) return false;
  // bij herplan moet de voorkeur van de klant ook echt meegaan
  if (echt.uitkomst === 'herplan') {
    const d = REACTIE[s.reactie.label].duiding;
    const v = echt.voorkeur || {};
    if ((d.vanaf || null) !== (v.vanaf || null)) return false;
    if ((d.dagdeel || null) !== (v.dagdeel || null)) return false;
    if (JSON.stringify(d.dagen || []) !== JSON.stringify(v.dagen || [])) return false;
  }
  return true;
}

module.exports = { naam: 'herplan-na-keuze', scenarios, orakel, voerUit, vergelijk };
