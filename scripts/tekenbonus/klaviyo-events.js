// Klaviyo-koppeling voor de tekenbonus via de NETTE route (besluit Daimy 16-08 avond,
// "het zijn meer flows dan campagnes, anders krijgen we alleen losse data"):
// wij sturen per klant één event "Tekenbonus aangeboden" met alle gegevens erin;
// de Flow in Klaviyo (handmatig gebouwd in de UI, flow-API is bewust verboden terrein,
// zie scripts/email/FLOWS.md) triggert daarop en verstuurt de mail met event-variabelen.
// Template: "Sonty | Tekenbonus (flow, event-data)" (WbPiy5).
// De runner verstuurt NIETS zolang de flow niet live staat: flowStatus() checkt eerst.
const { KLAVIYO_API_KEY } = require('../secrets.js');

const H = { Authorization: 'Klaviyo-API-Key ' + KLAVIYO_API_KEY, accept: 'application/json', 'content-type': 'application/json', revision: '2024-10-15' };
// Per testgroep een eigen metric en eigen flow (Daimy 16-08: "ik zie geen A/B, maar
// 1 mail" — met twee flows naast elkaar zie je in Klaviyo per groep alle cijfers).
const METRICS = { 'bonus-2d': 'Tekenbonus aangeboden (2 dagen)', 'bonus-4d': 'Tekenbonus aangeboden (4 dagen)' };
const FLOW_NAMEN = { 'bonus-2d': 'Tekenbonus 2 dagen', 'bonus-4d': 'Tekenbonus 4 dagen' };

async function flowStatus() {
  const r = await fetch('https://a.klaviyo.com/api/flows?page[size]=50', { headers: H });
  if (!r.ok) return { live: false, reden: 'flows-API niet bereikbaar (' + r.status + ')' };
  const d = await r.json();
  for (const naam of Object.values(FLOW_NAMEN)) {
    const flow = (d.data || []).find((f) => f.attributes?.name === naam);
    if (!flow) return { live: false, reden: `flow "${naam}" niet gevonden` };
    if (flow.attributes.status !== 'live') return { live: false, reden: `flow "${naam}" staat op ${flow.attributes.status}` };
  }
  return { live: true, naam: Object.values(FLOW_NAMEN).join(' + ') };
}

async function stuurEvent(email, properties, arm) {
  const naam = METRICS[arm];
  if (!naam) throw new Error('onbekende arm ' + arm);
  const r = await fetch('https://a.klaviyo.com/api/events', {
    method: 'POST', headers: H,
    body: JSON.stringify({ data: { type: 'event', attributes: {
      properties,
      metric: { data: { type: 'metric', attributes: { name: naam } } },
      profile: { data: { type: 'profile', attributes: { email } } },
    } } }),
  });
  if (r.status >= 300) throw new Error('event versturen faalde (' + r.status + '): ' + (await r.text()).slice(0, 120));
  return true;
}

module.exports = { flowStatus, stuurEvent, METRICS, FLOW_NAMEN };
