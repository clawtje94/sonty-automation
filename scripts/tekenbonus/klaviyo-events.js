// Klaviyo-koppeling voor de tekenbonus via de NETTE route (besluit Daimy 16-08 avond,
// "het zijn meer flows dan campagnes, anders krijgen we alleen losse data"):
// wij sturen per klant één event "Tekenbonus aangeboden" met alle gegevens erin;
// de Flow in Klaviyo (handmatig gebouwd in de UI, flow-API is bewust verboden terrein,
// zie scripts/email/FLOWS.md) triggert daarop en verstuurt de mail met event-variabelen.
// Template: "Sonty | Tekenbonus (flow, event-data)" (WbPiy5).
// De runner verstuurt NIETS zolang de flow niet live staat: flowStatus() checkt eerst.
const { KLAVIYO_API_KEY } = require('../secrets.js');

const H = { Authorization: 'Klaviyo-API-Key ' + KLAVIYO_API_KEY, accept: 'application/json', 'content-type': 'application/json', revision: '2024-10-15' };
const METRIC = 'Tekenbonus aangeboden';

async function flowStatus() {
  const r = await fetch('https://a.klaviyo.com/api/flows?page[size]=50', { headers: H });
  if (!r.ok) return { live: false, reden: 'flows-API niet bereikbaar (' + r.status + ')' };
  const d = await r.json();
  const flow = (d.data || []).find((f) => /tekenbonus/i.test(f.attributes?.name || ''));
  if (!flow) return { live: false, reden: 'geen flow met "tekenbonus" in de naam gevonden' };
  if (flow.attributes.status !== 'live') return { live: false, reden: `flow "${flow.attributes.name}" staat op ${flow.attributes.status}` };
  return { live: true, naam: flow.attributes.name, id: flow.id };
}

async function stuurEvent(email, properties) {
  const r = await fetch('https://a.klaviyo.com/api/events', {
    method: 'POST', headers: H,
    body: JSON.stringify({ data: { type: 'event', attributes: {
      properties,
      metric: { data: { type: 'metric', attributes: { name: METRIC } } },
      profile: { data: { type: 'profile', attributes: { email } } },
    } } }),
  });
  if (r.status >= 300) throw new Error('event versturen faalde (' + r.status + '): ' + (await r.text()).slice(0, 120));
  return true;
}

module.exports = { flowStatus, stuurEvent, METRIC };
