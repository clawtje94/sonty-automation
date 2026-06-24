#!/usr/bin/env node
/**
 * Sync Reuzenpanda offertes → HubSpot deals
 * Match: HS contact email → RP contactPersonId → RP documents
 * Draai elke 5 min als cron
 */
const { chromium } = require('playwright');

const fs = require('fs');
const path = require('path');

const HS_TOKEN = require('./secrets').HUBSPOT_TOKEN;
const HS_BASE = 'https://api.hubapi.com';
const RP_PROFILE_ID = '731483fa-ef6b-4aae-afcf-883ec09219dd';
const TRENGO_TOKEN = fs.readFileSync(path.join(__dirname, '.trengo-api-token.txt'), 'utf8').trim();
const WA_SENT_FILE = path.join(__dirname, '.wa-sent.json');

// Track which deals already received WhatsApp
function getWaSent() { try { return JSON.parse(fs.readFileSync(WA_SENT_FILE, 'utf8')); } catch { return {}; } }
function markWaSent(dealId) { const d = getWaSent(); d[dealId] = new Date().toISOString(); fs.writeFileSync(WA_SENT_FILE, JSON.stringify(d, null, 2)); }

function formatQuote(qd, vd) {
  const q = qd?.quotationData || qd;
  if (!q) return null;
  const lines = ['📄 ' + (q.documentTitle || 'Offerte'), 'Status: ' + (q.quotationStatus || '-'), 'Nummer: ' + (q.quotationNumber || '-'), ''];
  const v = vd?.versions?.[0];
  if (v?.data?.segments) {
    const pg = v.data.segments.find(s => s.type === 'priceLineGroup');
    if (pg?.data?.lines) {
      lines.push('─── Producten ───');
      let t = 0;
      for (const l of pg.data.lines) {
        const nm = l.description.split('\n')[0];
        const sp = l.description.split('\n').slice(1).filter(x => x.trim()).slice(0, 4);
        const lt = l.units * l.pricePerUnit; t += lt;
        lines.push('', l.units + 'x ' + nm, '   €' + l.pricePerUnit.toFixed(2) + ' → €' + lt.toFixed(2));
        sp.forEach(s => lines.push('  ' + s.trim()));
      }
      lines.push('', '─── Totaal ───', 'Excl BTW: €' + t.toFixed(2), 'Incl BTW: €' + (t * 1.21).toFixed(2));
    }
  }
  return lines.join('\n');
}

