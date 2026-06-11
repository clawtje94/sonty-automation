#!/usr/bin/env node
/**
 * Follow-up na 3 dagen als klant niet heeft gereageerd op offerte WhatsApp
 *
 * Checks:
 * 1. Trengo: geen inbound WhatsApp bericht na onze offerte
 * 2. HubSpot: deal nog in vroege stage (Nieuwe Lead / Prijsindicatie Verstuurd)
 * → Als beide: stuur follow-up
 *
 * Draait dagelijks via launchd
 */

const fs = require('fs');
const path = require('path');

const TRENGO_TOKEN = fs.readFileSync(path.join(__dirname, '.trengo-api-token.txt'), 'utf8').trim();
const HS_TOKEN = require('./secrets').HUBSPOT_TOKEN;
const WA_SENT_FILE = path.join(__dirname, '.wa-sent.json');
const FOLLOWUP_SENT_FILE = path.join(__dirname, '.followup-3d-sent.json');
const MAX_PER_DAY = 9999;

// Template ID — wordt bijgewerkt zodra goedgekeurd
const TEMPLATE_FOLLOWUP_3D = 0; // TODO: vul in na goedkeuring

// Vroege stages waar follow-up zinvol is
const EARLY_STAGES = ['4998659267', '4999295181', '4999295182', '4999295183', '4999295184'];

function getFollowupSent() { try { return JSON.parse(fs.readFileSync(FOLLOWUP_SENT_FILE, 'utf8')); } catch { return {}; } }

async function main() {
  if (TEMPLATE_FOLLOWUP_3D === 0) {
    console.log('⚠️ Template ID nog niet ingesteld — wacht op goedkeuring');
    return;
  }

  const waSent = JSON.parse(fs.readFileSync(WA_SENT_FILE, 'utf8'));
  const followupSent = getFollowupSent();

  const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

  // Filter: offertes verstuurd 3-7 dagen geleden, nog geen follow-up gehad
  const candidates = [];
  for (const [dealId, sentData] of Object.entries(waSent)) {
    const sentAt = typeof sentData === 'string' ? new Date(sentData).getTime() : new Date(sentData.sentAt || sentData).getTime();
    if (isNaN(sentAt)) continue;

    // 3-7 dagen geleden verstuurd
    if (sentAt > threeDaysAgo || sentAt < sevenDaysAgo) continue;

    // Al follow-up gehad?
    if (followupSent[dealId]) continue;

    candidates.push({ dealId, sentAt });
  }

  console.log('Kandidaten voor 3-dagen follow-up:', candidates.length);
  if (candidates.length === 0) return;

  let sent = 0;
  let skippedReply = 0;
  let skippedStage = 0;
  let skippedNoPhone = 0;

  for (const candidate of candidates.slice(0, MAX_PER_DAY)) {
    try {
      // CHECK 1: HubSpot deal stage — nog in vroege fase?
      const dealRes = await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${candidate.dealId}?properties=dealname,dealstage`, {
        headers: { 'Authorization': 'Bearer ' + HS_TOKEN }
      });

      if (!dealRes.ok) continue;
      const deal = await dealRes.json();
      const stage = deal.properties?.dealstage;

      if (!EARLY_STAGES.includes(stage)) {
        skippedStage++;
        continue;
      }

      // Haal contact op
      const assocRes = await fetch(`https://api.hubapi.com/crm/v4/objects/deals/${candidate.dealId}/associations/contacts`, {
        headers: { 'Authorization': 'Bearer ' + HS_TOKEN }
      });
      const assocData = await assocRes.json();
      const contactId = assocData.results?.[0]?.toObjectId;
      if (!contactId) continue;

      const contactRes = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=firstname,lastname,phone,mobilephone`, {
        headers: { 'Authorization': 'Bearer ' + HS_TOKEN }
      });
      const contact = await contactRes.json();
      const phone = contact.properties?.phone || contact.properties?.mobilephone;
      const firstName = contact.properties?.firstname || deal.properties?.dealname?.split(' ')[0] || '';

      if (!phone) { skippedNoPhone++; continue; }

      let cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
      if (cleanPhone.startsWith('06')) cleanPhone = '+31' + cleanPhone.substring(1);
      if (cleanPhone.startsWith('31') && !cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;

      // CHECK 2: Trengo — heeft de klant gereageerd?
      const searchRes = await fetch('https://app.trengo.com/api/v2/tickets?term=' + encodeURIComponent(cleanPhone) + '&channel_id=1359857&limit=3', {
        headers: { 'Authorization': 'Bearer ' + TRENGO_TOKEN }
      });
      const searchData = await searchRes.json();
      const tickets = searchData.data || [];

      let hasReplied = false;
      for (const ticket of tickets) {
        const msgRes = await fetch('https://app.trengo.com/api/v2/tickets/' + ticket.id + '/messages?limit=10', {
          headers: { 'Authorization': 'Bearer ' + TRENGO_TOKEN }
        });
        const msgData = await msgRes.json();
        for (const m of (msgData.data || [])) {
          if (m.type === 'INBOUND') {
            const msgTime = new Date(m.created_at).getTime();
            // Inbound bericht NA onze offerte WhatsApp
            if (msgTime > candidate.sentAt) {
              hasReplied = true;
              break;
            }
          }
        }
        if (hasReplied) break;
      }

      if (hasReplied) { skippedReply++; continue; }

      // BEIDE CHECKS PASSED → stuur follow-up
      const waRes = await fetch('https://app.trengo.com/api/v2/wa_sessions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + TRENGO_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_phone_number: cleanPhone,
          hsm_id: TEMPLATE_FOLLOWUP_3D,
          channel_id: 1359857,
          params: [
            { type: 'body', key: '{{1}}', value: firstName || 'daar' },
          ]
        })
      });
      const waBody = await waRes.json();

      if (waRes.ok && waBody.message?.ticket_id) {
        // Close ticket
        await fetch('https://app.trengo.com/api/v2/tickets/' + waBody.message.ticket_id + '/close', {
          method: 'POST', headers: { 'Authorization': 'Bearer ' + TRENGO_TOKEN }
        });

        followupSent[candidate.dealId] = new Date().toISOString();
        sent++;
        console.log('📱 ' + deal.properties.dealname + ' → follow-up verstuurd');
      }

      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      console.log('⚠️ Fout:', e.message?.substring(0, 60));
    }
  }

  // Opslaan
  fs.writeFileSync(FOLLOWUP_SENT_FILE, JSON.stringify(followupSent, null, 2));

  console.log('\n=== SAMENVATTING ===');
  console.log('Follow-up verstuurd:', sent);
  console.log('Overgeslagen (al gereageerd via WA):', skippedReply);
  console.log('Overgeslagen (deal al verder in pipeline):', skippedStage);
  console.log('Overgeslagen (geen telefoon):', skippedNoPhone);
}

main().catch(e => { console.error(e); process.exit(1); });
