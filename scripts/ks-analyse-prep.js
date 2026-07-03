#!/usr/bin/env node
// Klantenservice-analyse prep: schoont trengo-alle-gesprekken.json op en berekent metrics.
// Output: data/ks-analyse/convs-clean.json (per gesprek: kanaal, berichten zonder quotes, timing)
//         data/ks-analyse/stats.json (aggregaten)
const fs = require('fs');
const path = require('path');

const RAW = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'trengo-alle-gesprekken.json'), 'utf8'));
const OUT_DIR = path.join(__dirname, '..', 'data', 'ks-analyse');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Strip quoted reply-kettingen en boilerplate uit e-mailbodies
function cleanBody(body, channelType) {
  if (!body) return '';
  let t = body
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/<[^>]+>/g, ' ');
  if (channelType === 'EMAIL') {
    // Kap af bij de eerste quote-marker ("Op ma 29 jun 2026 om 17:05 schreef ...")
    const markers = [
      /Op\s+(ma|di|wo|do|vr|za|zo)\w*\s+\d{1,2}\s+\w+\.?\s+\d{4}\s+om\s+\d{1,2}:\d{2}\s+schreef/i,
      /On\s+\w+,?\s+\w+\s+\d{1,2},?\s+\d{4}(\s+at)?\s+\d{1,2}:\d{2}/i,
      /-{3,}\s*Original Message|Van:.{0,80}Verzonden:|From:.{0,80}Sent:/is,
      /Verstuurd vanaf mijn iPhone|Verzonden vanuit Outlook/i,
    ];
    let cut = t.length;
    for (const re of markers) { const m = t.match(re); if (m && m.index < cut) cut = m.index; }
    t = t.substring(0, cut);
  }
  return t.replace(/\s+/g, ' ').trim();
}

function minutesBetween(a, b) {
  const d = (new Date(b.replace(' ', 'T')) - new Date(a.replace(' ', 'T'))) / 60000;
  return isFinite(d) ? Math.round(d) : null;
}

const clean = [];
for (const c of RAW) {
  const msgs = (c.messages || []).map(m => ({
    type: m.type,
    at: m.created_at,
    sender: m.sender || null,
    body: cleanBody(m.body, c.channel_type),
  })).filter(m => m.body);
  if (!msgs.length) continue;

  // Eerste responstijd: eerste INBOUND → eerstvolgende OUTBOUND
  let firstResponseMin = null;
  const firstIn = msgs.find(m => m.type === 'INBOUND');
  if (firstIn) {
    const reply = msgs.find(m => m.type === 'OUTBOUND' && m.at > firstIn.at);
    if (reply) firstResponseMin = minutesBetween(firstIn.at, reply.at);
  }
  // Onbeantwoord: laatste bericht is INBOUND
  const last = msgs[msgs.length - 1];

  clean.push({
    id: c.id,
    channel: c.channel_type,
    channel_name: c.channel_name,
    created: c.created_at,
    status: c.status,
    contact: c.contact_name || c.contact_phone || c.contact_email || null,
    n_in: msgs.filter(m => m.type === 'INBOUND').length,
    n_out: msgs.filter(m => m.type === 'OUTBOUND').length,
    first_response_min: firstResponseMin,
    ends_unanswered: last.type === 'INBOUND',
    agents: [...new Set(msgs.filter(m => m.type === 'OUTBOUND' && m.sender).map(m => m.sender))],
    messages: msgs,
  });
}

// Aggregaten
const withIn = clean.filter(c => c.n_in > 0);
const respTimes = withIn.map(c => c.first_response_min).filter(x => x !== null && x >= 0);
respTimes.sort((a, b) => a - b);
const pct = p => respTimes[Math.floor(respTimes.length * p)] ?? null;
const agentCount = {};
for (const c of clean) for (const a of c.agents) agentCount[a] = (agentCount[a] || 0) + 1;

const stats = {
  generated: new Date().toISOString(),
  totaal_raw: RAW.length,
  totaal_met_inhoud: clean.length,
  met_inbound: withIn.length,
  per_kanaal: Object.fromEntries([...new Set(clean.map(c => c.channel_name))].map(k => [k, clean.filter(c => c.channel_name === k).length])),
  onbeantwoord_eindigend_inbound: withIn.filter(c => c.ends_unanswered).length,
  nooit_beantwoord: withIn.filter(c => c.n_out === 0).length,
  responstijd_min: { mediaan: pct(0.5), p75: pct(0.75), p90: pct(0.9), gem: Math.round(respTimes.reduce((s, x) => s + x, 0) / respTimes.length) },
  responstijd_wa: (() => { const r = withIn.filter(c => c.channel === 'WA_BUSINESS').map(c => c.first_response_min).filter(x => x !== null && x >= 0).sort((a, b) => a - b); return { n: r.length, mediaan: r[Math.floor(r.length / 2)], p90: r[Math.floor(r.length * 0.9)] }; })(),
  responstijd_email: (() => { const r = withIn.filter(c => c.channel === 'EMAIL').map(c => c.first_response_min).filter(x => x !== null && x >= 0).sort((a, b) => a - b); return { n: r.length, mediaan: r[Math.floor(r.length / 2)], p90: r[Math.floor(r.length * 0.9)] }; })(),
  per_agent: agentCount,
};

fs.writeFileSync(path.join(OUT_DIR, 'convs-clean.json'), JSON.stringify(clean));
fs.writeFileSync(path.join(OUT_DIR, 'stats.json'), JSON.stringify(stats, null, 2));
console.log(JSON.stringify(stats, null, 2));
console.log('\nGeschreven: data/ks-analyse/convs-clean.json (' + clean.length + ' gesprekken)');
