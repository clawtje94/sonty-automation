#!/usr/bin/env node
// Sales-monitoring rapport (Marijn / team) -> Telegram.
// Meet: nieuwe leads, gebelde leads (voltooide bel-taken), bel-uitkomsten,
// pipeline-trechter, afspraken, offertes, akkoord + omzet.
// Gebruik: node scripts/sales-report.js [dag|week]   (default week)
const TOKEN = require('./secrets').HUBSPOT_TOKEN;
const TG_TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
const CHAT = 1700128390;
const BASE = 'https://api.hubapi.com';
const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const PIPE = '3623322812';
const S = {
  nieuw: '4998659267', belp1: '4999295181', belp2: '4999295182', prijs: '4999295183', wa: '4999295184',
  contact: '4999295185', opmeting_in: '4999295186', opmeting_af: '4999295187', offerte: '4999295188',
  akkoord: '4999295189', aanbet: '5002974448', producten: '4999295191', installatie: '4999295192',
  afgerond: '4999295194', verloren: '4999295195',
};
const mode = process.argv[2] || 'week';
const since = new Date();
if (mode === 'dag') since.setHours(0, 0, 0, 0);
else since.setDate(since.getDate() - 7);
const sinceISO = since.toISOString().slice(0, 10);
const sinceMs = String(since.getTime());

const jpost = async (u, b) => (await fetch(u, { method: 'POST', headers: H, body: JSON.stringify(b) })).json();

// aantal records voor een filterset
async function count(obj, filters) {
  const r = await jpost(`${BASE}/crm/v3/objects/${obj}/search`, { filterGroups: [{ filters }], limit: 1 });
  return r.total || 0;
}
// som van amount over deals in een stage
async function stageValue(stageId) {
  let sum = 0, after;
  do {
    const r = await jpost(`${BASE}/crm/v3/objects/deals/search`, {
      filterGroups: [{ filters: [{ propertyName: 'dealstage', operator: 'EQ', value: stageId }] }],
      properties: ['amount'], limit: 200, ...(after ? { after } : {}),
    });
    (r.results || []).forEach(d => { sum += parseFloat(d.properties.amount || 0) || 0; });
    after = r.paging?.next?.after;
  } while (after);
  return sum;
}

(async () => {
  const period = mode === 'dag' ? 'vandaag' : 'afgelopen 7 dagen';
  // activiteit in periode
  const nieuweLeads = await count('deals', [
    { propertyName: 'pipeline', operator: 'EQ', value: PIPE },
    { propertyName: 'createdate', operator: 'GTE', value: sinceISO },
  ]);
  const belTakenVoltooid = await count('tasks', [
    { propertyName: 'hs_task_type', operator: 'EQ', value: 'CALL' },
    { propertyName: 'hs_task_status', operator: 'EQ', value: 'COMPLETED' },
    { propertyName: 'hs_lastmodifieddate', operator: 'GTE', value: sinceMs },
  ]);
  // echte to-bellen = open bel-taken (niet de historische backlog)
  const openBelTaken = await count('tasks', [
    { propertyName: 'hs_task_type', operator: 'EQ', value: 'CALL' },
    { propertyName: 'hs_task_status', operator: 'NEQ', value: 'COMPLETED' },
  ]);
  // bel-uitkomsten in periode (deal gewijzigd in periode + uitkomst gezet)
  const OUTCOMES = [['verbonden', 'Verbonden'], ['voicemail', 'Voicemail'], ['geen_gehoor', 'Geen gehoor'], ['verkeerd_nummer', 'Verkeerd nummer'], ['terugbelverzoek', 'Terugbelverzoek']];
  const uitkomsten = [];
  for (const [val, label] of OUTCOMES) {
    const n = await count('deals', [
      { propertyName: 'sonty_call_outcome', operator: 'EQ', value: val },
      { propertyName: 'hs_lastmodifieddate', operator: 'GTE', value: sinceMs },
    ]);
    if (n) uitkomsten.push(`   • ${label}: ${n}`);
  }
  // huidige stand verderop in de funnel + omzet
  const afspraken = await count('deals', [{ propertyName: 'dealstage', operator: 'IN', values: [S.opmeting_in, S.opmeting_af] }]);
  const offertes = await count('deals', [{ propertyName: 'dealstage', operator: 'EQ', value: S.offerte }]);
  const akkoord = await count('deals', [{ propertyName: 'dealstage', operator: 'EQ', value: S.akkoord }]);
  const akkoordValue = await stageValue(S.akkoord);
  const afgerond = await count('deals', [{ propertyName: 'dealstage', operator: 'EQ', value: S.afgerond }]);
  const afgerondValue = await stageValue(S.afgerond);
  const fmt = n => '€ ' + Math.round(n).toLocaleString('nl-NL');

  const msg = [
    `📊 *Sales-monitoring* (${period})`,
    ``,
    `*Activiteit:*`,
    `🆕 Nieuwe leads: ${nieuweLeads}`,
    `📞 Bel-taken voltooid: ${belTakenVoltooid}`,
    `📋 Open bel-taken (te bellen): ${openBelTaken}`,
    uitkomsten.length ? `📊 Bel-uitkomsten:\n${uitkomsten.join('\n')}` : `📊 Bel-uitkomsten: nog geen`,
    ``,
    `*Resultaat (huidige stand):*`,
    `🤝 Opmeting ingepland/afgerond: ${afspraken}`,
    `📄 Offerte verstuurd: ${offertes}`,
    `✅ Offerte akkoord: ${akkoord} (${fmt(akkoordValue)})`,
    `🏁 Afgerond: ${afgerond} (${fmt(afgerondValue)})`,
  ].join('\n');

  if (process.argv.includes('--print')) { console.log(msg); return; }
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT, text: msg, parse_mode: 'Markdown' }),
  });
  console.log('rapport verzonden');
})();
