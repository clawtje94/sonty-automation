#!/usr/bin/env node
/**
 * Verrijkt de gesyncde Planado-jobs met echte klant-records:
 * - haalt Outlook-events opnieuw op MET body (voor telefoonnummer/e-mail)
 * - klantnaam uit onderwerp ("Montage Sonty - <naam>"), adres uit event-locatie
 * - maakt Planado-clients aan (POST /clients) en koppelt ze aan de jobs (PATCH client_uuid)
 * - dedupe op genormaliseerde klantnaam
 *
 * DRY RUN standaard; --execute om echt te schrijven.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const EXECUTE = process.argv.includes('--execute');
const PLANADO_API = 'https://api.planadoapp.com/v2';
const PLANADO_KEY = fs.readFileSync(path.join(__dirname, 'planado-api-key.txt'), 'utf8').trim();
const DAYS_AHEAD = 56;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getOutlookToken() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  let token = null;
  page.on('request', (req) => {
    const auth = req.headers()['authorization'];
    if (auth?.startsWith('Bearer ') && req.url().includes('outlook.office.com')) {
      const t = auth.replace('Bearer ', '');
      try {
        const payload = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        if (Buffer.from(payload, 'base64').toString().includes('Calendar')) token = t;
      } catch (e) {}
    }
  });
  await page.goto('https://outlook.office.com/calendar');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  const emailInput = await page.$('input[type="email"], input[name="loginfmt"]');
  if (emailInput) {
    await emailInput.fill('joey@sontymontage.nl');
    await page.locator('input[type="submit"]').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    const pwInput = await page.$('input[type="password"]');
    if (pwInput) {
      await pwInput.fill('Shja..59');
      await page.locator('input[type="submit"]').click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
    }
    try {
      const yesBtn = page.locator('input[value="Yes"], input[value="Ja"]');
      if (await yesBtn.first().isVisible({ timeout: 5000 })) {
        await yesBtn.first().click();
        await page.waitForTimeout(5000);
      }
    } catch (e) {}
  }
  await page.waitForTimeout(8000);
  await browser.close();
  return token;
}

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
    if (res.status === 429 && poging < 5) {
      await sleep(15000 * (poging + 1));
      continue;
    }
    let json = null;
    try { json = JSON.parse(text); } catch (e) {}
    return { ok: res.ok, status: res.status, text, json };
  }
}

async function fetchAllJobs() {
  const all = [];
  let cursor = null;
  while (true) {
    const res = await planado(`/jobs?limit=100${cursor ? `&after=${cursor}` : ''}`);
    const jobs = res.json?.jobs || [];
    if (jobs.length === 0) break;
    all.push(...jobs);
    cursor = jobs[jobs.length - 1].uuid;
    await sleep(300);
  }
  return all;
}

// "Montage Sonty - Vincent de Jong" -> "Vincent de Jong"
// "Inmeten Sonty - Arold Borger, Wittgensteinlaan 123, ..." -> "Arold Borger"
function klantnaamUitSubject(subject) {
  const m = subject.match(/(?:montage|inmeten|inmeet|service|reparatie|onderhoud|advies|showroom)[^-]*-\s*(.+)$/i);
  if (!m) return null;
  let naam = m[1].split(',')[0].trim();
  // geen naam als het een tweede taakwoord of leeg is
  if (!naam || /^(sonty|montage|inmeten)$/i.test(naam)) return null;
  // "Brian de Boer /Joyce Witter" laten zoals het is
  return naam.replace(/\s+/g, ' ').substring(0, 100);
}

function extractContacts(bodyText) {
  const phones = new Set();
  const emails = new Set();
  if (bodyText) {
    const clean = bodyText.replace(/[ ]/g, ' ');
    for (const m of clean.matchAll(/(?:\+31|0031|0)\s?6[\s-]?(?:\d[\s-]?){8}|(?:\+31|0031|0)\s?\d{2,3}[\s-]?(?:\d[\s-]?){6,7}/g)) {
      const digits = m[0].replace(/[^\d+]/g, '');
      if (digits.replace(/\D/g, '').length >= 10) phones.add(digits);
      if (phones.size >= 2) break;
    }
    for (const m of clean.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)) {
      const e = m[0].toLowerCase();
      if (!/sonty|sontymontage|planado|reuzenpanda/.test(e)) emails.add(e);
      if (emails.size >= 1) break;
    }
  }
  return { phones: [...phones], emails: [...emails] };
}

async function main() {
  console.log(`=== Planado klant-verrijking (${EXECUTE ? 'EXECUTE' : 'DRY RUN'}) ===`);

  console.log('Outlook-token ophalen...');
  const token = await getOutlookToken();
  if (!token) { console.error('FOUT: geen Outlook-token'); process.exit(1); }

  const oHeaders = {
    'Authorization': `Bearer ${token}`,
    'Prefer': 'outlook.timezone="Europe/Amsterdam", outlook.body-content-type="text"',
  };
  const calsRes = await fetch('https://outlook.office.com/api/v2.0/me/calendars', { headers: oHeaders });
  const cals = (await calsRes.json()).value || [];
  const cal = cals.find((c) => c.Name === 'Sonty Montage');
  if (!cal) { console.error('FOUT: kalender Sonty Montage niet gevonden'); process.exit(1); }

  const startWin = new Date();
  const endWin = new Date(Date.now() + DAYS_AHEAD * 86400000);
  const events = [];
  let url = `https://outlook.office.com/api/v2.0/me/calendars/${cal.Id}/calendarView?startDateTime=${startWin.toISOString()}&endDateTime=${endWin.toISOString()}&$top=200&$select=Subject,Start,End,Location,Body`;
  while (url) {
    const r = await fetch(url, { headers: oHeaders });
    const j = await r.json();
    events.push(...(j.value || []));
    url = j['@odata.nextLink'] || null;
  }
  console.log(`Outlook-events met body: ${events.length}`);
  const byExt = {};
  for (const ev of events) {
    byExt[`outlook-${ev.Id.substring(ev.Id.length - 40)}`] = ev;
  }

  console.log('Planado jobs + bestaande clients ophalen...');
  const jobs = (await fetchAllJobs()).filter(
    (j) => (j.external_id || '').startsWith('outlook-') && (j.scheduled_at || '') >= new Date().toISOString().substring(0, 10)
  );
  const existingClients = [];
  let clientCursor = null;
  while (true) {
    const res = await planado(`/clients?limit=100${clientCursor ? `&after=${clientCursor}` : ''}`);
    const batch = res.json?.clients || [];
    if (batch.length === 0) break;
    existingClients.push(...batch);
    clientCursor = batch[batch.length - 1].uuid;
    await sleep(300);
  }
  const clientByKey = {};
  for (const c of existingClients) clientByKey[(c.name || '').toLowerCase().trim()] = c.uuid;
  console.log(`Jobs: ${jobs.length}, bestaande clients: ${existingClients.length}`);

  let clientsNieuw = 0, gekoppeld = 0, geenNaam = 0, fouten = 0;
  const plan = [];
  for (const job of jobs) {
    if (job.client_uuid) continue;
    const ev = byExt[job.external_id];
    if (!ev) { geenNaam++; continue; }
    const naam = klantnaamUitSubject(ev.Subject || '');
    if (!naam) { geenNaam++; plan.push({ job: job.uuid, subject: ev.Subject, klant: null }); continue; }
    const { phones, emails } = extractContacts(ev.Body?.Content);
    const adres = ev.Location?.DisplayName || null;
    plan.push({ job: job.uuid, subject: ev.Subject, klant: naam, phones, emails, adres });
  }

  const metKlant = plan.filter((p) => p.klant);
  console.log(`\nTe koppelen: ${metKlant.length} jobs, zonder klantnaam: ${plan.length - metKlant.length}`);
  console.log(`Met telefoon: ${metKlant.filter((p) => p.phones.length).length}, met e-mail: ${metKlant.filter((p) => p.emails.length).length}`);
  for (const p of metKlant.slice(0, 10)) console.log(`  ${p.klant} | tel: ${p.phones.join(',') || '-'} | mail: ${p.emails.join(',') || '-'}`);
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'planado-clients-plan.json'), JSON.stringify(plan, null, 1));

  if (!EXECUTE) { console.log('\nDRY RUN klaar. Draai met --execute om uit te voeren.'); return; }

  console.log('\n=== UITVOEREN ===');
  for (const p of metKlant) {
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
    // vers versienummer nodig voor PATCH
    const cur = await planado(`/jobs/${p.job}`);
    const version = cur.json?.job?.version ?? cur.json?.version;
    const res = await planado(`/jobs/${p.job}`, { method: 'PATCH', body: JSON.stringify({ version, client_uuid: clientUuid }) });
    await sleep(1000);
    if (res.ok) gekoppeld++;
    else { fouten++; console.log(`  ✗ koppel ${p.klant}: ${res.status} ${res.text.substring(0, 100)}`); }
    if ((gekoppeld + fouten) % 25 === 0) console.log(`  ... ${gekoppeld} gekoppeld`);
  }

  console.log(`\nKlaar: ${clientsNieuw} clients aangemaakt, ${gekoppeld} jobs gekoppeld, ${plan.length - metKlant.length} zonder klantnaam, ${fouten} fouten.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
