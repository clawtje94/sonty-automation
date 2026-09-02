// Mag de bot dit gesprek (terug)geven aan de collega die het laatste uitgaande bericht stuurde?
// NEE zodra een MENS het gesprek al heeft: een handmatige toewijzing (Daimy zet een ticket op
// Nanny) is heilig en wordt nooit stilletjes overschreven (Daimy 31-08: "ik wijs tickets toe aan
// nanny waarom wijs jij die dan weer terug aan jorren" — derde keer op dit thema, na 09-08 en
// 20-08). De regel bestond om de BOT van mens-gesprekken af te halen; alleen als het gesprek van
// de bot zelf of van niemand is mag hij het aan de collega hangen. Puur, getest in
// scenario-lab/onderdelen/collega-toewijzing.js.
// LET OP veld-semantiek (live gemeten 31-08): in de detail-payload is `assignee.id` de echte
// toegewezen persoon; `user_id` kan verouderd zijn (975250004: user_id=Daimy, assignee=Jorren).
// Geef daarom altijd `t.assignee?.id ?? t.assigned_user_id ?? t.user_id` door als huidigeUserId.
// 02-09 (Daimy: "Jorren is deze hele week op vakantie"): een collega die in data/ai-ks/afwezig.json
// staat krijgt geen gesprekken toegeschoven — anders ligt een klantvraag een week bij iemand die er
// niet is. Wie afwezig is komt uit team-tags.js (één plek), hier alleen als lijst user-ids.
function afwezigeUserIds() {
  try {
    const { afwezigen, beschikbaar } = require('../ai-ks/team-tags.js');
    return Object.keys(afwezigen()).filter((tag) => !beschikbaar(tag)).map((tag) => Number((tag.match(/(\d+)$/) || [])[1] || 0)).filter(Boolean);
  } catch { return []; }
}
function magCollegaToewijzing({ huidigeUserId, laatsteUitUserId, botUserId, teamId, afwezig = afwezigeUserIds() }) {
  const laatste = Number(laatsteUitUserId || 0);
  const huidige = Number(huidigeUserId || 0);
  const bot = Number(botUserId || 0);
  if (!laatste || laatste === bot) return false; // geen collega, of bot zelf
  if (laatste === 736327) return false;          // Daimy nooit automatisch toewijzen (23-07)
  if (Number(teamId || 0) === 431872) return false; // Mens nodig wint, altijd (Daimy 20-08)
  if (huidige && huidige !== bot) return false;  // mens is toegewezen → afblijven (31-08)
  if ((afwezig || []).map(Number).includes(laatste)) return false; // collega is afwezig (vakantie) → niet toeschuiven (02-09)
  return true;
}
module.exports = { magCollegaToewijzing, afwezigeUserIds };
