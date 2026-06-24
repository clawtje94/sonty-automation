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
// Reuzenpanda — Marijn's KPI zit in de RP-statussen
const RP = 'reuzenpanda_cpat_WMD2KmDRune53bj7.d0_ls8loPpAjb2TrSNOS_Xd_QLdxHq1xwOC9pyyJado';
const RP_BASE = 'https://backend.reuzenpanda.nl';
const RP_PID = '731483fa-ef6b-4aae-afcf-883ec09219dd';
const RP_BID = 'e9d5462b-0f3e-43b5-ba60-d61a1ca4f0d7';
const RP_STATUS = {
  inmeten_inplannen: '2e9819bd-26f0-4082-8f18-32bb48f87f54', // Marijn: offerte ondertekend
  gripp_invullen: 'f895f76f-175e-4ea0-bb7c-6cc2f4e5d846',     // inmeet afspraak gemaakt
  inmeten_wacht: '704fff9f-d99c-4047-a4aa-76776dd8260e',      // in de wacht
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
  const fmt = n => '€ ' + Math.round(n).toLocaleString('nl-NL');

  // Reuzenpanda-statussen (Marijn's KPI: offerte ondertekend = Inmeten inplannen)
  let rp = { onderTotaal: 0, onderPeriode: 0, grippTotaal: 0, grippPeriode: 0, wacht: 0 };
  try {
    const r = await (await fetch(`${RP_BASE}/contact-service/${RP_PID}/backlogs/${RP_BID}/items`, { headers: { Authorization: `Bearer ${RP}` } })).json();
    for (const it of (r.items || [])) {
      const recent = Number(it.timestamp_updated || 0) >= Number(sinceMs);
      if (it.status_id === RP_STATUS.inmeten_inplannen) { rp.onderTotaal++; if (recent) rp.onderPeriode++; }
      else if (it.status_id === RP_STATUS.gripp_invullen) { rp.grippTotaal++; if (recent) rp.grippPeriode++; }
      else if (it.status_id === RP_STATUS.inmeten_wacht) { rp.wacht++; }
    }
  } catch (e) {}

  const msg = [
    `📊 *Sales-monitoring* (${period})`,
    ``,
    `*✍️ Marijn — offertes ondertekend:*`,
    `• Klaar voor inmeten (Inmeten inplannen): ${rp.onderTotaal}  _(+${rp.onderPeriode} ${mode === 'dag' ? 'vandaag' : 'deze week'})_`,
    `• 📐 Inmeet afspraak gemaakt (Gripp invullen): ${rp.grippTotaal}  _(+${rp.grippPeriode})_`,
    `• ⏸️ Inmeten in de wacht: ${rp.wacht}`,
    ``,
    `*Activiteit:*`,
    `🆕 Nieuwe leads: ${nieuweLeads}`,
    `📞 Bel-taken voltooid: ${belTakenVoltooid}`,
    `📋 Open bel-taken (te bellen): ${openBelTaken}`,
    uitkomsten.length ? `📊 Bel-uitkomsten:\n${uitkomsten.join('\n')}` : `📊 Bel-uitkomsten: nog geen`,
    ``,
    `_Marijn's doel: offerte laten ondertekenen → status "Inmeten inplannen". Planning maakt daarna de inmeet-afspraak → "Gripp invullen"._`,
  ].join('\n');

  if (process.argv.includes('--print')) { console.log(msg); return; }
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT, text: msg, parse_mode: 'Markdown' }),
  });
  console.log('rapport verzonden');
})();
