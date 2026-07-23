#!/usr/bin/env node
/**
 * Automatische offerte controle + Google Sheet bijwerken
 *
 * Draait elk uur tussen 9:00-18:00 via launchd
 *
 * Stap 1: Offerte controle deals verwerken
 *   - Montage aanpassen (solar weg + prijs op basis bediening)
 *   - Voorraadscherm → 20% korting
 *   - Tahoma → max 1
 *   - Montage samenvoegen
 *   - Volgorde: producten → montage → tahoma → opmerkingen
 *   - Markiezen/gordijnen/toevoegingen → Handmatige controle
 *   - Rest → Gecontroleerd
 *
 * Stap 2: Google Sheet "Claude code daimy" bijwerken
 *   - Alle Gecontroleerd deals → sheet
 */

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const RP_API_KEY = 'reuzenpanda_cpat_WMD2KmDRune53bj7.d0_ls8loPpAjb2TrSNOS_Xd_QLdxHq1xwOC9pyyJado';
const PID = '731483fa-ef6b-4aae-afcf-883ec09219dd';
const BACKLOG_ID = 'e9d5462b-0f3e-43b5-ba60-d61a1ca4f0d7';
const OC_STATUS = '64788881-632c-4217-8f56-d20732c94b08';
const GECONTROLEERD = 'c860c5ae-7eef-45cc-8e79-3b4bcd285b7a';
const HANDMATIG = '6221c9fd-c835-45dc-a494-f81e40a8e184';
const TEVER_STATUS = '20815fa5-94ce-40a3-8e1f-d36093de006f';
const GORDIJNEN_STATUS = '7286b1fb-bca1-4772-a993-373f957b3b61';
const BOOKINGS_URL = 'https://bookings.cloud.microsoft/book/SontyMontage1@sontymontage.nl/s/lAKws2wHtEOFjHYzLwjXdQ2?ismsaljsauthenabled=true';
const SHEET_ID = '1NesKeIKLVOLJjSy-fqo5KXrEVG2VJTYSfjgN7EHY85g';
const SHEET_TAB = 'Claude code daimy';
const TG_TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
const TRENGO_TOKEN = fs.readFileSync(path.join(__dirname, '.trengo-api-token.txt'), 'utf8').trim();
const TRENGO_EMAIL_CHANNEL = 1359813; // Klantenservice (joey@sontymontage.nl) — TODO: aanvragen@sonty.nl
const TEVER_SENT_FILE = path.join(__dirname, '.tever-sent.json');
const SONTY_LAT = 52.0116; // GOUDA (Daimy 23-07)
const SONTY_LON = 4.7104;

async function rpGet(endpoint) {
  const res = await fetch('https://backend.reuzenpanda.nl' + endpoint, {
    headers: { 'Authorization': 'Bearer ' + RP_API_KEY }
  });
  if (!res.ok) return null;
  return res.json();
}

