/**
 * WIE TAGGEN WE BIJ EEN OVERDRACHT (Daimy 2026-08-04).
 *
 * De tags stonden hardcoded als "@jorren745487 @tanya748440" op zes plekken in daemon.js en
 * email-live.js. Daardoor bleef de bot Tanya taggen terwijl ze op vakantie was, ook nadat Daimy
 * had gezegd dat te stoppen: er was gewoon geen plek waar je dat één keer kon regelen.
 *
 * Nu staat het op één plek. Iemand op vakantie zetten is één regel in data/ai-ks/afwezig.json
 * aanpassen, en zodra de einddatum voorbij is doet hij vanzelf weer mee.
 *
 * Vorm van afwezig.json:
 *   { "tanya748440": { "tot": "2026-08-18", "reden": "vakantie" } }
 *   Laat "tot" weg of zet hem op null om iemand afwezig te houden tot je hem er zelf uithaalt.
 *
 * Er blijft ALTIJD iemand over: is iedereen afwezig, dan valt het terug op Daimy. Een overdracht
 * zonder ontvanger is erger dan een overdracht naar de verkeerde persoon.
 */
const fs = require('fs');
const path = require('path');

const BESTAND = path.join(__dirname, '..', '..', 'data', 'ai-ks', 'afwezig.json');

// Wie standaard een overdracht oppakt, op volgorde van voorkeur.
const TEAM = ['jorren745487', 'tanya748440'];
const VANGNET = 'daimy736327';

function afwezigen() {
  try { return JSON.parse(fs.readFileSync(BESTAND, 'utf8')); } catch { return {}; }
}

/** Is deze collega vandaag beschikbaar? */
function beschikbaar(tag) {
  const a = afwezigen()[tag];
  if (!a) return true;
  if (!a.tot) return false;                       // afwezig tot iemand hem er zelf uithaalt
  return new Date(a.tot) < new Date();            // terug zodra de datum voorbij is
}

/**
 * De mention-regel voor een overdrachtsnotitie, bijvoorbeeld "@jorren745487 @tanya748440".
 * Alleen collega's die er zijn.
 */
function teamTags() {
  const erbij = TEAM.filter(beschikbaar);
  if (!erbij.length) return '@' + VANGNET;
  return erbij.map((t) => '@' + t).join(' ');
}

/**
 * Herkent een overdrachtsnotitie, ook een oude waarin nog iemand getagd staat die nu weg is.
 * Zou dit alleen op de huidige tags matchen, dan zou de bot na een vakantiewissel oude
 * overdrachten niet meer herkennen en gesprekken opnieuw oppakken die al bij het team liggen.
 */
// Alleen aan het BEGIN van de notitie, want zo schrijft de bot een overdracht. Zou dit overal
// in de tekst matchen, dan telt ook een bevestiging als "@daimy736327 ✅ Verwerkt..." als
// overdracht, en dan zou de bot gesprekken laten liggen die hij juist moet oppakken.
const OVERDRACHT_HERKENNING = new RegExp(
  '^\\s*@(' + TEAM.join('|') + ')\\b', 'i');

module.exports = { teamTags, beschikbaar, afwezigen, OVERDRACHT_HERKENNING, TEAM, VANGNET };
