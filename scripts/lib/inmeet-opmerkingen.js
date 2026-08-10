// OPMERKINGEN BIJ DE INMEETAFSPRAAK (Daimy 10-08: "zet die gegevens van R. Baremans in
// de inmeetplanning zodat we dat weten").
//
// Klanten geven onderweg dingen door die de inmeter ter plekke nodig heeft: een andere
// contactpersoon met eigen telefoonnummer, een sleuteladres, "bel even want de bel doet
// het niet". Die stonden alleen in het WhatsApp-gesprek, en daar kijkt niemand meer als
// de inmeter voor de deur staat.
//
// Hier bewaren we ze per RP-lead, zodat verwerkLead ze in de omschrijving van de
// Planado-opdracht zet. Werkt ook als de opmerking binnenkomt vóórdat er een afspraak is.
const fs = require('fs');
const path = require('path');

const BESTAND = path.join(__dirname, '..', '..', 'data', 'inmeet-opmerkingen.json');

function laad() {
  try { return JSON.parse(fs.readFileSync(BESTAND, 'utf8')); } catch { return {}; }
}

/** Opmerking toevoegen. Dezelfde tekst twee keer levert één regel op. */
function voegToe(rpItemId, tekst) {
  if (!rpItemId || !String(tekst || '').trim()) return;
  const alles = laad();
  const lijst = alles[rpItemId] || [];
  const schoon = String(tekst).trim();
  if (!lijst.some((r) => r.tekst === schoon)) lijst.push({ tekst: schoon, op: new Date().toISOString() });
  alles[rpItemId] = lijst;
  fs.writeFileSync(BESTAND, JSON.stringify(alles, null, 1));
}

/** De regels als blok voor in de opdracht-omschrijving, of '' als er niets is. */
function alsTekst(rpItemId) {
  const lijst = laad()[rpItemId] || [];
  if (!lijst.length) return '';
  return '\nLET OP (doorgegeven door de klant):\n' + lijst.map((r) => '- ' + r.tekst).join('\n');
}

module.exports = { voegToe, alsTekst, laad };
