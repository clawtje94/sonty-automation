#!/usr/bin/env node
/**
 * Follow-up WhatsApp voor openstaande offertes
 *
 * Draait dagelijks. Stuurt max 25 WhatsApp per dag.
 *
 * Regels:
 * - Alleen SENT offertes (niet ACCEPTED/DRAFT)
 * - Alleen laatste 14 dagen
 * - NIET sturen als de persoon een ACCEPTED offerte heeft (of in Afgerond staat)
 * - 1 bericht per telefoonnummer
 * - Check Trengo voor "geen interesse" signalen
 */

const fs = require('fs');
const path = require('path');

const RP_API_KEY = 'reuzenpanda_cpat_WMD2KmDRune53bj7.d0_ls8loPpAjb2TrSNOS_Xd_QLdxHq1xwOC9pyyJado';
const PID = '731483fa-ef6b-4aae-afcf-883ec09219dd';
const TRENGO_TOKEN = fs.readFileSync(path.join(__dirname, '.trengo-api-token.txt'), 'utf8').trim();
const SENT_FILE = path.join(__dirname, '.followup-v2-sent.json');
const MAX_PER_DAY = 25;
const TEMPLATE_ID = 235382; // followup_offerte_recent
const WA_CHANNEL = 1359857;
const TG_TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
const BACKLOG_ID = 'e9d5462b-0f3e-43b5-ba60-d61a1ca4f0d7';

function getSentLog() { try { return JSON.parse(fs.readFileSync(SENT_FILE, 'utf8')); } catch { return {}; } }
function markSent(phone) {
  const log = getSentLog();
  log[phone] = new Date().toISOString();
  fs.writeFileSync(SENT_FILE, JSON.stringify(log, null, 2));
}

// Fetch met retry voor tijdelijke netwerkfouten (ECONNRESET etc.) — max 3 pogingen
async function fetchRetry(url, options, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      return await fetch(url, options);
    } catch (e) {
      if (i === tries) throw e;
      console.log('  (netwerkfout, poging ' + (i + 1) + '/' + tries + ' over ' + (i * 5) + 's: ' + (e.cause?.code || e.message) + ')');
      await new Promise(r => setTimeout(r, i * 5000));
    }
  }
}

async function rpGet(endpoint) {
  const res = await fetchRetry('https://backend.reuzenpanda.nl' + endpoint, {
    headers: { 'Authorization': 'Bearer ' + RP_API_KEY }
  });
  if (!res.ok) return null;
  return res.json();
}