async function rpPut(endpoint, body) {
  const res = await fetch('https://backend.reuzenpanda.nl' + endpoint, {
    method: 'PUT',
    headers: { 'Authorization': 'Bearer ' + RP_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status };
}

async function rpPatch(endpoint, body) {
  const res = await fetch('https://backend.reuzenpanda.nl' + endpoint, {
    method: 'PATCH',
    headers: { 'Authorization': 'Bearer ' + RP_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status };
}

function getTeVerSent() { try { return JSON.parse(fs.readFileSync(TEVER_SENT_FILE, 'utf8')); } catch { return {}; } }
function markTeVerSent(email) {
  const log = getTeVerSent();
  log[email] = new Date().toISOString();
  fs.writeFileSync(TEVER_SENT_FILE, JSON.stringify(log, null, 2));
}

async function geocode(address) {
  await new Promise(r => setTimeout(r, 1100));
  const res = await fetch('https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(address + ', Nederland') + '&format=json&limit=1', {
    headers: { 'User-Agent': 'SontyAutomation/1.0' }
  });
  const data = await res.json();
  if (data[0]) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  return null;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function checkTeVer(city, bedrag) {
  if (!city) return false;
  const coords = await geocode(city);
  if (!coords) return false;
  const dist = haversine(SONTY_LAT, SONTY_LON, coords.lat, coords.lon);
  if (dist > 125) return true;
  if (dist >= 60 && bedrag < 7500) return true;
  return false;
}

async function sendTeVerEmail(naam, email) {
  const teVerSent = getTeVerSent();
  if (teVerSent[email]) return false; // al verstuurd

  const voornaam = naam.split(' ')[0];
  const htmlBody = '<p>Hi ' + voornaam + ',</p>' +
    '<p>Hartelijk dank voor je interesse in Sonty en je aanvraag voor een prijsvoorstel. We waarderen het dat je aan ons hebt gedacht!</p>' +
    '<p>Helaas moeten we je laten weten dat jouw locatie buiten ons werkgebied valt. Hierdoor kunnen we helaas geen offerte uitbrengen of montage inplannen.</p>' +
    '<p>Mocht je in de toekomst in onze regio een project hebben, dan helpen we je uiteraard graag verder.</p>' +
    '<p>We wensen je veel succes met je zoektocht en bedanken je nogmaals voor het vertrouwen.</p>' +
    '<p>Met vriendelijke groet,<br>Joey</p>' +
    '<p>Sonty B.V.</p>';

  // Maak ticket aan
  const ticketRes = await fetch('https://app.trengo.com/api/v2/tickets', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + TRENGO_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channel_id: TRENGO_EMAIL_CHANNEL,
      contact_identifier: email,
      subject: 'Helaas valt uw locatie buiten ons werkgebied - Sonty',
    }),
  });
  if (!ticketRes.ok) return false;
  const ticket = await ticketRes.json();

  // Stuur email
  const msgRes = await fetch('https://app.trengo.com/api/v2/tickets/' + ticket.id + '/messages', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + TRENGO_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: htmlBody, body_type: 'html' }),
  });
  if (!msgRes.ok) return false;

  // Sluit ticket
  await fetch('https://app.trengo.com/api/v2/tickets/' + ticket.id + '/close', {
    method: 'POST', headers: { 'Authorization': 'Bearer ' + TRENGO_TOKEN },
  });

  markTeVerSent(email);
  return true;
}

async function sendGordijnenEmail(naam, email) {
  const teVerSent = getTeVerSent(); // hergebruik dezelfde log
  if (teVerSent['gordijn_' + email]) return false;

  const voornaam = naam.split(' ')[0];
  const htmlBody = '<p>Hi ' + voornaam + ',</p>' +
    '<p>Bedankt voor je interesse in gordijnen bij Sonty! We waarderen het dat je aan ons hebt gedacht.</p>' +
    '<p>In onze showroom in Rijswijk hebben we een breed assortiment aan binnenraamdecoratie: van gordijnen en gordijnrailsen tot plissés, vouwgordijnen en zelfs prachtig Arte behang. Zo kun je de verschillende stoffen zien, voelen en op je gemak de juiste keuze maken.</p>' +
    '<p>Tijdens je bezoek nemen we alles met je door: van stofkeuze en kleur tot ophangsysteem en afmetingen. Onze adviseur helpt je graag met een passend advies.</p>' +
    '<p><strong>Plan je afspraak in via deze link:</strong><br>' +
    '<a href="' + BOOKINGS_URL + '">' + BOOKINGS_URL + '</a></p>' +
    '<p><strong>Onze showroom:</strong><br>' +
    'Frijdastraat 8F, 2288 EX Rijswijk<br>' +
    'Di t/m vr: 9:30 - 17:00<br>' +
    'Za: 9:30 - 16:00</p>' +
    '<p>Heb je vragen? Bel of app ons gerust op 085 006 9681.</p>' +
    '<p>We kijken ernaar uit je te ontvangen!</p>' +
    '<p>Met vriendelijke groet,<br>Het Sonty Team</p>' +
    '<p>Sonty B.V.</p>';

  const ticketRes = await fetch('https://app.trengo.com/api/v2/tickets', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + TRENGO_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channel_id: TRENGO_EMAIL_CHANNEL,
      contact_identifier: email,
      subject: 'Uitnodiging voor een afspraak in onze showroom - Sonty',
    }),
  });
  if (!ticketRes.ok) return false;
  const ticket = await ticketRes.json();

  const msgRes = await fetch('https://app.trengo.com/api/v2/tickets/' + ticket.id + '/messages', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + TRENGO_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: htmlBody, body_type: 'html' }),
  });
  if (!msgRes.ok) return false;

  await fetch('https://app.trengo.com/api/v2/tickets/' + ticket.id + '/close', {
    method: 'POST', headers: { 'Authorization': 'Bearer ' + TRENGO_TOKEN },
  });

  markTeVerSent('gordijn_' + email);
  return true;
}

