#!/usr/bin/env node
// Haalt WhatsApp-gesprekken met activiteit sinds --since op uit Trengo en filtert
// Daimy's echte handmatige antwoorden (templates/standaardberichten eruit).
// Ticket-selectie op updated_at (niet created_at): Daimy's recente reacties zitten vaak in oudere tickets.
// Output: data/ks-analyse/wa-recent.json + data/ks-analyse/daimy-antwoorden.json
const fs = require('fs');
const path = require('path');

const TT = fs.readFileSync(path.join(__dirname, '..', '.trengo-api-token.txt'), 'utf8').trim();
const TH = { Authorization: 'Bearer ' + TT };
const WA_CHANNEL = 1359857;
const SINCE = process.argv[2] || '2026-06-16';
const OUT_DIR = path.join(__dirname, '..', '..', 'data', 'ks-analyse');

async function tGet(ep) {
  for (let i = 0; i < 4; i++) {
    const res = await fetch('https://app.trengo.com/api/v2' + ep, { headers: TH });
    if (res.status === 429) { await new Promise(r => setTimeout(r, 20000)); continue; }
    if (!res.ok) return null;
    return res.json();
  }
  return null;
}

function cleanBody(b) {
  return (b || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
}

(async () => {
  // 1. Alle tickets doorlopen tot een hele pagina qua updated_at vóór SINCE valt
  const waTickets = [];
  let page = 1;
  while (page <= 200) {
    const data = await tGet(`/tickets?page=${page}`);
    const rows = data?.data || [];
    if (!rows.length) break;
    const recent = rows.filter(t => (t.updated_at || t.created_at || '').substring(0, 10) >= SINCE);
    for (const t of recent) {
      if (t.channel?.id === WA_CHANNEL || t.channel?.type === 'WA_BUSINESS') waTickets.push(t);
    }
    process.stdout.write(`\rpagina ${page}: ${waTickets.length} WA-tickets met activiteit sinds ${SINCE}`);
    if (recent.length === 0) break; // hele pagina te oud → klaar
    if (!data.links?.next) break;
    page++;
    await new Promise(r => setTimeout(r, 400));
  }
  console.log('');

  // 2. Berichten per ticket
  const convs = [];
  for (const t of waTickets) {
    const msgs = await tGet(`/tickets/${t.id}/messages`);
    const rows = (msgs?.data || []).map(m => ({
      type: m.type,
      body: cleanBody(m.body || m.message),
      at: m.created_at,
      sender: m.agent?.name || m.user?.name || m.agent?.full_name || m.user?.full_name || null,
    })).filter(m => m.body);
    if (rows.length) convs.push({
      id: t.id, created: t.created_at, updated: t.updated_at, status: t.status,
      contact: t.contact?.full_name || t.contact?.phone || null,
      messages: rows,
    });
    process.stdout.write(`\rberichten: ${convs.length}/${waTickets.length}`);
    await new Promise(r => setTimeout(r, 250));
  }
  console.log('');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'wa-recent.json'), JSON.stringify(convs, null, 1));

  // 3. Template-detectie: (bijna) identieke outbound-teksten die 3+ keer voorkomen
  const outCount = new Map();
  for (const c of convs) for (const m of c.messages) {
    if (m.type === 'OUTBOUND') {
      const key = m.body.substring(0, 120);
      outCount.set(key, (outCount.get(key) || 0) + 1);
    }
  }
  const templates = new Set([...outCount.entries()].filter(([, n]) => n >= 3).map(([k]) => k));

  // 4. Gesprekken met echte (niet-template) Daimy-antwoorden sinds SINCE
  const isDaimyEcht = m => m.type === 'OUTBOUND' && (m.sender || '').toLowerCase().includes('daimy')
    && (m.at || '').substring(0, 10) >= SINCE && !templates.has(m.body.substring(0, 120)) && m.body.length > 20;
  const daimyConvs = convs.filter(c => c.messages.some(isDaimyEcht));
  fs.writeFileSync(path.join(OUT_DIR, 'daimy-antwoorden.json'), JSON.stringify(daimyConvs, null, 1));

  const nEcht = daimyConvs.reduce((s, c) => s + c.messages.filter(isDaimyEcht).length, 0);
  console.log(`Klaar: ${convs.length} WA-gesprekken met activiteit sinds ${SINCE} → wa-recent.json`);
  console.log(`Templates gedetecteerd: ${templates.size}`);
  console.log(`Gesprekken met echte Daimy-antwoorden: ${daimyConvs.length} (${nEcht} berichten) → daimy-antwoorden.json`);
})();
