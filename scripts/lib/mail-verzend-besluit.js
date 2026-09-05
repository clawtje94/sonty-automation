// NA-VERZENDBESLUIT E-MAIL (Daimy 05-09: "het is belangrijk dat het gewoon goed gaat").
// Casus Arnoud Kortenbout (ticket 977178183, 29-08): Sunny's antwoord strandde bij Trengo
// en het ticket werd TOCH gesloten. 29 keer gebeurd (15-07 t/m 30-08), 27 klanten hoorden
// nooit meer iets. Vanaf nu: mislukte verzending = ticket OPEN, Mens nodig, notitie met het
// klaarstaande concept, Telegram-melding. Puur, zodat het lab het kan afdwingen.
/**
 * @param {{verstuurd:boolean, poort:{mag:boolean, soort?:string, reden?:string}}} p
 * @returns {{sluiten:boolean, mensNodig:boolean, notitie:boolean, telegram:boolean, reden:string}}
 */
function naVerzending({ verstuurd, poort }) {
  if (!verstuurd) {
    return { sluiten: false, mensNodig: true, notitie: true, telegram: true, reden: 'verzending mislukt: klant heeft niets ontvangen' };
  }
  if (poort && !poort.mag) {
    // Servicemelding: alleen open laten (Daimy 06-08), overige: Mens nodig + notitie.
    const service = poort.soort === 'service';
    return { sluiten: false, mensNodig: !service, notitie: !service, telegram: false, reden: poort.reden || 'poort: niet sluiten' };
  }
  return { sluiten: true, mensNodig: false, notitie: false, telegram: false, reden: 'beantwoord' };
}
module.exports = { naVerzending };