async function main() {
  console.log('[' + new Date().toISOString().substring(11, 19) + '] Sync start');

  // Bel-taken voor nieuwe leads (afgelopen 2u) — non-blocking, faalt nooit de sync.
  // Draait mee op deze bestaande 15-min cron i.p.v. een aparte crontab-regel.
  try {
    require('child_process')
      .spawn(process.execPath, [__dirname + '/hubspot-bel-taken.js', 'recent'], { detached: true, stdio: 'ignore' })
      .unref();
  } catch (e) {}

  // 1. Get ALL HubSpot deals in Sonty pipeline (not just without desc — also re-check existing for updates)
  const hsRes = await (await fetch(HS_BASE + '/crm/v3/objects/deals/search', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + HS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filterGroups: [{ filters: [
        { propertyName: 'pipeline', operator: 'EQ', value: '3623322812' },
        
        { propertyName: 'dealname', operator: 'NOT_CONTAINS_TOKEN', value: 'TEST' },
      ]}],
      properties: ['dealname', 'sonty_reuzenpanda_description', 'sonty_reuzenpanda_id'],
      sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
      limit: 50,
    }),
  })).json();
  const deals = hsRes.results || [];

  // Get contact emails for all deals
  const dealData = [];
  for (const d of deals) {
    const aRes = await (await fetch(HS_BASE + '/crm/v4/objects/deals/' + d.id + '/associations/contacts', { headers: { 'Authorization': 'Bearer ' + HS_TOKEN } })).json();
    const cId = aRes.results?.[0]?.toObjectId;
    if (!cId) continue;
    const cRes = await (await fetch(HS_BASE + '/crm/v3/objects/contacts/' + cId + '?properties=email', { headers: { 'Authorization': 'Bearer ' + HS_TOKEN } })).json();
    const email = cRes.properties?.email;
    if (email) dealData.push({
      dealId: d.id, dealName: d.properties.dealname, email: email.toLowerCase(),
      hasDesc: !!d.properties.sonty_reuzenpanda_description,
      currentDesc: d.properties.sonty_reuzenpanda_description || '',
      rpId: d.properties.sonty_reuzenpanda_id,
    });
  }
  const needsSync = dealData.filter(d => !d.hasDesc).length;
  console.log('Deals: ' + dealData.length + ' total, ' + needsSync + ' without offerte');

  if (needsSync === 0) {
    console.log('All deals have offerte data. Checking for updates...');
  }

  // 2. Login to Reuzenpanda
  const browser = await chromium.launch({ headless: true, timeout: 30000 });
  try {
  const page = await browser.newPage();
  await page.goto('https://hub.reuzenpanda.nl/login', { timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.fill('input[placeholder*="mail"]', 'daimyboot@gmail.com');
  await page.click('button:has-text("Ga verder")');
  await page.waitForTimeout(3000);
  await page.fill('input[type="password"]', 'TQGb@eD%5nGRSN9@4Gss');
  await page.click('button:has-text("Inloggen")');
  await page.waitForTimeout(5000);
  await page.click('text=Sonty B.V.');
  await page.waitForTimeout(5000);

  // 3. Get email → RP contactPersonId map
  const emailToContactId = await page.evaluate(async (pid) => {
    const res = await fetch('https://backend.reuzenpanda.nl/contact-service/' + pid + '/contact-persons', { credentials: 'include' });
    const data = await res.json();
    const map = {};
    for (const cp of data.contact_persons || []) {
      const email = cp.free_fields?.find(f => f.label === 'email')?.value;
      if (email) map[email.toLowerCase()] = cp.id;
    }
    return map;
  }, RP_PROFILE_ID);

  // 4. Get ALL RP documents with contact_person_id (client-side filter)
  const allDocs = await page.evaluate(async (pid) => {
    const res = await fetch('https://backend.reuzenpanda.nl/document-service/v1/' + pid + '/documents/overview', { credentials: 'include' });
    const data = await res.json();
    return (data.documentDatas || []).map(d => ({
      id: d.id, title: d.document_title, status: d.document_status,
      contactPersonId: d.contact_person_id, number: d.document_number,
      createdAt: d.document_creation_timestamp || 0,
    }));
  }, RP_PROFILE_ID);
  console.log('RP docs loaded:', allDocs.length);

  // Build contactPersonId → documents map
  const cpIdToDocs = {};
  for (const doc of allDocs) {
    if (!doc.contactPersonId) continue;
    if (!cpIdToDocs[doc.contactPersonId]) cpIdToDocs[doc.contactPersonId] = [];
    cpIdToDocs[doc.contactPersonId].push(doc);
  }

  // 5. Match and sync
  let synced = 0;
  let updated = 0;
  const waQueue = []; // Deals that need WhatsApp (status changed to SENT)
  for (const dd of dealData) {
    const rpContactId = emailToContactId[dd.email];
    if (!rpContactId) continue;

    const docs = cpIdToDocs[rpContactId];
    if (!docs || docs.length === 0) continue;

    // Use the most recent document (sorted by creation timestamp, newest first)
    docs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const doc = docs[0];

    // Get quotation + version data
    const [qd, vd] = await Promise.all([
      page.evaluate(async ({ p, d }) => { try { return await (await fetch('https://backend.reuzenpanda.nl/document-service/v1/' + p + '/quotations/' + d, { credentials: 'include' })).json(); } catch(e) { return null; } }, { p: RP_PROFILE_ID, d: doc.id }),
      page.evaluate(async ({ p, d }) => { try { return await (await fetch('https://backend.reuzenpanda.nl/document-service/v1/' + p + '/documents/' + d + '/versions', { credentials: 'include' })).json(); } catch(e) { return null; } }, { p: RP_PROFILE_ID, d: doc.id }),
    ]);

    const formatted = formatQuote(qd, vd);
    if (!formatted) continue;

    // Check if offerte status changed to SENT → queue WhatsApp
    const qStatus = qd?.quotationData?.quotationStatus || doc.status;
    const waSent = getWaSent();
    if ((qStatus === 'SENT' || qStatus === 'ACCEPTED') && !waSent[dd.dealId]) {
      waQueue.push({ dealId: dd.dealId, dealName: dd.dealName, email: dd.email, status: qStatus, docId: doc.id });
    }

    // Check if this is new or updated
    if (!dd.hasDesc) {
      // New — set for first time
      const leadId = qd?.quotationData?.subjects?.leadConfiguration || dd.rpId;
      await fetch(HS_BASE + '/crm/v3/objects/deals/' + dd.dealId, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + HS_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: {
          sonty_reuzenpanda_description: formatted,
          sonty_reuzenpanda_link: 'https://hub.reuzenpanda.nl/app/deals/pipeline?item=' + (leadId || ''),
          sonty_reuzenpanda_id: leadId || '',
        }}),
      });
      console.log('🆕 ' + dd.dealName + ' → ' + doc.title + ' (' + doc.status + ')');
      synced++;
    } else if (formatted.trim().replace(/\s+/g, ' ') !== (dd.currentDesc || '').trim().replace(/\s+/g, ' ')) {
      // Updated — offerte actually changed in Reuzenpanda (normalized comparison)
      await fetch(HS_BASE + '/crm/v3/objects/deals/' + dd.dealId, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + HS_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: { sonty_reuzenpanda_description: formatted } }),
      });
      console.log('🔄 ' + dd.dealName + ' → offerte bijgewerkt');
      updated++;
    }

    await new Promise(r => setTimeout(r, 100));
  }

  console.log('\n✅ Nieuw: ' + synced + ', Bijgewerkt: ' + updated);

  // 6. Send WhatsApp for SENT offertes via Trengo (pure API, no browser needed)
  if (waQueue.length > 0) {
    console.log('\n📱 ' + waQueue.length + ' offerte(s) met status SENT → WhatsApp sturen...');
    for (const wa of waQueue) {
      try {
        const aRes = await (await fetch(HS_BASE + '/crm/v4/objects/deals/' + wa.dealId + '/associations/contacts', { headers: { 'Authorization': 'Bearer ' + HS_TOKEN } })).json();
        const cId = aRes.results?.[0]?.toObjectId;
        if (!cId) { console.log('  ⚠️ ' + wa.dealName + ' → geen contact'); continue; }

        const cRes = await (await fetch(HS_BASE + '/crm/v3/objects/contacts/' + cId + '?properties=firstname,lastname,phone,mobilephone', { headers: { 'Authorization': 'Bearer ' + HS_TOKEN } })).json();
        const phone = cRes.properties?.phone || cRes.properties?.mobilephone;
        const firstName = cRes.properties?.firstname || wa.dealName.split(' ')[0];
        if (!phone) { console.log('  ⚠️ ' + wa.dealName + ' → geen telefoonnummer'); markWaSent(wa.dealId); continue; }

        const dealRes = await (await fetch(HS_BASE + '/crm/v3/objects/deals/' + wa.dealId + '?properties=sonty_reuzenpanda_description', { headers: { 'Authorization': 'Bearer ' + HS_TOKEN } })).json();
        const desc = dealRes.properties?.sonty_reuzenpanda_description || '';
        const productLines = desc.split('\n').filter(l => l.trim() && !l.startsWith('─') && !l.startsWith('Status') && !l.startsWith('Nummer')).slice(0, 5).join('\n');

        let cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
        if (cleanPhone.startsWith('06')) cleanPhone = '+31' + cleanPhone.substring(1);
        if (cleanPhone.startsWith('31') && !cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;

        // Build unique offerte link for this customer
        const offerteLink = 'https://document.reuzenpanda.nl/nl/' + RP_PROFILE_ID + '/' + wa.docId + '/latest';

        const waRes = await fetch('https://app.trengo.com/api/v2/wa_sessions', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + TRENGO_TOKEN, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient_phone_number: cleanPhone,
            hsm_id: 235187,
            channel_id: 1359857,
            params: [
              { type: 'body', key: '{{1}}', value: firstName },
              { type: 'body', key: '{{2}}', value: 'Jaimy' },
              { type: 'body', key: '{{3}}', value: offerteLink },
            ]
          })
        });
        const waBody = await waRes.json();

        if (waRes.ok && waBody.message?.ticket_id) {
          console.log('  📱 ' + wa.dealName + ' → WhatsApp verstuurd! (ticket #' + waBody.message.ticket_id + ')');
          // Sluit ticket → als klant reageert komt het weer als NEW
          try {
            await fetch('https://app.trengo.com/api/v2/tickets/' + waBody.message.ticket_id + '/close', {
              method: 'POST',
              headers: { 'Authorization': 'Bearer ' + TRENGO_TOKEN, 'Content-Type': 'application/json' },
            });
          } catch {}
          markWaSent(wa.dealId);
        } else {
          console.log('  ❌ ' + wa.dealName + ' → WA fout: ' + waRes.status);
        }
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        console.log('  ⚠️ ' + wa.dealName + ' → fout: ' + e.message?.substring(0, 80));
      }
    }
  }

  // Auto-notify via Telegram if new offertes found
  if (synced > 0) {
    try {
      const TG_TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
      const msg = '📊 Auto-sync: ' + synced + ' nieuwe offerte' + (synced > 1 ? 's' : '') + ' gesynct naar HubSpot';
      await fetch('https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: 1700128390, text: msg }),
      });
    } catch(e) {}
  }
  } finally {
    await browser.close().catch(() => {});
  }
}

main().catch(e => { console.error(e); process.exit(1); });
