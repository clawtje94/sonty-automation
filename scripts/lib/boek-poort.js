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
const POSTCODE = /\b(\d{4})\s?([A-Za-z]{2})\b/;

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
  if (m) {
    const genoemd = (m[1] + m[2]).toUpperCase();
    const bekend = String(adresNu || '').replace(/\s/g, '').toUpperCase();
    if (bekend && !bekend.includes(genoemd)) return { mag: false, reden: 'noemt een ander adres' };
  }
  return { mag: true, reden: intent === 'vraag' ? 'vraag beantwoorden, afspraak mag staan' : 'akkoord' };
}

module.exports = { magBoeken };
