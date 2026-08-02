// ÉÉN POORT VOOR HET SLUITEN VAN KLANTTICKETS (Daimy 2026-08-02).
//
// Aanleiding: drie klanten met een kapot product lagen stil doordat de bot hun ticket sloot.
// Mevr. Langenberg (hordeur uit de rails), Victor-Hugo Scholten (rolluik gaat niet omlaag) en
// De Bie (screens) kregen alledrie een mail dat een collega contact zou opnemen — en daarna
// ging het ticket dicht zonder eigenaar. Gesloten tickets vallen ook buiten de
// onbeantwoord-wachtlijst, dus niemand zag het.
//
// Het ontwerp was omgekeerd: sluiten was de standaard en escaleren de uitzondering, en of het
// goed ging hing af van welke route de bot toevallig koos. Hier draaien we dat om: een
// klantticket gaat ALLEEN dicht als aantoonbaar niets openstaat. Bij twijfel naar Mens nodig.
//
// Systeemmail (Bookings-notificaties, eigen adressen, ads-rapporten) valt hier buiten: die
// hebben geen klant die wacht en mogen gewoon dicht — geef daarvoor systeemMail: true mee.

/** Meldingen die per definitie mensenwerk zijn: hier hangt een klant met een probleem aan. */
const SERVICE_SIGNAAL = /reparat|kapot|defect|storing|garantie|doet het (niet|nog steeds niet)|werkt niet|uit de rails|gaat niet (meer )?(open|dicht|omhoog|omlaag|naar beneden)|vastgelopen|scheur|lekk?|klacht|beschadig|niet meer omhoog|zit vast/i;

/** Beloftes waarna er per definitie nog iemand iets moet doen. */
const BELOFTE = /(neem|nemen|neemt).{0,40}contact|contact.{0,25}(op|met je|met u)|bel(t|len|len we)? (je|u)\b|doorgezet naar|doorgegeven aan|collega.{0,30}(neemt|belt|pakt|stuurt)|leg dit even bij|plant?.{0,20}(het |de )?(afspraak|herstel|inmeten) in|komt (er )?(zo )?(snel )?(mogelijk )?(op )?terug/i;

/**
 * Mag dit ticket dicht?
 * @returns {{mag: true} | {mag: false, reden: string}}
 */
function magSluiten({ klantTekst = '', antwoord = '', acties = [], systeemMail = false } = {}) {
  if (systeemMail) return { mag: true };
  if (SERVICE_SIGNAAL.test(String(klantTekst))) {
    return { mag: false, reden: 'service-, reparatie- of klachtmelding: die hoort altijd bij een mens te liggen' };
  }
  if (BELOFTE.test(String(antwoord))) {
    return { mag: false, reden: 'in het antwoord is de klant beloofd dat iemand contact opneemt' };
  }
  if ((acties || []).some((a) => a?.type === 'escalatie')) {
    return { mag: false, reden: 'er is geëscaleerd naar een mens' };
  }
  return { mag: true };
}

module.exports = { magSluiten, SERVICE_SIGNAAL, BELOFTE };
