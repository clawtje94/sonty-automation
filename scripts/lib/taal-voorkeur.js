// TAALREGEL (Daimy 13-08): Engelstalige klanten worden bij SJOERD ingepland, nooit bij
// Joey — Joeys Engels is niet goed genoeg voor een inmeetgesprek.
//
// De vlag wordt gezet zodra we merken dat een klant Engels schrijft (reply-monitor) of
// als iemand hem handmatig registreert. Sleutel = telefoonnummer (laatste 9 cijfers)
// of rpItemId — beide werken.
const fs = require('fs');
const path = require('path');

const BESTAND = path.join(__dirname, '..', '..', 'data', 'taal-voorkeur.json');

const sleutel = (x) => {
  const cijfers = String(x || '').replace(/\D/g, '');
  return cijfers.length >= 9 ? cijfers.slice(-9) : String(x || '').trim();
};

function laad() {
  try { return JSON.parse(fs.readFileSync(BESTAND, 'utf8')); } catch { return {}; }
}

function zetEngels(id, bron = '') {
  if (!id) return;
  const alles = laad();
  const k = sleutel(id);
  if (alles[k]) return; // al bekend
  alles[k] = { taal: 'en', op: new Date().toISOString(), bron };
  fs.writeFileSync(BESTAND, JSON.stringify(alles, null, 1));
}

function isEngels(...ids) {
  const alles = laad();
  return ids.some((id) => id && alles[sleutel(id)]?.taal === 'en');
}

// Herkent een Engelstalig klantbericht. Bewust conservatief: een paar Engelse
// leenwoorden in een Nederlandse zin ("oke prima, nice") mogen NIET tellen —
// pas bij een zin die echt Engels is slaat hij aan.
const EN_WOORDEN = /\b(the|would|could|please|thanks|thank you|appointment|when|schedule|available|morning|afternoon|possible|measure|window|awning|screen is|we are|i am|i would|can you|do you)\b/gi;
const NL_WOORDEN = /\b(de|het|een|ik|wij|jullie|graag|bedankt|afspraak|kan|mag|niet|wel|morgen|middag|meten|scherm|goed|prima)\b/gi;
function lijktEngels(tekst) {
  const t = String(tekst || '');
  if (t.length < 15) return false;
  const en = (t.match(EN_WOORDEN) || []).length;
  const nl = (t.match(NL_WOORDEN) || []).length;
  return en >= 2 && en > nl * 2;
}

module.exports = { zetEngels, isEngels, lijktEngels, laad };