function mapProductCategory(lines) {
  for (const l of lines) {
    const d = (l.description?.split('\n')[0] || '').toLowerCase();
    if (d.includes('montage') || d.includes('inmeten') || d.includes('tahoma')) continue;
    if (l.pricePerUnit === 0) continue;
    if (d.includes('voorraad')) return 'Voorraadscherm';
    if (d.includes('rolluik')) return 'Rolluiken';
    if (d.includes('zip design') || d.includes('sunelite') || d.includes('sunproject') || d.includes('suncube') || d.includes('square') || d.includes('suncontrol') || d.includes('zipscreen')) return 'Screens';
    if (d.includes('suneye')) return 'Voorraadscherm';
    if (d.includes('pergola')) return 'Pergola';
    if (d.includes('sunbasic') || d.includes('knikarm')) return 'Knikarmscherm';
    if (d.includes('markies')) return 'Markiezen';
    if (d.includes('plisse') || d.includes('gordijn') || d.includes('jaloezie') || d.includes('rolgordijn')) return 'Raamdeco binnen';
  }
  return '';
}

const AFKOMST_MAP = {
  'social media': 'Instagram', 'google': 'Google', 'bekende': 'Bekenden',
  'buren': 'Buren', 'anders': 'Anders', 'bestaande klant': 'Bestaande klant',
};

// Per item: haal de offerte op via lead_configuration → doc UUID (NIET via de lijst!)
async function getDocForItem(item) {
  const lcId = item.item_subject?.id;
  if (!lcId) return null;

  // Haal de doc UUID op via de backlog item description
  // De description bevat de offerte configuratie maar niet het doc UUID
  // We moeten zoeken via een lichte query per offerte nummer
  // Alternatief: cache van eerder opgehaalde docs

  // Gebruik het lead_configuration ID om de doc te vinden
  // Helaas is er geen direct endpoint hiervoor
  // Oplossing: haal recente docs op per item (max 3 dagen, via item timestamp)
  return null; // wordt per item opgehaald in de main loop
}

// Pas montage aan op basis van product bediening — ALTIJD in originele volgorde
function adjustMontage(lines) {
  let changed = false;

  // STAP 1: Loop door originele volgorde, onthoud bediening per product
  let lastBediening = '';
  for (let i = 0; i < lines.length; i++) {
    // Onthoud bediening van elk product
    const bed = lines[i].description?.match(/Bediening:\s*([^\n]+)/i)?.[1]?.trim()?.toLowerCase();
    if (bed) lastBediening = bed;

    const d = (lines[i].description?.split('\n')[0] || '').toLowerCase();
    if (!(d.includes('montage') || d.includes('inmeten'))) continue;
    if (!(d.includes('rolluik') || d.includes('screen'))) continue;

    const isSolar = lastBediening.includes('solar') || lastBediening.includes('brel');
    const isDraaischakelaar = lastBediening.includes('draaischakelaar');

    if (isSolar) {
      // Moet solar in naam + €175
      if (!d.includes('solar')) {
        lines[i].description = lines[i].description.replace(/(montage rolluik|montage screen)/i, '$1 solar');
        changed = true;
      }
      if (lines[i].pricePerUnit !== 175) { lines[i].pricePerUnit = 175; changed = true; }
    } else {
      // Moet GEEN solar + juiste prijs
      if (d.includes('solar')) {
        lines[i].description = lines[i].description.replace(/ solar/gi, '');
        changed = true;
      }
      const expectedPrice = isDraaischakelaar ? 225 : 195;
      if (lines[i].pricePerUnit !== expectedPrice) { lines[i].pricePerUnit = expectedPrice; changed = true; }
    }
  }

  return changed;
}

