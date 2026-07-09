#!/usr/bin/env node
/**
 * Hervat de klant-koppeling vanuit data/planado-clients-plan.json (geen Outlook nodig).
 * Slaat jobs over die al een client_uuid hebben; hergebruikt bestaande clients op naam.
 * Backoff bij 429.
 */
const fs = require('fs');
const path = require('path');

const PLANADO_API = 'https://api.planadoapp.com/v2';
const PLANADO_KEY = fs.readFileSync(path.join(__dirname, 'planado-api-key.txt'), 'utf8').trim();
const PLAN = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'planado-clients-plan.json'), 'utf8'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function planado(pathname, opts = {}) {
  for (let poging = 0; ; poging++) {
    const res = await fetch(`${PLANADO_API}${pathname}`, {
      ...opts,
      headers: {
        'Authorization': `Bearer ${PLANADO_KEY}`,
        'Content-Type': 'application/json',
        'X-Planado-Notify-Assignees': 'false',
        ...(opts.headers || {}),
      },
    });
    const text = await res.text();
    if (res.status === 429 && poging < 6) {
      console.log(`  (429, wacht ${15 * (poging + 1)}s)`);
      await sleep(15000 * (poging + 1));
      continue;
    }
    let json = null;
    try { json = JSON.parse(text); } catch (e) {}
    return { ok: res.ok, status: res.status, text, json };
  }
}

async function main() {
  console.log('=== Klant-koppeling hervatten ===');
  const clients = [];
  let cursor = null;
  while (true) {
    const res = await planado(`/clients?limit=100${cursor ? `&after=${cursor}` : ''}`);
    const batch = res.json?.clients || [];
    if (batch.length === 0) break;
    clients.push(...batch);
    cursor = batch[batch.length - 1].uuid;
    await sleep(300);
  }
  const clientByKey = {};
  for (const c of clients) clientByKey[(c.name || '').toLowerCase().trim()] = c.uuid;
  console.log(`Bestaande clients: ${clients.length}`);

  // jobs-lijst 1x ophalen voor versies + huidige client-koppeling
  const jobIndex = {};
  let jobCursor = null;
  while (true) {
    const res = await planado(`/jobs?limit=100${jobCursor ? `&after=${jobCursor}` : ''}`);
    const batch = res.json?.jobs || [];
    if (batch.length === 0) break;
    for (const j of batch) jobIndex[j.uuid] = { version: j.version, client_uuid: j.client_uuid };
    jobCursor = batch[batch.length - 1].uuid;
    await sleep(300);
  }

  let clientsNieuw = 0, gekoppeld = 0, alGoed = 0, fouten = 0;
  for (const p of PLAN.filter((x) => x.klant)) {
    const job = jobIndex[p.job];
    if (!job) { fouten++; console.log(`  ✗ job ${p.job} niet in lijst`); continue; }

    const key = p.klant.toLowerCase().trim();
    let clientUuid = clientByKey[key];
    if (!clientUuid) {
      const woorden = p.klant.split(' ');
      const contacts = [
        ...p.phones.map((t) => ({ type: 'phone', name: p.klant, value: t })),
        ...p.emails.map((e) => ({ type: 'email', name: p.klant, value: e })),
      ];
      const body = {
        name: p.klant,
        organization: false,
        first_name: woorden[0],
        last_name: woorden.slice(1).join(' ') || null,
        contacts,
      };
      if (p.adres) body.site_address = { formatted: p.adres };
      const res = await planado('/clients', { method: 'POST', body: JSON.stringify(body) });
      await sleep(1000);
      if (res.ok && res.json?.client_uuid) {
        clientUuid = res.json.client_uuid;
        clientByKey[key] = clientUuid;
        clientsNieuw++;
      } else {
        fouten++;
        console.log(`  ✗ client ${p.klant}: ${res.status} ${res.text.substring(0, 100)}`);
        continue;
      }
    }
    if (job.client_uuid === clientUuid) { alGoed++; continue; }
    // LET OP: veld 'client_uuid' wordt door PATCH stil genegeerd; alleen client:{uuid} werkt
    const res = await planado(`/jobs/${p.job}`, { method: 'PATCH', body: JSON.stringify({ version: job.version, client: { uuid: clientUuid } }) });
    await sleep(1000);
    if (res.ok) gekoppeld++;
    else { fouten++; console.log(`  ✗ koppel ${p.klant}: ${res.status} ${res.text.substring(0, 100)}`); }
    if ((gekoppeld % 25) === 0 && gekoppeld > 0) console.log(`  ... ${gekoppeld} extra gekoppeld`);
  }
  console.log(`\nKlaar: ${alGoed} al goed, ${clientsNieuw} clients nieuw, ${gekoppeld} extra gekoppeld, ${fouten} fouten.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
