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
  // Gat gevonden in het lab (26-08): "annuleren" viel nergens onder en gleed als
  // akkoord door de poort — een klant die na zijn keuze afzegt werd dan geboekt.
  if (intent === 'annuleren') return { mag: false, reden: 'wil annuleren' };

  const m = String(tekst || '').match(POSTCODE);
  if (m && !(GEEN_POSTCODELETTERS.has(m[2].toLowerCase()) && m[2] !== m[2].toUpperCase())) {
    const genoemd = (m[1] + m[2]).toUpperCase();
    const bekend = String(adresNu || '').replace(/\s/g, '').toUpperCase();
    if (bekend && !bekend.includes(genoemd)) return { mag: false, reden: 'noemt een ander adres' };
  }
  return { mag: true, reden: intent === 'vraag' ? 'vraag beantwoorden, afspraak mag staan' : 'akkoord' };
}

/**
 * WAT DOEN WE NA HET LAATSTE WOORD VAN DE KLANT? (Daimy 26-08: "waarom handelt de
 * bot dit niet gewoon zelf af tot er wel een datum wordt gekozen?")
 *
 * Eén pure beslisfunctie zodat het scenario-lab exact test wat er in productie
 * gebeurt. De regels:
 *   - poort zegt "mag boeken"                         → boeken
 *   - klant wil een ander moment                      → HERPLANNEN: oud aanbod
 *     intrekken en automatisch nieuwe tijden sturen met zijn voorkeur (dagen,
 *     dagdeel, "vanaf") en zonder de tijden die hij net afwees — tot maximaal
 *     2 automatische herplanningen per dag, daarna een mens (pingpong-rem,
 *     zelfde grens als de reply-route sinds Mandy 13-08).
 *   - klacht, annuleren, ander adres, of niet te duiden → mens (zoals altijd:
 *     een verkeerde boeking is duurder dan een dag vertraging).
 *
 * @param {object} duiding   uitkomst van leesReactie op het laatste klantbericht
 * @param {string} tekst     dat laatste klantbericht
 * @param {string} adresNu   het adres waarop we zouden boeken
 * @param {{herplansVandaag?: number}} ctx
 * @returns {{actie: 'boeken'|'herplan'|'mens', reden: string, voorkeur?: object}}
 */
function naKeuzeBesluit(duiding, tekst, adresNu, ctx = {}) {
  const poort = magBoeken(duiding, tekst, adresNu);
  if (poort.mag) return { actie: 'boeken', reden: poort.reden };
  if (poort.reden === 'komt terug op de afspraak') {
    if ((ctx.herplansVandaag || 0) >= 2) {
      return { actie: 'mens', reden: 'al 2x automatisch herpland vandaag — pingpong-rem' };
    }
    return {
      actie: 'herplan', reden: 'klant wil een ander moment',
      voorkeur: { dagen: duiding?.dagen || [], dagdeel: duiding?.dagdeel || null, vanaf: duiding?.vanaf || null },
    };
  }
  return { actie: 'mens', reden: poort.reden };
}

module.exports = { magBoeken, naKeuzeBesluit };