// Herorden + samenvoegen + tahoma max 1
function reorderAndMerge(lines) {
  let changed = false;
  const producten = [];
  const montageMap = {};
  let tahomaLine = null;
  const opmerkingen = [];

  for (const l of lines) {
    const d = (l.description?.split('\n')[0] || '').toLowerCase();
    if (d.includes('tahoma')) {
      if (!tahomaLine) tahomaLine = { ...l, units: 1 };
      else changed = true;
      continue;
    }
    if (d.includes('montage') || d.includes('inmeten')) {
      const key = l.description?.split('\n')[0] + '|' + l.pricePerUnit;
      if (!montageMap[key]) montageMap[key] = { ...l, units: 0 };
      if (montageMap[key].units > 0) changed = true;
      montageMap[key].units += l.units;
      continue;
    }
    if (l.pricePerUnit === 0 && (l.units === 0 || d.length < 5)) {
      opmerkingen.push(l);
      continue;
    }
    producten.push(l);
  }

  const newLines = [...producten, ...Object.values(montageMap)];
  if (tahomaLine) newLines.push(tahomaLine);
  newLines.push(...opmerkingen);

  if (newLines.length !== lines.length) changed = true;
  else {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].description?.split('\n')[0] !== newLines[i].description?.split('\n')[0] ||
          lines[i].units !== newLines[i].units || lines[i].pricePerUnit !== newLines[i].pricePerUnit) {
        changed = true; break;
      }
    }
  }

  return { newLines, changed };
}

// Self-check: verifieer dat een offerte correct is
function selfCheck(lines, discount) {
  const errors = [];

  // Check montage per product
  let lastBed = '';
  for (let i = 0; i < lines.length; i++) {
    const bed = lines[i].description?.match(/Bediening:\s*([^\n]+)/i)?.[1]?.trim()?.toLowerCase();
    if (bed) lastBed = bed;

    const d = (lines[i].description?.split('\n')[0] || '').toLowerCase();
    if (!(d.includes('montage') || d.includes('inmeten'))) continue;
    if (!(d.includes('rolluik') || d.includes('screen'))) continue;

    const isSolar = lastBed.includes('solar') || lastBed.includes('brel');
    if (!isSolar && d.includes('solar')) errors.push('solar in montage bij bedraad');
    if (isSolar && !d.includes('solar')) errors.push('solar ontbreekt bij solar product');

    const isDraaischakelaar = lastBed.includes('draaischakelaar');
    const expected = isSolar ? 175 : (isDraaischakelaar ? 225 : 195);
    if (lines[i].pricePerUnit !== expected) errors.push('montage prijs €' + lines[i].pricePerUnit + ' moet €' + expected);
  }

  // Tahoma max 1
  const tc = lines.filter(l => l.description?.toLowerCase().includes('tahoma')).length;
  if (tc > 1) errors.push('tahoma ' + tc + 'x');

  // Montage samenvoegen
  const mg = {};
  lines.forEach(l => {
    const d = l.description?.split('\n')[0] || '';
    if (d.toLowerCase().includes('montage') || d.toLowerCase().includes('inmeten')) {
      const k = d + '|' + l.pricePerUnit; mg[k] = (mg[k] || 0) + 1;
    }
  });
  for (const [k, c] of Object.entries(mg)) { if (c > 1) errors.push('montage niet samengevoegd'); }

  // Voorraadscherm korting
  if (lines.some(l => (l.description?.split('\n')[0]?.toLowerCase() || '').includes('voorraad')) && discount !== 20)
    errors.push('voorraad korting ' + discount + '%');

  return errors;
}

