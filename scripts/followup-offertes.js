#!/usr/bin/env node
/**
 * Follow-up WhatsApp voor openstaande offertes (status SENT, niet ACCEPTED)
 *
 * - Haalt alle SENT offertes op uit Reuzenpanda
 * - Filtert op datum (april + mei 2026)
 * - Stuurt max 200 per dag
 * - Houdt bij wie al een bericht heeft gehad
 * - Unassigned tickets zodat ze in NEW komen
 *
 * Gebruik: node scripts/followup-offertes.js [dry-run|send]
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const TRENGO_TOKEN = fs.readFileSync(path.join(__dirname, '.trengo-api-token.txt'), 'utf8').trim();
const RP_PROFILE_ID = '731483fa-ef6b-4aae-afcf-883ec09219dd';
const SENT_FILE = path.join(__dirname, '.followup-sent.json');
const MAX_PER_DAY = 50;

// Template IDs (update als ze goedgekeurd zijn)
const TEMPLATE_RECENT = 235382; // followup_offerte_recent (mei)
const TEMPLATE_APRIL = 235383;  // followup_offerte_april

function getSentLog() { try { return JSON.parse(fs.readFileSync(SENT_FILE, 'utf8')); } catch { return {}; } }
function markSent(docId, phone) {
  const log = getSentLog();
  log[docId] = { phone, sentAt: new Date().toISOString() };
  fs.writeFileSync(SENT_FILE, JSON.stringify(log, null, 2));
}

async function main() {
  const isDryRun = process.argv[2] !== 'send';
  if (isDryRun) console.log('🔍 DRY RUN — geen berichten worden verstuurd. Gebruik "send" om echt te sturen.\n');

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();

    // Login Reuzenpanda
    console.log('Inloggen bij Reuzenpanda...');
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

    // Haal ALLE documenten op (SENT + ACCEPTED) om te checken of iemand al akkoord is
    console.log('Offertes ophalen...');
    const allDocs = await page.evaluate(async (pid) => {
      const res = await fetch('https://backend.reuzenpanda.nl/document-service/v1/' + pid + '/documents/overview', { credentials: 'include' });
      const data = await res.json();
      return (data.documentDatas || []).map(d => ({ id: d.id, number: d.document_number, contactPersonId: d.contact_person_id, status: d.document_status }));
    }, RP_PROFILE_ID);

    // Maak een set van contactpersonen die AL ergens ACCEPTED hebben
    const acceptedContacts = new Set();
    for (const d of allDocs) {
      if (d.status === 'ACCEPTED' && d.contactPersonId) {
        acceptedContacts.add(d.contactPersonId);
      }
    }
    console.log('Contacten met ACCEPTED offerte:', acceptedContacts.size);

    const docs = allDocs.filter(d => d.status === 'SENT');

    console.log('Totaal SENT offertes:', docs.length);

    // Haal contactgegevens op
    console.log('Contactgegevens ophalen...');
    const contacts = await page.evaluate(async (pid) => {
      const res = await fetch('https://backend.reuzenpanda.nl/contact-service/' + pid + '/contact-persons', { credentials: 'include' });
      const data = await res.json();
      const map = {};
      for (const cp of (data.contact_persons || [])) {
        const phone = cp.free_fields?.find(f => f.label === 'phone' || f.label === 'telefoon')?.value;
        const firstName = cp.first_name || '';
        const lastName = cp.last_name || '';
        if (phone && phone.length > 8 && phone !== '+31612345678') {
          map[cp.id] = { name: (firstName + ' ' + lastName).trim(), firstName: firstName || lastName || '', phone };
        }
      }
      return map;
    }, RP_PROFILE_ID);

    // Haal datums op per offerte (batches van 20)
    console.log('Offerte datums ophalen...');
    const aprilStart = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).getTime(); // alleen laatste 2 weken
    const aprilEnd = new Date('2026-05-01').getTime();
    const mayStart = new Date('2026-05-01').getTime();

    const sentLog = getSentLog();
    const toSend = [];

    for (let i = 0; i < docs.length; i += 20) {
      const batch = docs.slice(i, i + 20);
      const results = await Promise.all(batch.map(doc =>
        page.evaluate(async ({pid, did}) => {
          try {
            const res = await fetch('https://backend.reuzenpanda.nl/document-service/v1/' + pid + '/quotations/' + did, { credentials: 'include' });
            const data = await res.json();
            return { id: did, created: data.quotationData?.quotationCreationTimestamp, status: data.quotationData?.quotationStatus };
          } catch { return { id: did, created: null }; }
        }, { pid: RP_PROFILE_ID, did: doc.id })
      ));

      for (const r of results) {
        if (!r.created) continue;
        if (r.status === 'ACCEPTED' || r.status === 'DRAFT') continue; // dubbel check

        const doc = docs.find(d => d.id === r.id);
        const contact = contacts[doc?.contactPersonId];
        if (!contact?.phone) continue;
        if (sentLog[r.id]) continue; // al verstuurd

        // Skip als deze PERSOON al ergens ACCEPTED heeft
        if (doc.contactPersonId && acceptedContacts.has(doc.contactPersonId)) continue;

        let template = null;
        if (r.created >= mayStart) {
          template = TEMPLATE_RECENT;
        } else if (r.created >= aprilStart && r.created < aprilEnd) {
          template = TEMPLATE_APRIL;
        }

        if (template) {
          toSend.push({
            docId: r.id,
            number: doc.number,
            name: contact.firstName,
            phone: contact.phone,
            contactPersonId: doc.contactPersonId,
            template: template,
            period: template === TEMPLATE_APRIL ? 'april' : 'mei',
            created: new Date(r.created).toISOString().substring(0, 10),
          });
        }
      }

      process.stdout.write('\r  ' + Math.min(i + 20, docs.length) + '/' + docs.length + ' gecontroleerd, ' + toSend.length + ' te versturen');
    }

    console.log('\n\n=== SAMENVATTING ===');
    const aprilCount = toSend.filter(s => s.period === 'april').length;
    const meiCount = toSend.filter(s => s.period === 'mei').length;
    console.log('April offertes:', aprilCount);
    console.log('Mei offertes:', meiCount);
    console.log('Totaal te versturen:', toSend.length);
    console.log('Max vandaag:', MAX_PER_DAY);

    // Sorteer: oudste eerst
    toSend.sort((a, b) => new Date(a.created) - new Date(b.created));

    // DEDUPLICATIE: 1 bericht per telefoonnummer (nieuwste offerte)
    const seenPhones = new Set();
    const sentPhones = new Set(Object.values(sentLog).map(s => s.phone));
    const dedupedSend = [];
    // Reverse zodat we de nieuwste offerte per persoon pakken
    const reversed = [...toSend].reverse();
    for (const s of reversed) {
      const cleanP = s.phone.replace(/[\s\-\(\)]/g, '');
      if (seenPhones.has(cleanP) || sentPhones.has(cleanP)) continue;
      seenPhones.add(cleanP);
      dedupedSend.push(s);
    }
    // Sorteer terug naar oudste eerst
    dedupedSend.sort((a, b) => new Date(a.created) - new Date(b.created));

    console.log('Na deduplicatie: ' + dedupedSend.length + ' (van ' + toSend.length + ', ' + (toSend.length - dedupedSend.length) + ' dubbele telefoons overgeslagen)');
    toSend.length = 0;
    toSend.push(...dedupedSend);

    // Check Trengo voor eerdere gesprekken — skip mensen die al "geen interesse" hadden
    console.log('\nChecken op eerdere gesprekken in Trengo...');
    const filtered = [];
    for (const s of toSend) {
      let cleanPhone = s.phone.replace(/[\s\-\(\)]/g, '');
      if (cleanPhone.startsWith('06')) cleanPhone = '+31' + cleanPhone.substring(1);
      if (cleanPhone.startsWith('31') && !cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;

      // Zoek bestaande tickets voor dit nummer
      try {
        const searchRes = await fetch('https://app.trengo.com/api/v2/tickets?term=' + encodeURIComponent(cleanPhone) + '&channel_id=1359857&limit=3', {
          headers: { 'Authorization': 'Bearer ' + TRENGO_TOKEN }
        });
        const searchData = await searchRes.json();
        const existingTickets = searchData.data || [];

        if (existingTickets.length > 0) {
          // Check laatste berichten voor "geen interesse" signalen
          let skipReason = null;
          for (const ticket of existingTickets.slice(0, 1)) {
            const msgRes = await fetch('https://app.trengo.com/api/v2/tickets/' + ticket.id + '/messages?limit=5', {
              headers: { 'Authorization': 'Bearer ' + TRENGO_TOKEN }
            });
            const msgData = await msgRes.json();
            for (const m of (msgData.data || [])) {
              const msg = (m.message || m.body || '').toLowerCase();
              if (msg.includes('geen interesse') || msg.includes('niet meer nodig') || msg.includes('annuleer') ||
                  msg.includes('toch niet') || msg.includes('elders besteld') || msg.includes('andere aanbieder') ||
                  msg.includes('stop') || msg.includes('niet meer sturen') || msg.includes('uitschrijven')) {
                skipReason = msg.substring(0, 60);
                break;
              }
            }
          }

          if (skipReason) {
            console.log('  ⏭️ Skip ' + s.name + ' (' + s.phone + '): "' + skipReason + '"');
            continue;
          }
        }
      } catch {}

      filtered.push(s);
    }

    console.log('Na filtering: ' + filtered.length + ' (van ' + toSend.length + ', ' + (toSend.length - filtered.length) + ' overgeslagen)');

    const todayBatch = filtered.slice(0, MAX_PER_DAY);
    console.log('Vandaag versturen:', todayBatch.length);

    if (isDryRun) {
      console.log('\nVoorbeelden:');
      for (const s of todayBatch.slice(0, 10)) {
        console.log('  [' + s.period + '] ' + s.number + ' | ' + s.name + ' | ' + s.phone + ' | ' + s.created);
      }
      console.log('\n⚠️  DRY RUN — draai met "send" om echt te versturen');
      // Save de lijst voor review
      fs.writeFileSync('data/followup-batch.json', JSON.stringify(toSend, null, 2));
      console.log('Lijst opgeslagen in data/followup-batch.json');
    } else {
      // ECHT VERSTUREN
      let sent = 0;
      let failed = 0;

      for (const s of todayBatch) {
        let cleanPhone = s.phone.replace(/[\s\-\(\)]/g, '');
        if (cleanPhone.startsWith('06')) cleanPhone = '+31' + cleanPhone.substring(1);
        if (cleanPhone.startsWith('31') && !cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;
        if (!cleanPhone.startsWith('+')) cleanPhone = '+31' + cleanPhone;

        const offerteLink = 'https://document.reuzenpanda.nl/nl/' + RP_PROFILE_ID + '/' + s.docId + '/latest';

        const waRes = await fetch('https://app.trengo.com/api/v2/wa_sessions', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + TRENGO_TOKEN, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient_phone_number: cleanPhone,
            hsm_id: s.template,
            channel_id: 1359857,
            params: [
              { type: 'body', key: '{{1}}', value: s.name || 'daar' },
              { type: 'body', key: '{{2}}', value: offerteLink },
            ]
          })
        });

        const waBody = await waRes.json();

        if (waRes.ok && waBody.message?.ticket_id) {
          // Sluit ticket → als klant reageert komt het weer als NEW
          try {
            await fetch('https://app.trengo.com/api/v2/tickets/' + waBody.message.ticket_id + '/close', {
              method: 'POST',
              headers: { 'Authorization': 'Bearer ' + TRENGO_TOKEN, 'Content-Type': 'application/json' },
            });
          } catch {}

          markSent(s.docId, cleanPhone);
          sent++;
          if (sent % 10 === 0) process.stdout.write('\r  ' + sent + '/' + todayBatch.length + ' verstuurd');
        } else {
          failed++;
        }

        await new Promise(r => setTimeout(r, 500)); // Rate limit
      }

      console.log('\n\n✅ Klaar! Verstuurd: ' + sent + ', Mislukt: ' + failed);
      console.log('Morgen nog ' + Math.max(0, toSend.length - MAX_PER_DAY) + ' te gaan');
    }

  } finally {
    await browser.close().catch(() => {});
  }
}

main().catch(e => { console.error(e); process.exit(1); });
