// Annuleringslijst (Daimy 07-08 akkoord, geval Rene Blauw: "kan het niet eerder?").
// Klanten die eerder willen dan hun huidige afspraak of aanbod staan hierin; valt er
// een plek vrij (annulering of verzetting) VÓÓR hun huidige moment, dan krijgt de
// winkel direct een melding met wie er kan opschuiven. Er gaat niets automatisch
// naar de klant — de winkel klikt op het dashboard (boek of keuzelink).
const fs = require('fs');
const path = require('path');
const PAD = process.env.EERDER_WILLEN_PAD || path.join(__dirname, '..', '..', 'data', 'eerder-willen.json');

function laad() { try { return JSON.parse(fs.readFileSync(PAD, 'utf8')); } catch { return {}; } }
function bewaar(lijst) { fs.writeFileSync(PAD, JSON.stringify(lijst, null, 1)); }

/** Zet een klant op de lijst. wilEerderDan = ISO van zijn huidige (vroegste) moment. */
function registreer({ rpItemId, naam, telefoon, wilEerderDan }) {
  const lijst = laad();
  lijst[rpItemId] = { naam, telefoon: telefoon || null, wilEerderDan, sinds: lijst[rpItemId]?.sinds || new Date().toISOString() };
  bewaar(lijst);
}

/** Van de lijst af (geboekt, geannuleerd, of niet meer relevant). */
function verwijder(rpItemId) {
  const lijst = laad();
  if (lijst[rpItemId]) { delete lijst[rpItemId]; bewaar(lijst); }
}

/** Pure matcher (los getest): wie op de lijst kan dit vrijgekomen moment gebruiken?
 *  Alleen kandidaten die NU eerder geholpen zouden zijn — het vrijgekomen moment
 *  ligt vóór hun huidige moment en in de toekomst. */
function kandidatenVoor(vrijgekomenIso, lijst = null) {
  const alles = lijst || laad();
  const vrij = Date.parse(vrijgekomenIso);
  if (!Number.isFinite(vrij) || vrij < Date.now()) return [];
  return Object.entries(alles)
    .filter(([, k]) => Date.parse(k.wilEerderDan) > vrij)
    .map(([rpItemId, k]) => ({ rpItemId, ...k }))
    .sort((a, b) => String(a.sinds).localeCompare(String(b.sinds))); // langst wachtend eerst
}

module.exports = { registreer, verwijder, kandidatenVoor, laad };