async function processOfferteControle() {
  const sevenDaysAgo = Date.now() - 7 * 86400000;

  const itemsData = await rpGet('/contact-service/' + PID + '/backlogs/' + BACKLOG_ID + '/items');
  const allItems = itemsData?.items || [];
  const ocItems = allItems.filter(i =>
    i.status_id === OC_STATUS &&
    i.timestamp_created > sevenDaysAgo &&
    !i.technical_labels?.some(l => l.type === 'ITEM_ARCHIVED')
  );

  if (ocItems.length === 0) return { processed: 0, fixed: 0, handmatig: 0 };

  let okCount = 0, fixCount = 0, handCount = 0;

  for (const item of ocItems) {
    const lcId = item.item_subject?.id;
    if (!lcId) continue;

    // Haal doc op via lead_configuration_id filter (1 lichte call per item)
    const lcDocs = await rpGet('/document-service/v1/' + PID + '/quotations?lead_configuration_id=' + lcId);
    const docList = lcDocs?.quotationDatas || [];
    // Pak de nieuwste doc
    docList.sort((a, b) => (b.quotationCreationTimestamp || 0) - (a.quotationCreationTimestamp || 0));
    const docInfo = docList[0];
    if (!docInfo) continue;

    // Haal full data op via UUID
    const fullData = await rpGet('/document-service/v1/' + PID + '/quotations/' + docInfo.documentId);
    if (!fullData?.quotationData) continue;

    const qd = fullData.quotationData;
    const plg = qd.segments?.defaultTemplatePriceLineGroup;
    if (!plg?.data?.lines) continue;

    const docId = docInfo.documentId;
    const lines = plg.data.lines;
    const desc = item.description || '';
    const opmerking = desc.match(/Opmerking:\s*([\s\S]*?)(?=\n\d+x |\n*$)/i)?.[1]?.trim() || '';
    const hasToevoegingen = opmerking.toLowerCase().includes('toevoeg') || opmerking.toLowerCase().includes('aanpass') || desc.includes('TOEVOEGEN');
    const isMarkies = lines.some(l => l.description?.toLowerCase().includes('markies'));
    const isGordijn = lines.some(l => l.description?.toLowerCase().includes('gordijn') || (l.description?.toLowerCase().includes('plisse') && !l.description?.toLowerCase().includes('zip')));
    const email = desc.match(/E-mailadres:\s*([^\n]+)/i)?.[1]?.trim() || item.fields?.email || '';
    const city = desc.match(/Plaats:\s*([^\n]+)/i)?.[1]?.trim() || '';

    const total = lines.reduce((s, l) => s + l.units * l.pricePerUnit, 0);
    const discount = plg.data.groupDiscount?.amount || 0;
    const bedragVoorCheck = total * (1 - discount / 100);

    // STAP 1: TE VER check
    const teVer = await checkTeVer(city, bedragVoorCheck);
    if (teVer) {
      if (email) await sendTeVerEmail(item.summary, email);
      await rpPatch('/contact-service/' + PID + '/backlogs/' + BACKLOG_ID + '/items/' + item.id,
        { item: { status_id: TEVER_STATUS } });
      handCount++;
      continue;
    }

    // STAP 2: Gordijnen
    if (isGordijn) {
      if (email) await sendGordijnenEmail(item.summary, email);
      await rpPatch('/contact-service/' + PID + '/backlogs/' + BACKLOG_ID + '/items/' + item.id,
        { item: { status_id: GORDIJNEN_STATUS } });
      handCount++;
      continue;
    }

    // STAP 3: Markiezen / toevoegingen
    if (isMarkies || hasToevoegingen) {
      await rpPatch('/contact-service/' + PID + '/backlogs/' + BACKLOG_ID + '/items/' + item.id,
        { item: { status_id: HANDMATIG } });
      handCount++;
      continue;
    }

    // STAP 4: Offerte aanpassen
    let changed = false;

    // 4a. Voorraadscherm korting
    const isVoorraad = lines.some(l => (l.description?.split('\n')[0]?.toLowerCase() || '').includes('voorraad'));
    if (isVoorraad && plg.data.groupDiscount?.amount !== 20) {
      plg.data.groupDiscount.amount = 20;
      plg.data.groupDiscount.name = '20% korting voorraad scherm';
      changed = true;
    }

    // 4b. Montage aanpassen IN ORIGINELE VOLGORDE (voor herordenen!)
    if (adjustMontage(lines)) changed = true;

    // 4c. Herordenen + samenvoegen + tahoma
    const { newLines, changed: reorderChanged } = reorderAndMerge(lines);
    if (reorderChanged) changed = true;

    // SELF-CHECK: verifieer resultaat
    const errors = selfCheck(newLines, plg.data.groupDiscount?.amount || 0);
    if (errors.length > 0) {
      console.log('⚠️ SELF-CHECK FAILED voor ' + item.summary + ': ' + errors.join(', '));
      // NIET opslaan, NIET status wijzigen — meld via Telegram
      await fetch('https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: 1700128390, text: '⚠️ Self-check failed: ' + item.summary + '\n' + errors.join('\n') }),
      });
      continue;
    }

    if (changed) {
      plg.data.lines = newLines;
      const putResult = await rpPut('/document-service/v1/' + PID + '/quotations/' + docId, qd);
      if (!putResult.ok) continue;
    }

    await rpPatch('/contact-service/' + PID + '/backlogs/' + BACKLOG_ID + '/items/' + item.id,
      { item: { status_id: GECONTROLEERD } });

    if (changed) fixCount++; else okCount++;
  }

  return { processed: okCount + fixCount + handCount, ok: okCount, fixed: fixCount, handmatig: handCount };
}

