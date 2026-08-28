// GESPREKS-CLAIMS (Sunny-fase 3, 26-08): één eigenaar per planningsgesprek.
// Als Sunny een planning-intentie afhandelt (ander moment bespreken, tijden zoeken,
// boeken), claimt hij het ticket. De planner-routes (aanbod-replies, laatste-woord-
// check) laten een geclaimd ticket met rust zodat de klant nooit twee botten door
// elkaar hoort. Een claim verloopt vanzelf: blijft Sunny in gebreke, dan pakt de
// normale keten het gewoon weer op.
const fs = require('fs');
const path = require('path');

const PAD = path.join(__dirname, '..', '..', 'data', 'gesprek-claims.json');

function lees() {
  try { return JSON.parse(fs.readFileSync(PAD, 'utf8')); } catch { return {}; }
}

function claim(ticketId, door = 'sunny') {
  if (!ticketId) return;
  const c = lees();
  c[String(ticketId)] = { door, op: new Date().toISOString() };
  // opruimen: claims ouder dan een dag zijn nooit meer relevant
  for (const [k, v] of Object.entries(c)) {
    if (Date.now() - Date.parse(v.op) > 24 * 3600000) delete c[k];
  }
  try { fs.writeFileSync(PAD, JSON.stringify(c, null, 1)); } catch { /* claim is extra vangnet */ }
}

/** Is dit ticket de afgelopen `binnenMin` minuten geclaimd (door iemand anders dan `behalve`)? */
function geclaimd(ticketId, binnenMin = 30, behalve = null) {
  if (!ticketId) return false;
  const v = lees()[String(ticketId)];
  if (!v) return false;
  if (behalve && v.door === behalve) return false;
  return Date.now() - Date.parse(v.op) < binnenMin * 60000;
}

/** De claim zelf (door + op), of null. */
function claimVan(ticketId) {
  if (!ticketId) return null;
  return lees()[String(ticketId)] || null;
}
/** Heeft Sunny in dit gesprek ZELF tijden genoemd (claim 'sunny-tijden', < binnenUur)? Dan is
 *  een kale keuze ("ja", "de 10:40") altijd van Sunny en mag de reply-route NOOIT meer een
 *  keuze op het oude planner-aanbod registreren (Daimy's test 28-08: keuze bleef liggen en zou
 *  na 30 min op de verkeerde dag zijn geboekt). */
function sunnyNoemdeTijden(ticketId, binnenUur = 24) {
  const v = claimVan(ticketId);
  return !!v && v.door === 'sunny-tijden' && Date.now() - Date.parse(v.op) < binnenUur * 3600000;
}
module.exports = { claim, geclaimd, claimVan, sunnyNoemdeTijden };
