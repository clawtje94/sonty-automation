// DE POORT VOOR HET BOEKEN (Daimy 10-08).
//
// Eén plek die bepaalt of een keuze van de klant echt geboekt mag worden. Stond deze
// regel alleen in de verwerker, dan test het gesprek-lab iets anders dan er in
// werkelijkheid gebeurt — en dan is een groen lab niets waard.
//
// De regel, geleerd van echte gesprekken:
//   - klant komt terug op de afspraak (ander-moment) → NIET boeken. Connie schreef
//     "Dat past" en vijf minuten later dat woensdag niet kon; wij bevestigden woensdag.
//   - klant is ontevreden (klacht) → NIET boeken. Rita kreeg een boeking op een klacht.
//   - klant noemt een postcode die niet bij ons adres hoort → NIET boeken. Connie woont
//     in Breda, bij ons stond Zevenbergen; een verkeerd adres kost een hele rit.
//   - klant stelt een VRAAG → gewoon boeken, en de vraag beantwoorden. Van de dertien
//     gevallen in de historie waren er acht van dit type ("dat past, dankjewel, we hebben
//     een pasgeboren baby"). Die blokkeren zou de afspraak onnodig uitstellen.
const POSTCODE = /\b([1-9]\d{3})\s?([A-Za-z]{2})\b/;
// "Dinsdag 8 september 1600 is prima" (Taico 10-08): vier cijfers gevolgd door een kort
// woord is meestal een TIJD, geen postcode. Een lettergreep die gewoon een Nederlands
// woordje is telt daarom niet als postcode-letters, tenzij hij in hoofdletters staat
// (zoals iemand een postcode schrijft: 4822WH of 4822 WH).
const GEEN_POSTCODELETTERS = new Set(['is', 'in', 'ik', 'je', 'we', 'de', 'en', 'of', 'om', 'op', 'te', 'na', 'er', 'ze', 'al', 'nu', 'zo', 'ok', 'he', 'ja', 'me', 'mij', 'us', 'un', 'uur']);

/**
 * @param {{intent: string}} duiding  uitkomst van leesReactie op het LAATSTE klantbericht
 * @param {string} tekst              dat laatste klantbericht
 * @param {string} adresNu            het adres waarop we zouden boeken
 * @returns {{mag: boolean, reden: string}}
 */
function magBoeken(duiding, tekst, adresNu) {
  const intent = duiding?.intent || 'vraag';
  if (intent === 'ander-moment') return { mag: false, reden: 'komt terug op de afspraak' };
  if (intent === 'klacht') return { mag: false, reden: 'is niet tevreden' };

  const m = String(tekst || '').match(POSTCODE);
  if (m && !(GEEN_POSTCODELETTERS.has(m[2].toLowerCase()) && m[2] !== m[2].toUpperCase())) {
    const genoemd = (m[1] + m[2]).toUpperCase();
    const bekend = String(adresNu || '').replace(/\s/g, '').toUpperCase();
    if (bekend && !bekend.includes(genoemd)) return { mag: false, reden: 'noemt een ander adres' };
  }
  return { mag: true, reden: intent === 'vraag' ? 'vraag beantwoorden, afspraak mag staan' : 'akkoord' };
}

module.exports = { magBoeken };
