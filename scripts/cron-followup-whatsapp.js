#!/usr/bin/env node
/**
 * Follow-up WhatsApp voor openstaande offertes — v2
 *
 * Draait dagelijks om 10:30 via launchd. Stuurt max 25 WhatsApp per dag.
 *
 * Regels:
 * - Alleen items in "Offerte verstuurd" status (recent, 14 dagen)
 * - Per item: haal offerte via lead_configuration_id (zelfde als v3, geen grote lijsten)
 * - NIET sturen als de offerte ACCEPTED is (klant al akkoord)
 * - NIET sturen als de persoon in Afgerond/Gripp invullen staat
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
const TEMPLATE_ID = 235382;
const WA_CHANNEL = 1359857;
const TG_TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
const BACKLOG_ID = 'e9d5462b-0f3e-43b5-ba60-d61a1ca4f0d7';
const OV_STATUS = '15c4f0be-c6bf-447d-bf5f-a233c482eb53';
const SKIP_STATUSES = [
  '2082ad8a-517c-4e24-8c0f-a5be69b1588a', // Afgerond
  'f895f76f-175e-4ea0-bb7c-6cc2f4e5d846', // Gripp invullen (= al akkoord)
];

function getSentLog() { try { return JSON.parse(fs.readFileSync(SENT_FILE, 'utf8')); } catch { return {}; } }
function markSent(phone) {
  const log = getSentLog();
  log[phone] = new Date().toISOString();
  fs.writeFileSync(SENT_FILE, JSON.stringify(log, null, 2));
}

// Fetch met retry
async function fetchRetry(url, options, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try { return await fetch(url, options); }
    catch (e) {
      if (i === tries) throw e;
      console.log('  (netwerkfout, poging ' + (i + 1) + '/' + tries + ' over ' + (i * 5) + 's: ' + (e.cause?.code || e.message) + ')');
      await new Promise(r => setTimeout(r, i * 5000));
    }
  }
}

// Veilige JSON parse — Trengo geeft soms HTML terug bij rate limit/errors
async function safeJson(res) {
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { console.log('  (ongeldige JSON response, ' + text.substring(0, 50) + '...)'); return null; }
}

async function rpGet(endpoint) {
  const res = await fetchRetry('https://backend.reuzenpanda.nl' + endpoint, {
    headers: { 'Authorization': 'Bearer ' + RP_API_KEY }
  });
  if (!res.ok) return null;
  return safeJson(res);
}

async function main() {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  if (day === 0 || hour < 9 || hour >= 18) {
    console.log('[' + now.toISOString().substring(11, 19) + '] Buiten kantooruren, skip');
    return;
  }

  console.log('[' + now.toISOString().substring(11, 19) + '] Follow-up WhatsApp v2 start');

  const fourteenDaysAgo = Date.now() - 14 * 86400000;

  // Haal alle backlog items op
  const itemsData = await rpGet('/contact-service/' + PID + '/backlogs/' + BACKLOG_ID + '/items');
  const allItems = itemsData?.items || [];

  // Filter: items in "Offerte verstuurd", laatste 14 dagen, niet gearchiveerd
  const ovItems = allItems.filter(i =>
    i.status_id === OV_STATUS &&
    i.timestamp_created > fourteenDaysAgo &&
    !i.technical_labels?.some(l => l.type === 'ITEM_ARCHIVED')
  );

  // Maak set van emails die in Afgerond/Gripp invullen staan
  const skipEmails = new Set();
  allItems.forEach(i => {
    if (SKIP_STATUSES.includes(i.status_id) && i.fields?.email) {
      skipEmails.add(i.fields.email.toLowerCase());
    }
  });

  console.log('Offerte verstuurd items (14 dagen): ' + ovItems.length);
  console.log('Skip emails (afgerond/gripp): ' + skipEmails.size);

  // Per item: haal offerte op via lead_configuration_id
  const sentLog = getSentLog();
  const toSend = [];

  for (const item of ovItems) {
    const email = item.fields?.email?.toLowerCase();
    const phone = item.fields?.phone;
    const name = item.summary;

    if (!phone || phone.length < 9) continue;
    if (!name) continue;
    if (email && skipEmails.has(email)) continue;

    let cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    if (cleanPhone.startsWith('06')) cleanPhone = '+31' + cleanPhone.substring(1);
    if (cleanPhone.startsWith('31') && !cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;
    if (!cleanPhone.startsWith('+')) cleanPhone = '+31' + cleanPhone;

    // Al follow-up gehad?
    if (sentLog[cleanPhone]) continue;

    // Haal offerte op via lead_configuration_id (lichtgewicht, per item)
    const lcId = item.item_subject?.id;
    if (!lcId) continue;

    const docData = await rpGet('/document-service/v1/' + PID + '/quotations?lead_configuration_id=' + lcId);
    const docs = (docData?.quotationDatas || []);
    docs.sort((a, b) => (b.quotationCreationTimestamp || 0) - (a.quotationCreationTimestamp || 0));
    const doc = docs[0];
    if (!doc) continue;

    // Skip als offerte al ACCEPTED is
    if (doc.quotationStatus === 'ACCEPTED') continue;

    toSend.push({
      name,
      phone: cleanPhone,
      firstName: name.split(' ')[0],
      docId: doc.documentId,
    });
  }

  // Dedup op telefoon
  const seenPhones = new Set();
  const deduped = toSend.filter(s => {
    if (seenPhones.has(s.phone)) return false;
    seenPhones.add(s.phone);
    return true;
  });

  console.log('Te versturen (na filters): ' + deduped.length);
  console.log('Max vandaag: ' + MAX_PER_DAY);

  const batch = deduped.slice(0, MAX_PER_DAY);
  let sent = 0;
  let failed = 0;

  for (const s of batch) {
    // Check Trengo voor "geen interesse"
    try {
      const searchRes = await fetchRetry('https://app.trengo.com/api/v2/tickets?term=' + encodeURIComponent(s.phone) + '&channel_id=' + WA_CHANNEL + '&limit=3', {
        headers: { 'Authorization': 'Bearer ' + TRENGO_TOKEN }
      });
      const searchData = await safeJson(searchRes);
      const tickets = searchData.data || [];

      let skip = false;
      for (const ticket of tickets.slice(0, 1)) {
        const msgRes = await fetchRetry('https://app.trengo.com/api/v2/tickets/' + ticket.id + '/messages?limit=5', {
          headers: { 'Authorization': 'Bearer ' + TRENGO_TOKEN }
        });
        const msgData = await safeJson(msgRes);
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

    // Stuur WhatsApp met correcte link
    const offerteLink = 'https://document.reuzenpanda.nl/nl/' + PID + '/' + s.docId + '/latest?pdfAction=DOCSIGN';

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
    const waBody = await safeJson(waRes);

    if (waRes.ok && waBody.message?.ticket_id) {
      await fetchRetry('https://app.trengo.com/api/v2/tickets/' + waBody.message.ticket_id + '/close', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + TRENGO_TOKEN },
      });
      markSent(s.phone);
      sent++;
    } else {
      failed++;
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n=== SAMENVATTING ===');
  console.log('Verstuurd: ' + sent);
  console.log('Mislukt: ' + failed);
  console.log('Nog te gaan: ' + Math.max(0, deduped.length - MAX_PER_DAY));

  if (sent > 0 || failed > 0) {
    await fetchRetry('https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: 1700128390, text: 'Follow-up WhatsApp: ' + sent + ' verstuurd' + (failed > 0 ? ', ' + failed + ' mislukt' : '') + '\nNog te gaan: ' + Math.max(0, deduped.length - MAX_PER_DAY) }),
    }).catch(() => {});
  }
}

main().catch(e => { console.error(e); process.exit(1); });
