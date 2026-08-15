// SHEET-WACHTRIJ (Daimy 15-08: "SHEET NIET BIJGEWERKT: protected cell" bij Barbara
// Weeink en Ganesh). De Aug 2026-tab is precies vol (3046 rijen); een nieuwe rij
// toevoegen raakt de beveiligde kolommen AB-AP en dat mag het service-account niet.
// Tot Daimy de rechten openzet bewaren we de schrijfactie hier, en elke planner-run
// proberen we de rij opnieuw — geen enkel akkoord mag stilletjes uit de
// conversie-administratie vallen.
const fs = require('fs');
const path = require('path');

const PAD = path.join(__dirname, '..', '..', 'data', 'sheet-schrijf-wachtrij.json');
const lees = () => { try { return JSON.parse(fs.readFileSync(PAD, 'utf8')); } catch { return []; } };

function zetInWachtrij(payload) {
  const rij = lees();
  if (rij.some((r) => r.grippNr === payload.grippNr)) return; // niet dubbel
  rij.push({ ...payload, sinds: new Date().toISOString() });
  fs.writeFileSync(PAD, JSON.stringify(rij, null, 1));
}

/** Probeert alles in de wachtrij; geslaagde gaan eruit. Geeft geslaagde entries terug. */
async function verwerkWachtrij() {
  const rij = lees();
  if (!rij.length) return [];
  const { schrijfInplanning } = require('./sheet-inplannen.js');
  const gelukt = [];
  const rest = [];
  for (const r of rij) {
    try {
      const res = await schrijfInplanning(r);
      gelukt.push({ ...r, res });
    } catch { rest.push(r); }
  }
  if (gelukt.length) fs.writeFileSync(PAD, JSON.stringify(rest, null, 1));
  return gelukt;
}

module.exports = { zetInWachtrij, verwerkWachtrij };