async function updateSheet() {
  const sevenDaysAgo = Date.now() - 7 * 86400000;

  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, '../data/google-service-account.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const itemsData = await rpGet('/contact-service/' + PID + '/backlogs/' + BACKLOG_ID + '/items');
  const allItems = itemsData?.items || [];
  const gcItems = allItems.filter(i =>
    i.status_id === GECONTROLEERD &&
    i.timestamp_created > sevenDaysAgo &&
    !i.technical_labels?.some(l => l.type === 'ITEM_ARCHIVED')
  );

  const rows = [];
  let teVerCount = 0;

  for (const item of gcItems) {
    const lcId = item.item_subject?.id;
    if (!lcId) continue;

    // Haal doc op via lead_configuration_id filter (1 lichte call)
    const lcDocs = await rpGet('/document-service/v1/' + PID + '/quotations?lead_configuration_id=' + lcId);
    const docList = lcDocs?.quotationDatas || [];
    docList.sort((a, b) => (b.quotationCreationTimestamp || 0) - (a.quotationCreationTimestamp || 0));
    const docInfo = docList[0];
    if (!docInfo) continue;

    const fullData = await rpGet('/document-service/v1/' + PID + '/quotations/' + docInfo.documentId);

    const desc = item.description || '';
    const afkomstRaw = desc.match(/Hoe komt u bij ons terecht\?:\s*([^\n]+)/i)?.[1]?.trim()?.toLowerCase() || '';
    const afkomst = AFKOMST_MAP[afkomstRaw] || afkomstRaw || '';
    const city = desc.match(/Plaats:\s*([^\n]+)/i)?.[1]?.trim() || '';
    const phone = (item.fields?.phone || '').replace(/^\+/, '');
    const email = item.fields?.email || '';

    let bedrag = 0;
    let productCat = '';
    let offerteNr = docInfo?.quotationNumber || '';

    if (fullData?.quotationData) {
      const plg = fullData.quotationData.segments?.defaultTemplatePriceLineGroup;
      if (plg?.data?.lines) {
        const total = plg.data.lines.reduce((s, l) => s + l.units * l.pricePerUnit, 0);
        const discount = plg.data.groupDiscount?.amount || 0;
        bedrag = total * (1 - discount / 100);
        productCat = mapProductCategory(plg.data.lines);
      }
    }

    // TE VER check
    const teVer = await checkTeVer(city, bedrag);
    if (teVer && email) {
      const sent = await sendTeVerEmail(item.summary, email);
      if (sent) teVerCount++;
    }

    const d = new Date(item.timestamp_created);
    const datum = d.getDate() + '-' + (d.getMonth() + 1) + '-' + String(d.getFullYear()).slice(-2);
    const bedragStr = teVer ? 'TE VER' : (bedrag > 0 ? ('€ ' + bedrag.toFixed(2).replace('.', ',')) : '');

    rows.push([
      datum,
      item.summary.split(' ')[0],
      item.summary.split(' ').slice(1).join(' '),
      city, phone, bedragStr, offerteNr, '', 'Online', afkomst, 'Prive', productCat,
    ]);
  }

  // Sorteer op offerte nummer
  rows.sort((a, b) => (parseInt(a[6]) || 0) - (parseInt(b[6]) || 0));

  // Groepeer per maand
  const MAAND_NAMEN = ['Jan', 'Feb', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
  const perMaand = {};
  for (const r of rows) {
    const [dag, maand, jaar] = r[0].split('-').map(Number);
    const tabNaam = MAAND_NAMEN[maand - 1] + ' 20' + jaar;
    if (!perMaand[tabNaam]) perMaand[tabNaam] = [];
    perMaand[tabNaam].push(r);
  }

  // Haal alle bestaande tabs op
  const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const bestaandeTabs = sheetMeta.data.sheets.map(s => s.properties.title);

  let totalRows = 0;
  for (const [tabNaam, tabRows] of Object.entries(perMaand)) {
    // Check of tab bestaat
    if (!bestaandeTabs.includes(tabNaam)) {
      // Tab bestaat niet → Telegram bericht
      await fetch('https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: 1700128390, text: 'Tab "' + tabNaam + '" bestaat nog niet in de Drive. Maak deze aan zodat ik de offertes kan invullen.' }),
      });
      console.log('Tab "' + tabNaam + '" bestaat niet — Telegram gestuurd');
      continue;
    }

    // Zoek laatste rij met data
    const fullRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: tabNaam + '!A4:A2000',
    });
    const allA = fullRes.data.values || [];
    let lastRow = 3;
    for (let i = allA.length - 1; i >= 0; i--) {
      if (allA[i][0] && allA[i][0].trim()) { lastRow = i + 4; break; }
    }

    // Check duplicaten: lees bestaande offerte nummers
    const existRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: tabNaam + '!G4:G2000',
    });
    const existingNrs = new Set((existRes.data.values || []).map(r => r[0]).filter(Boolean));

    const newRows = tabRows.filter(r => !existingNrs.has(r[6]));
    if (newRows.length === 0) continue;

    const startRow = lastRow + 1;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: tabNaam + '!A' + startRow + ':L' + (startRow + newRows.length - 1),
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: newRows },
    });

    // Geel markeren
    const tabSheet = sheetMeta.data.sheets.find(s => s.properties.title === tabNaam);
    if (tabSheet) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          requests: [{
            repeatCell: {
              range: {
                sheetId: tabSheet.properties.sheetId,
                startRowIndex: startRow - 1,
                endRowIndex: startRow - 1 + newRows.length,
                startColumnIndex: 0,
                endColumnIndex: 12,
              },
              cell: { userEnteredFormat: { backgroundColor: { red: 1, green: 1, blue: 0 } } },
              fields: 'userEnteredFormat.backgroundColor',
            }
          }],
        },
      });
    }

    console.log(tabNaam + ': ' + newRows.length + ' rijen (rij ' + startRow + '-' + (startRow + newRows.length - 1) + ') geel');
    totalRows += newRows.length;
  }

  return { rows: totalRows, teVer: teVerCount };
}