async function main() {
  // Tijdcheck: alleen ma-za 9-18
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  if (day === 0 || hour < 9 || hour >= 18) {
    console.log('[' + now.toISOString().substring(11, 19) + '] Buiten kantooruren, skip');
    return;
  }

  console.log('[' + now.toISOString().substring(11, 19) + '] Follow-up WhatsApp start');

  // Haal alle quotations
  const qData = await rpGet('/document-service/v1/' + PID + '/quotations?document_number=2026');
  const qList = qData?.quotationDatas || [];

  const fourteenDaysAgo = Date.now() - 14 * 86400000;

  // Filter: SENT + laatste 14 dagen
  const sentDocs = qList.filter(q =>
    q.quotationStatus === 'SENT' &&
    q.quotationCreationTimestamp > fourteenDaysAgo
  );

  // Maak set van contact persons met ACCEPTED offerte
  const acceptedTotals = new Set();
  qList.filter(q => q.quotationStatus === 'ACCEPTED').forEach(q => {
    // We weten niet de contact_person_id uit de qList
    // Maar we kunnen matchen via pricing.total
    acceptedTotals.add(q.pricing?.total);
  });

  // Haal backlog items om te checken welke in Afgerond staan
  const itemsData = await rpGet('/contact-service/' + PID + '/backlogs/' + BACKLOG_ID + '/items');
  const allItems = itemsData?.items || [];

  // Maak sets van emails die in Afgerond of ACCEPTED status staan
  const afgerondEmails = new Set();
  const AFGEROND_STATUSES = [
    'f984913c-1e91-455b-b45a-6c0ed36ffaeb', // Afgerond
    '2082ad8a-517c-4e24-8c0f-a5be69b1588a', // Afgerond (2)
    'f895f76f-175e-4ea0-bb7c-6cc2f4e5d846', // grip invullen (= al akkoord)
  ];
  allItems.forEach(i => {
    if (AFGEROND_STATUSES.includes(i.status_id)) {
      if (i.fields?.email) afgerondEmails.add(i.fields.email.toLowerCase());
    }
  });

  // Haal contacts op
  const contactsData = await rpGet('/contact-service/' + PID + '/contact-persons');
  const contacts = contactsData?.contact_persons || [];

  // Maak email → contact map
  const emailToContact = {};
  contacts.forEach(c => {
    const email = c.free_fields?.find(f => f.label === 'email')?.value?.toLowerCase();
    const phone = c.free_fields?.find(f => f.label === 'phone')?.value;
    const name = c.display_name || '';
    if (email) emailToContact[email] = { id: c.id, name, phone, email };
  });

  // Maak contact_person_id → heeft ACCEPTED set
  // Check via de backlog items welke personen ACCEPTED offertes hebben
  const acceptedEmails = new Set();
  allItems.forEach(i => {
    // Check of deze persoon een ACCEPTED offerte heeft
    // We matchen via email
    const email = i.fields?.email?.toLowerCase();
    if (!email) return;

    // Check in qList of er een ACCEPTED doc is met matching lead_value
    const itemValue = parseFloat((i.lead_value || '').replace(/[^0-9.]/g, '')) || 0;
    const hasAccepted = qList.some(q =>
      q.quotationStatus === 'ACCEPTED' &&
      Math.abs((q.pricing?.total || 0) - itemValue) < 5
    );
    if (hasAccepted) acceptedEmails.add(email);
  });

  // Merge: iedereen die in afgerond OF accepted staat
  const skipEmails = new Set([...afgerondEmails, ...acceptedEmails]);

  console.log('SENT docs (14 dagen):', sentDocs.length);
  console.log('Skip emails (afgerond/accepted):', skipEmails.size);

  // Match SENT docs met contacts en filter
  const sentLog = getSentLog();
  const toSend = [];

  for (const doc of sentDocs) {
    // Match contact via timestamp (zelfde als offerte controle)
    const itemValue = doc.pricing?.total || 0;
    let matchedItem = null;

    // Zoek het backlog item met matching bedrag
    const byValue = allItems.filter(i => {
      const val = parseFloat((i.lead_value || '').replace(/[^0-9.]/g, '')) || 0;
      return Math.abs(val - itemValue) < 5;
    });
    if (byValue.length === 1) matchedItem = byValue[0];
    else if (byValue.length > 1) {
      byValue.sort((a, b) => Math.abs(a.timestamp_created - doc.quotationCreationTimestamp) - Math.abs(b.timestamp_created - doc.quotationCreationTimestamp));
      matchedItem = byValue[0];
    }

    if (!matchedItem) continue;

    const email = matchedItem.fields?.email?.toLowerCase();
    const phone = matchedItem.fields?.phone;
    const name = matchedItem.summary;

    if (!phone || phone.length < 9) continue;
    if (!name) continue;

    // Skip als deze persoon al akkoord/afgerond is
    if (email && skipEmails.has(email)) continue;

    // Skip als al follow-up gehad
    let cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    if (cleanPhone.startsWith('06')) cleanPhone = '+31' + cleanPhone.substring(1);
    if (cleanPhone.startsWith('31') && !cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;
    if (!cleanPhone.startsWith('+')) cleanPhone = '+31' + cleanPhone;

    if (sentLog[cleanPhone]) continue;

    toSend.push({ name, phone: cleanPhone, firstName: name.split(' ')[0], docNumber: doc.quotationNumber });
  }

  // Dedup op telefoon
  const seenPhones = new Set();
  const deduped = toSend.filter(s => {
    if (seenPhones.has(s.phone)) return false;
    seenPhones.add(s.phone);
    return true;
  });

  console.log('Te versturen (na filters):', deduped.length);
  console.log('Max vandaag:', MAX_PER_DAY);

  const batch = deduped.slice(0, MAX_PER_DAY);
  let sent = 0;
  let failed = 0;

  for (const s of batch) {
    // Check Trengo voor "geen interesse"
    try {
      const searchRes = await fetchRetry('https://app.trengo.com/api/v2/tickets?term=' + encodeURIComponent(s.phone) + '&channel_id=' + WA_CHANNEL + '&limit=3', {
        headers: { 'Authorization': 'Bearer ' + TRENGO_TOKEN }
      });
      const searchData = await searchRes.json();
      const tickets = searchData.data || [];

      let skip = false;
      for (const ticket of tickets.slice(0, 1)) {
        const msgRes = await fetchRetry('https://app.trengo.com/api/v2/tickets/' + ticket.id + '/messages?limit=5', {
          headers: { 'Authorization': 'Bearer ' + TRENGO_TOKEN }
        });
        const msgData = await msgRes.json();
        for (const m of (msgData.data || [])) {
          const msg = (m.message || m.body || '').toLowerCase();
          if (msg.includes('geen interesse') || msg.includes('niet meer nodig') || msg.includes('annuleer') ||
              msg.includes('stop') || msg.includes('niet meer sturen') || msg.includes('uitschrijven') ||
              msg.includes('elders besteld') || msg.includes('andere aanbieder')) {
            skip = true; break;
          }
        }
      }
      if (skip) continue;
    } catch {}

    // Stuur WhatsApp
    const offerteLink = 'https://document.reuzenpanda.nl/nl/' + PID + '/' + s.docNumber + '/latest';

    const waRes = await fetchRetry('https://app.trengo.com/api/v2/wa_sessions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + TRENGO_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient_phone_number: s.phone,
        hsm_id: TEMPLATE_ID,
        channel_id: WA_CHANNEL,
        params: [
          { type: 'body', key: '{{1}}', value: s.firstName || 'daar' },
          { type: 'body', key: '{{2}}', value: offerteLink },
        ]
      })
    });
    const waBody = await waRes.json();

    if (waRes.ok && waBody.message?.ticket_id) {
      await fetchRetry('https://app.trengo.com/api/v2/tickets/' + waBody.message.ticket_id + '/close', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + TRENGO_TOKEN },
      });
      markSent(s.phone);
      sent++;
    } else {
      failed++;
    }

    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n=== SAMENVATTING ===');
  console.log('Verstuurd:', sent);
  console.log('Mislukt:', failed);
  console.log('Nog te gaan:', Math.max(0, deduped.length - MAX_PER_DAY));

  if (sent > 0) {
    const msg = 'Follow-up WhatsApp: ' + sent + ' verstuurd, ' + failed + ' mislukt, ' + Math.max(0, deduped.length - MAX_PER_DAY) + ' morgen';
    await fetch('https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: 1700128390, text: msg }),
    });
  }
}

main().catch(e => { console.error(e); process.exit(1); });