async function main() {
  // Alleen draaien ma-za 9:00-18:00
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0=zo, 6=za
  if (day === 0 || hour < 9 || hour >= 18) {
    console.log('[' + now.toISOString().substring(11, 19) + '] Buiten kantooruren (ma-za 9-18), skip');
    return;
  }

  console.log('[' + now.toISOString().substring(11, 19) + '] Offerte controle + Sheet update start');

  try {
    // Stap 1: Offerte controle verwerken
    const result = await processOfferteControle();
    console.log('Stap 1: ' + result.processed + ' verwerkt (OK:' + result.ok + ' Fixed:' + result.fixed + ' Handmatig:' + result.handmatig + ')');

    // Stap 2: Sheet bijwerken + TE VER emails sturen
    const sheetResult = await updateSheet();
    console.log('Stap 2: ' + sheetResult.rows + ' rijen in sheet, ' + sheetResult.teVer + ' TE VER emails');

    // Telegram als er iets verwerkt is
    if (result.processed > 0 || sheetResult.teVer > 0) {
      let msg = 'Offerte controle: ' + result.ok + ' OK, ' + result.fixed + ' aangepast, ' + result.handmatig + ' handmatig';
      msg += '\nSheet: ' + sheetResult.rows + ' rijen bijgewerkt';
      if (sheetResult.teVer > 0) msg += '\nTE VER: ' + sheetResult.teVer + ' emails verstuurd';
      await fetch('https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: 1700128390, text: msg }),
      });
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();
