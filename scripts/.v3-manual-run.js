#!/usr/bin/env node
/**
 * Offerte controle v3 — volledig herschreven
 *
 * 3x per dag: 9:30, 13:00, 17:00 (ma-za)
 *
 * Per offerte in "Offerte controle":
 * 1. Routing: TE VER / Gordijnen / Markiezen / Toevoegingen
 * 2. Offerte aanpassen: omschrijving + montage prijs (in originele volgorde)
 * 3. Herordenen: producten → montage → tahoma → opmerkingen
 * 4. Self-check: alles moet kloppen voor opslaan
 * 5. Status → Gecontroleerd + Sheet bijwerken
 *
 * API: nooit grote lijsten laden, alleen per item via lead_configuration_id
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
const SHEET_ID = '1NesKeIKLVOLJjSy-fqo5KXrEVG2VJTYSfjgN7EHY85g';
const TG_TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
const TRENGO_TOKEN = fs.readFileSync(path.join(__dirname, '.trengo-api-token.txt'), 'utf8').trim();
const TRENGO_EMAIL_CHANNEL = 1359813;
const BOOKINGS_URL = 'https://bookings.cloud.microsoft/book/SontyMontage1@sontymontage.nl/s/lAKws2wHtEOFjHYzLwjXdQ2?ismsaljsauthenabled=true';
const TEVER_SENT_FILE = path.join(__dirname, '.tever-sent.json');
const SONTY_LAT = 52.0446, SONTY_LON = 4.3188;

// Verkoopteksten aan/uit — zet op false om alleen technische aanpassingen te doen
const ENHANCE_DESCRIPTIONS = false; // UITGESCHAKELD — beschrijvingen moeten eerst goed getest worden

// ============ API HELPERS ============

async function rpGet(ep) {
  const res = await fetch('https://backend.reuzenpanda.nl' + ep, { headers: { 'Authorization': 'Bearer ' + RP_API_KEY } });
  if (!res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

async function rpPut(ep, body) {
  const res = await fetch('https://backend.reuzenpanda.nl' + ep, {
    method: 'PUT', headers: { 'Authorization': 'Bearer ' + RP_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.ok;
}

async function rpPatch(ep, body) {
  const res = await fetch('https://backend.reuzenpanda.nl' + ep, {
    method: 'PATCH', headers: { 'Authorization': 'Bearer ' + RP_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.ok;
}

async function setStatus(itemId, statusId) {
  return rpPatch('/contact-service/' + PID + '/backlogs/' + BACKLOG_ID + '/items/' + itemId, { item: { status_id: statusId } });
}

async function getDocForItem(lcId) {
  const data = await rpGet('/document-service/v1/' + PID + '/quotations?lead_configuration_id=' + lcId);
  const docs = data?.quotationDatas || [];
  docs.sort((a, b) => (b.quotationCreationTimestamp || 0) - (a.quotationCreationTimestamp || 0));
  return docs[0] || null;
}

async function getFullDoc(docId) {
  return rpGet('/document-service/v1/' + PID + '/quotations/' + docId);
}

async function saveDoc(docId, qd) {
  return rpPut('/document-service/v1/' + PID + '/quotations/' + docId, qd);
}

async function sendTelegram(text) {
  await fetch('https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: 1700128390, text: text.substring(0, 4000) }),
  }).catch(() => {});
}

// ============ TE VER + EMAIL ============

function getTeVerSent() { try { return JSON.parse(fs.readFileSync(TEVER_SENT_FILE, 'utf8')); } catch { return {}; } }
function markTeVerSent(key) {
  const log = getTeVerSent();
  log[key] = new Date().toISOString();
  fs.writeFileSync(TEVER_SENT_FILE, JSON.stringify(log, null, 2));
}

async function geocode(address) {
  await new Promise(r => setTimeout(r, 1100));
  try {
    const res = await fetch('https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(address + ', Nederland') + '&format=json&limit=1', {
      headers: { 'User-Agent': 'SontyAutomation/1.0' }
    });
    const data = await res.json();
    if (data[0]) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch {}
  return null;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function checkTeVer(city, bedrag) {
  if (!city || city.replace(/[^a-zA-Z]/g, '').length < 2) return false;
  const coords = await geocode(city);
  if (!coords) return false;
  const dist = haversine(SONTY_LAT, SONTY_LON, coords.lat, coords.lon);
  return dist > 125 || (dist >= 60 && bedrag < 7500);
}

async function sendEmail(email, subject, htmlBody, logKey) {
  const sent = getTeVerSent();
  if (sent[logKey]) return false;
  try {
    const ticketRes = await fetch('https://app.trengo.com/api/v2/tickets', {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + TRENGO_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel_id: TRENGO_EMAIL_CHANNEL, contact_identifier: email, subject }),
    });
    if (!ticketRes.ok) return false;
    const ticket = await ticketRes.json();
    const msgRes = await fetch('https://app.trengo.com/api/v2/tickets/' + ticket.id + '/messages', {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + TRENGO_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: htmlBody, body_type: 'html' }),
    });
    if (!msgRes.ok) return false;
    await fetch('https://app.trengo.com/api/v2/tickets/' + ticket.id + '/close', {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + TRENGO_TOKEN },
    }).catch(() => {});
    markTeVerSent(logKey);
    return true;
  } catch { return false; }
}

async function sendTeVerEmail(naam, email) {
  const voornaam = naam.split(' ')[0];
  return sendEmail(email, 'Helaas valt uw locatie buiten ons werkgebied - Sonty',
    '<p>Hi ' + voornaam + ',</p><p>Hartelijk dank voor je interesse in Sonty en je aanvraag voor een prijsvoorstel. We waarderen het dat je aan ons hebt gedacht!</p><p>Helaas moeten we je laten weten dat jouw locatie buiten ons werkgebied valt. Hierdoor kunnen we helaas geen offerte uitbrengen of montage inplannen.</p><p>Mocht je in de toekomst in onze regio een project hebben, dan helpen we je uiteraard graag verder.</p><p>We wensen je veel succes met je zoektocht en bedanken je nogmaals voor het vertrouwen.</p><p>Met vriendelijke groet,<br>Joey</p><p>Sonty B.V.</p>',
    'tever_' + email);
}

async function sendGordijnenEmail(naam, email) {
  const voornaam = naam.split(' ')[0];
  return sendEmail(email, 'Uitnodiging voor een afspraak in onze showroom - Sonty',
    '<p>Hi ' + voornaam + ',</p><p>Bedankt voor je interesse in gordijnen bij Sonty! We waarderen het dat je aan ons hebt gedacht.</p><p>In onze showroom in Rijswijk hebben we een breed assortiment aan binnenraamdecoratie: van gordijnen en gordijnrailsen tot plissés, vouwgordijnen en zelfs prachtig Arte behang. Zo kun je de verschillende stoffen zien, voelen en op je gemak de juiste keuze maken.</p><p>Tijdens je bezoek nemen we alles met je door: van stofkeuze en kleur tot ophangsysteem en afmetingen. Onze adviseur helpt je graag met een passend advies.</p><p><strong>Plan je afspraak in via deze link:</strong><br><a href="' + BOOKINGS_URL + '">' + BOOKINGS_URL + '</a></p><p><strong>Onze showroom:</strong><br>Frijdastraat 8F, 2288 EX Rijswijk<br>Di t/m vr: 9:30 - 17:00<br>Za: 9:30 - 16:00</p><p>Heb je vragen? Bel of app ons gerust op 085 006 9681.</p><p>We kijken ernaar uit je te ontvangen!</p><p>Met vriendelijke groet,<br>Het Sonty Team</p><p>Sonty B.V.</p>',
    'gordijn_' + email);
}

// ============ PRODUCT MAPPING ============

const PRODUCT_MAP = {
  'rolluik|solar': { type: 'rolluik solar', bediening: 'afstandsbediening', motor: 'Somfy RS100 IO solar' },
  'rolluik|bedraad': { type: 'rolluik bedraad', bediening: 'afstandsbediening', motor: 'somfy RS100 IO' },
  'rolluik|draaischakelaar': { type: 'rolluik draaischakelaar', bediening: 'vaste draaischakelaar op de muur', motor: 'Somfy LT' },
  'screen|solar': { type: 'screen solar', bediening: 'afstandsbediening', motor: 'Somfy RS100 IO solar' },
  'screen|bedraad': { type: 'screen bedraad', bediening: 'afstandsbediening', motor: 'somfy RS100 IO motor' },
  'screen|draaischakelaar': { type: 'screen draaischakelaar', bediening: 'vaste draaischakelaar op de muur', motor: 'Somfy LT motor' },
  'knikarmscherm|bedraad': { type: 'knikarmscherm bedraad', bediening: 'afstandsbediening', motor: 'somfy RS100 IO' },
  'knikarmscherm|draaischakelaar': { type: 'knikarmscherm draaischakelaar', bediening: 'vaste draaischakelaar op de muur', motor: 'Somfy LT' },
  'knikarmscherm|handbediend': { type: 'handbediend zonnescherm', bediening: 'slingerstang buitenzijde', motor: null },
  'uitvalscherm|solar': { type: 'uitvalscherm solar', bediening: 'afstandsbediening', motor: 'Brel solar' },
  'uitvalscherm|bedraad': { type: 'uitvalscherm bedraad', bediening: 'afstandsbediening', motor: 'somfy RS100 IO' },
  'uitvalscherm|draaischakelaar': { type: 'uitvalscherm draaischakelaar', bediening: 'vaste draaischakelaar op de muur', motor: 'Somfy LT motor' },
  'uitvalscherm|handbediend': { type: 'handbediend zonnescherm', bediening: 'slingerstang buitenzijde', motor: null },
  'pergola|bedraad': { type: 'pergola bedraad', bediening: 'afstandsbediening', motor: 'somfy IO motor' },
  'pergola|draaischakelaar': { type: 'pergola draaischakelaar', bediening: 'vaste draaischakelaar op de muur', motor: 'Somfy LT motor' },
  'serre|bedraad': { type: 'serre zonwering bedraad', bediening: 'afstandsbediening', motor: 'somfy IO motor' },
  'serre|draaischakelaar': { type: 'serre zonwering draaischakelaar', bediening: 'vaste draaischakelaar op de muur', motor: 'Somfy LT motor' },
};

function getCategory(firstLine) {
  const d = firstLine.toLowerCase();
  if (d.includes('montage') || d.includes('inmeten') || d.includes('tahoma') || d.includes('eolis') || d.includes('connectivity')) return null;
  if (d.includes('rolluik')) return 'rolluik';
  if (d.includes('zip design') || d.includes('sunelite') || d.includes('square') || d.includes('zipscreen')) return 'screen';
  if (d.includes('sunproject') || d.includes('suncube')) return 'uitvalscherm';
  if (d.includes('suneye') || d.includes('sunbasic') || d.includes('knikarm')) return 'knikarmscherm';
  if (d.includes('pergola')) return 'pergola';
  if (d.includes('suncontrol') || d.includes('serre')) return 'serre';
  return null;
}

function getBedType(bediening, motor) {
  const b = (bediening || '').toLowerCase();
  const m = (motor || '').toLowerCase();
  if (b.includes('solar') || b.includes('brel') || m.includes('solar') || m.includes('brel')) return 'solar';
  if (b.includes('draaischakelaar') || m.includes('somfy lt')) return 'draaischakelaar';
  if (b.includes('slingerstang') || b.includes('handbediend')) return 'handbediend';
  return 'bedraad';
}

function getMontagePrice(cat, bedType, isUitgebreid) {
  if (cat === 'rolluik') return bedType === 'solar' ? 175 : bedType === 'draaischakelaar' ? 225 : 195;
  if (cat === 'screen') return bedType === 'solar' ? 175 : bedType === 'draaischakelaar' ? 225 : 195;
  if (cat === 'knikarmscherm') return bedType === 'handbediend' ? 250 : (isUitgebreid ? 325 : 275);
  if (cat === 'uitvalscherm') return 220;
  if (cat === 'pergola') return 650;
  if (cat === 'serre') return 350;
  return null;
}

// ============ TRANSFORMS ============

// Pas product omschrijving aan: voeg Type toe na naam, vervang Bediening, voeg Motor toe
function transformProductDesc(desc, cat, bedType) {
  const m = PRODUCT_MAP[cat + '|' + bedType];
  if (!m) return desc;
  const lines = desc.split('\n');
  const result = [];
  let bedReplaced = false;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (i === 0) {
      const title = lines[i].replace(/^\*\*|\*\*$/g, ''); // strip bestaande bold
      result.push('**' + title + '**');
      result.push('Type: ' + m.type);
      continue;
    }
    if (t.toLowerCase().startsWith('type:')) continue;
    if (t.toLowerCase().startsWith('bediening:')) {
      result.push('Bediening: ' + m.bediening);
      if (m.motor) result.push('Motor: ' + m.motor);
      bedReplaced = true;
      continue;
    }
    if (t.toLowerCase().startsWith('motor:')) continue;
    result.push(lines[i]);
  }
  if (!bedReplaced) {
    const gi = result.findIndex(l => l.toLowerCase().includes('garantie'));
    const ins = ['Bediening: ' + m.bediening];
    if (m.motor) ins.push('Motor: ' + m.motor);
    result.splice(gi >= 0 ? gi : result.length, 0, ...ins);
  }
  return result.join('\n');
}

// Pas montage aan: behoud originele titel + bullets, alleen prijs wijzigen
function adjustMontageInPlace(line, cat, bedType) {
  let changed = false;
  const fullDesc = (line.description || '').toLowerCase();
  const isUitgebreid = fullDesc.includes('uitgebreid') || fullDesc.includes('inclusief uitbouw') || fullDesc.includes('met uitbouw');
  const correctPrice = getMontagePrice(cat, bedType, isUitgebreid);
  if (correctPrice !== null && line.pricePerUnit !== correctPrice) {
    line.pricePerUnit = correctPrice;
    changed = true;
  }
  // Montage naam solar weg als niet solar
  if (bedType !== 'solar') {
    const firstLine = line.description?.split('\n')[0] || '';
    if (firstLine.toLowerCase().includes('solar')) {
      line.description = line.description.replace(/ solar/gi, '');
      changed = true;
    }
  }
  return changed;
}

// Herorden + samenvoegen
function reorderAndMerge(lines) {
  let changed = false;
  const producten = [], montageMap = {};
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
    if (l.pricePerUnit === 0 && (l.units === 0 || d.length < 5)) { opmerkingen.push(l); continue; }
    producten.push(l);
  }
  const newLines = [...producten, ...Object.values(montageMap)];
  if (tahomaLine) newLines.push(tahomaLine);
  newLines.push(...opmerkingen);
  if (newLines.length !== lines.length) changed = true;
  else for (let i = 0; i < lines.length; i++) {
    if (lines[i].description?.split('\n')[0] !== newLines[i].description?.split('\n')[0] ||
        lines[i].units !== newLines[i].units || lines[i].pricePerUnit !== newLines[i].pricePerUnit) {
      changed = true; break;
    }
  }
  return { newLines, changed };
}

// Self-check: verifieer resultaat VOOR opslaan
function selfCheck(origLines, newLines) {
  const errors = [];
  // Product prijzen ongewijzigd
  const origProductPrices = origLines.filter(l => {
    const d = (l.description?.split('\n')[0] || '').toLowerCase();
    return !d.includes('montage') && !d.includes('inmeten') && !d.includes('tahoma') && l.pricePerUnit > 0;
  }).map(l => l.pricePerUnit).sort((a, b) => a - b);
  const newProductPrices = newLines.filter(l => {
    const d = (l.description?.split('\n')[0] || '').toLowerCase();
    return !d.includes('montage') && !d.includes('inmeten') && !d.includes('tahoma') && l.pricePerUnit > 0;
  }).map(l => l.pricePerUnit).sort((a, b) => a - b);
  if (origProductPrices.join(',') !== newProductPrices.join(',')) {
    errors.push('Product prijzen gewijzigd! orig: ' + origProductPrices.join(',') + ' nieuw: ' + newProductPrices.join(','));
  }
  // Tahoma max 1
  const tc = newLines.filter(l => l.description?.toLowerCase().includes('tahoma')).length;
  if (tc > 1) errors.push('Tahoma ' + tc + 'x');
  // Montage niet samengevoegd
  const mg = {};
  newLines.forEach(l => {
    const d = l.description?.split('\n')[0] || '';
    if (d.toLowerCase().includes('montage') || d.toLowerCase().includes('inmeten')) {
      const k = d + '|' + l.pricePerUnit; mg[k] = (mg[k] || 0) + 1;
    }
  });
  for (const [k, c] of Object.entries(mg)) { if (c > 1) errors.push('Montage niet samengevoegd'); }
  return errors;
}

// ============ VERKOOPTEKSTEN (ENHANCE) ============

function extractField(desc, field) {
  const m = desc.match(new RegExp(field + ':\\s*([^\\n]+)', 'i'));
  return m ? m[1].trim() : '';
}

// Enhance strategie: behoud originele specs, verbeter alleen titel + voeg "Wat u krijgt" toe
function enhanceProduct(desc, newTitle, watUKrijgt) {
  let lines = desc.split('\n');
  // Vervang eerste regel met verbeterde titel
  lines[0] = newTitle;
  // Verwijder lege veldregels (bv "Hoogte: " zonder waarde)
  lines = lines.filter(l => {
    const trimmed = l.trim();
    if (/^[A-Za-z\/ ]+:\s*$/.test(trimmed)) return false; // "Veld: " zonder waarde
    return true;
  });
  // Verwijder bestaande "Wat u krijgt" blok als die er al is (idempotent)
  const wukIdx = lines.findIndex(l => l.trim().startsWith('Wat u krijgt'));
  if (wukIdx >= 0) {
    const garIdx = lines.findIndex((l, i) => i > wukIdx && l.trim().startsWith('Garantie'));
    lines.splice(wukIdx, garIdx >= 0 ? garIdx - wukIdx : lines.length - wukIdx);
  }
  // Verbeter garantie tekst
  const gi = lines.findIndex(l => l.trim().startsWith('Garantie'));
  if (gi >= 0) {
    const endG = lines.length;
    lines.splice(gi, endG - gi,
      'Garantie:',
      '- 5 jaar volledige productgarantie',
      '- 7 jaar motorgarantie (Somfy, Europees marktleider)'
    );
  }
  // Voeg "Wat u krijgt" toe vóór Garantie
  const gi2 = lines.findIndex(l => l.trim().startsWith('Garantie'));
  const insertAt = gi2 >= 0 ? gi2 : lines.length;
  lines.splice(insertAt, 0, '', 'Wat u krijgt:', ...watUKrijgt, '');
  return lines.join('\n');
}

function enhanceRolluik(desc) {
  const bediening = extractField(desc, 'Bediening');
  const motor = extractField(desc, 'Motor');
  const lamel = extractField(desc, 'Lamel');
  const isSolar = bediening.toLowerCase().includes('solar') || motor.toLowerCase().includes('solar');
  const title = 'Rolluik (RollSUPER) — Aluminium rolluik' + (isSolar ? ' op zonne-energie' : '');
  const wuk = [];
  if (lamel) wuk.push('- Aluminium rolluik met ' + lamel.split(',')[0] + ' lamellen');
  if (isSolar) wuk.push('- Op zonne-energie: geen bekabeling nodig, volledig draadloos');
  wuk.push('- Bescherming tegen zon, warmte, kou en inbraak');
  wuk.push('- Isolerend effect: houdt warmte binnen in de winter, buiten in de zomer');
  wuk.push('- Bediening via afstandsbediening' + (isSolar ? ' (Somfy IO solar)' : ''));
  return enhanceProduct(desc, title, wuk);
}

function enhanceSuneye(desc) {
  const breedte = extractField(desc, 'Breedte');
  const isVoorraad = desc.toLowerCase().includes('voorraad');
  const naam = desc.split('\n')[0].split(' — ')[0]; // originele productnaam zonder eerdere enhance
  const title = naam + ' — Knikarmscherm zonwering';
  const wuk = ['- Knikarmscherm van Sunmaster (premium dealer-kwaliteit)'];
  if (isVoorraad) wuk.push('- Direct leverbaar uit voorraad: snellere levertijd');
  if (breedte) wuk.push('- ' + breedte.replace(' mm', '') + ' mm breed: ruime zonwering');
  wuk.push('- Motor met afstandsbediening: in- en uitrollen met een druk op de knop');
  wuk.push('- Compact cassette: het doek is beschermd als het scherm is ingerold');
  return enhanceProduct(desc, title, wuk);
}

function enhancePergola(desc) {
  const breedte = extractField(desc, 'Breedte');
  const uitval = extractField(desc, 'Uitval');
  const brMM = parseInt(breedte) || 0, uitMM = parseInt(uitval) || 0;
  const title = 'Pergola 165 zip — Terrasoverkapping met waterdicht doek';
  const wuk = [
    '- Terrasoverkapping met waterdicht doek: beschermd tegen zon en regen',
    '- Uw terras het hele jaar door bruikbaar, ongeacht het weer',
  ];
  if (brMM > 0 && uitMM > 0) wuk.push('- ' + (brMM/1000).toFixed(1).replace('.0','') + ' x ' + (uitMM/1000).toFixed(1).replace('.0','') + ' meter: volledige overkapping');
  wuk.push('- Gemotoriseerd: doek in- en uitrollen met afstandsbediening');
  wuk.push('- Aluminium frame: duurzaam, onderhoudsarm en stijlvol');
  return enhanceProduct(desc, title, wuk);
}

function enhanceZipDesign(desc) {
  const onderlat = extractField(desc, 'Onderlat');
  const naam = desc.split('\n')[0].split(' — ')[0];
  const title = naam + ' — Windvaste screen zonwering';
  const wuk = [
    '- Windvaste screen dankzij zip-technologie (ritsgeleidingssysteem)',
    '- Bescherming tegen zon, warmte en inkijk',
  ];
  if (onderlat) wuk.push('- Strakke uitstraling met ' + onderlat.toLowerCase() + ' onderlat');
  wuk.push('- Motor met afstandsbediening: bedienen vanaf de bank');
  return enhanceProduct(desc, title, wuk);
}

function enhanceMontage(desc, cat) {
  const fl = desc.split('\n')[0];
  if (cat === 'rolluik') return fl + '\n- Professionele montage door ons eigen montageteam\n- Inclusief inmeetafspraak bij u thuis\n- Klein materiaal en bevestiging\n- Motor afstellen en bediening uitleggen\n- Verwerken verpakkingsmateriaal';
  if (cat === 'knikarmscherm') {
    const zonderUitbouw = desc.toLowerCase().includes('zonder uitbouw');
    return fl + '\n- Professionele montage door ons eigen montageteam\n' + (zonderUitbouw ? '- Montage d.m.v. chemisch anker (zonder uitbouw)\n' : '') + '- Inclusief inmeetafspraak bij u thuis\n- Elektra netjes afwerken\n- Klein materiaal en bevestiging\n- Zonwering afstellen en bediening uitleggen\n- Verwerken verpakkingsmateriaal';
  }
  if (cat === 'pergola') return fl + '\n- Professionele montage door ons eigen montageteam\n- Inclusief inmeetafspraak bij u thuis\n- Volledige plaatsing en constructie\n- Elektra afwerken en aansluiten\n- Klein materiaal en bevestiging\n- Afstellen en testen\n- Bediening uitleggen\n- Verwerken verpakkingsmateriaal';
  if (cat === 'screen') return fl + '\n- Professionele montage door ons eigen montageteam\n- Inclusief inmeetafspraak bij u thuis\n- Klein materiaal en bevestiging\n- Motor afstellen en bediening uitleggen\n- Verwerken verpakkingsmateriaal';
  if (cat === 'serre') return fl + '\n- Professionele montage door ons eigen montageteam\n- Inclusief inmeetafspraak bij u thuis\n- Klein materiaal en bevestiging\n- Afstellen en bediening uitleggen\n- Verwerken verpakkingsmateriaal';
  if (cat === 'uitvalscherm') return fl + '\n- Professionele montage door ons eigen montageteam\n- Inclusief inmeetafspraak bij u thuis\n- Klein materiaal en bevestiging\n- Zonwering afstellen en bediening uitleggen\n- Verwerken verpakkingsmateriaal';
  return desc;
}

function enhanceTahoma(desc) {
  return 'Tahoma Switch — Smart home bediening\n- Automatiseer al uw Somfy zonwering vanuit één app\n- Bedien uw zonwering waar u ook bent\n- Stel automatische scenario\'s in (bijv. sluiten bij zonsondergang)\n- Koppel met andere smart home systemen (Philips Hue, Google Home)\n- Inclusief installatie en persoonlijke uitleg';
}

function enhanceEolis(desc) {
  return 'Eolis 3D Windsensor IO — Automatische windbeveiliging\n- Uw zonwering rolt automatisch in bij harde wind\n- Beschermt uw zonwering tegen stormschade\n- Ingebouwd in de voorlijst: volledig onzichtbaar\n- Werkt draadloos samen met uw Somfy motor';
}

function enhanceAllDescriptions(lines) {
  let changed = false;
  let lastCat = null;
  for (let i = 0; i < lines.length; i++) {
    const fl = (lines[i].description?.split('\n')[0] || '').toLowerCase();
    const orig = lines[i].description;
    // Skip non-product lines voor categorie detectie
    if (fl.includes('montage') || fl.includes('inmeten') || fl.includes('tahoma') || fl.includes('eolis') || fl.includes('connectivity')) {
      // Montage/accessoire — enhance maar raak lastCat niet aan
      if ((fl.includes('montage') || fl.includes('inmeten')) && lastCat) {
        lines[i].description = enhanceMontage(lines[i].description, lastCat);
      } else if (fl.includes('tahoma')) {
        lines[i].description = enhanceTahoma(lines[i].description);
      } else if (fl.includes('eolis')) {
        lines[i].description = enhanceEolis(lines[i].description);
      }
    } else if (lines[i].pricePerUnit > 0) {
      // Product — detecteer categorie (zelfde logica als getCategory)
      if (fl.includes('rolluik')) {
        lines[i].description = enhanceRolluik(lines[i].description);
        lastCat = 'rolluik';
      } else if (fl.includes('suneye') || fl.includes('sunbasic') || fl.includes('knikarm')) {
        lines[i].description = enhanceSuneye(lines[i].description);
        lastCat = 'knikarmscherm';
      } else if (fl.includes('pergola')) {
        lines[i].description = enhancePergola(lines[i].description);
        lastCat = 'pergola';
      } else if (fl.includes('zip design') || fl.includes('sunelite') || fl.includes('square') || fl.includes('zipscreen')) {
        lines[i].description = enhanceZipDesign(lines[i].description);
        lastCat = 'screen';
      } else if (fl.includes('sunproject') || fl.includes('suncube')) {
        // Uitvalscherm — nog geen enhance functie, maar track categorie
        lastCat = 'uitvalscherm';
      } else if (fl.includes('suncontrol') || fl.includes('serre')) {
        // Serre — nog geen enhance functie, maar track categorie
        lastCat = 'serre';
      }
    }
    if (lines[i].description !== orig) changed = true;
  }
  return changed;
}

// ============ SHEET ============

const AFKOMST_MAP = { 'social media': 'Instagram', 'google': 'Google', 'bekende': 'Bekenden', 'buren': 'Buren', 'anders': 'Anders', 'bestaande klant': 'Bestaande klant' };

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
    if (d.includes('plisse') || d.includes('gordijn') || d.includes('jaloezie')) return 'Raamdeco binnen';
  }
  return '';
}

// ============ MAIN ============

async function main() {
  const now = new Date();
  if (false) {
    console.log('[' + now.toISOString().substring(11, 19) + '] Buiten kantooruren, skip');
    return;
  }
  console.log('[' + now.toISOString().substring(11, 19) + '] Offerte controle v3 start');

  const sevenDaysAgo = Date.now() - 7 * 86400000;
  const itemsData = await rpGet('/contact-service/' + PID + '/backlogs/' + BACKLOG_ID + '/items');
  const ocItems = (itemsData?.items || []).filter(i =>
    i.status_id === OC_STATUS && i.timestamp_created > sevenDaysAgo &&
    !i.technical_labels?.some(l => l.type === 'ITEM_ARCHIVED')
  );

  console.log('OC items:', ocItems.length);
  let okCount = 0, fixCount = 0, routeCount = 0, errorCount = 0;

  for (const item of ocItems) {
    const lcId = item.item_subject?.id;
    if (!lcId) continue;
    const docInfo = await getDocForItem(lcId);
    if (!docInfo) continue;
    const fullData = await getFullDoc(docInfo.documentId);
    if (!fullData?.quotationData) continue;

    const qd = fullData.quotationData;
    const plg = qd.segments?.defaultTemplatePriceLineGroup;
    if (!plg?.data?.lines) continue;

    const lines = plg.data.lines;
    const origLines = JSON.parse(JSON.stringify(lines)); // backup voor self-check

    // Persistente backup naar disk (voor herstel bij fouten)
    const backupDir = path.join(__dirname, '../data/offerte-backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const backupFile = path.join(backupDir, docInfo.quotationNumber + '.json');
    if (!fs.existsSync(backupFile)) {
      fs.writeFileSync(backupFile, JSON.stringify({ quotationNumber: docInfo.quotationNumber, documentId: docInfo.documentId, name: item.summary, timestamp: new Date().toISOString(), lines: origLines }, null, 2));
    }
    const desc = item.description || '';
    const email = desc.match(/E-mailadres:\s*([^\n]+)/i)?.[1]?.trim() || item.fields?.email || '';
    const city = desc.match(/Plaats:\s*([^\n]+)/i)?.[1]?.trim() || '';
    const opmerking = desc.match(/Opmerking:\s*([\s\S]*?)(?=\n\d+x |\n*$)/i)?.[1]?.trim() || '';
    const hasToevoegingen = opmerking.toLowerCase().includes('toevoeg') || opmerking.toLowerCase().includes('aanpass') || desc.includes('TOEVOEGEN');
    const isMarkies = lines.some(l => l.description?.toLowerCase().includes('markies'));
    const isGordijn = lines.some(l => l.description?.toLowerCase().includes('gordijn') || (l.description?.toLowerCase().includes('plisse') && !l.description?.toLowerCase().includes('zip')));

    // Bedrag berekenen
    const total = lines.reduce((s, l) => s + l.units * l.pricePerUnit, 0);
    const discount = plg.data.groupDiscount?.amount || 0;
    const bedrag = total * (1 - discount / 100);

    // STAP 1: ROUTING
    const teVer = await checkTeVer(city, bedrag);
    if (teVer) {
      if (email) await sendTeVerEmail(item.summary, email);
      await setStatus(item.id, TEVER_STATUS);
      routeCount++; continue;
    }
    if (isGordijn) {
      if (email) await sendGordijnenEmail(item.summary, email);
      await setStatus(item.id, GORDIJNEN_STATUS);
      routeCount++; continue;
    }
    if (isMarkies || hasToevoegingen) {
      await setStatus(item.id, HANDMATIG);
      routeCount++; continue;
    }

    // STAP 2: OFFERTE AANPASSEN (in originele volgorde!)
    let changed = false;

    // 2a. Voorraadscherm korting
    const isVoorraad = lines.some(l => (l.description?.split('\n')[0]?.toLowerCase() || '').includes('voorraad'));
    if (isVoorraad && plg.data.groupDiscount?.amount !== 20) {
      if (!plg.data.groupDiscount) plg.data.groupDiscount = {};
      plg.data.groupDiscount.amount = 20;
      plg.data.groupDiscount.name = '20% korting voorraad scherm';
      changed = true;
    }

    // 2b. Product omschrijving + montage prijs (in originele volgorde)
    let lastCat = null, lastBed = null;
    for (let i = 0; i < lines.length; i++) {
      const firstLine = lines[i].description?.split('\n')[0] || '';
      const bediening = lines[i].description?.match(/Bediening:\s*([^\n]+)/i)?.[1]?.trim() || '';
      const motor = lines[i].description?.match(/Motor:\s*([^\n]+)/i)?.[1]?.trim() || '';
      const cat = getCategory(firstLine);

      if (cat && lines[i].pricePerUnit > 0) {
        lastCat = cat;
        lastBed = getBedType(bediening, motor);
        // Transform product omschrijving
        const newDesc = transformProductDesc(lines[i].description, lastCat, lastBed);
        if (newDesc !== lines[i].description) { lines[i].description = newDesc; changed = true; }
        continue;
      }

      const d = firstLine.toLowerCase();
      if ((d.includes('montage') || d.includes('inmeten')) && lastCat) {
        // Montage prijs aanpassen (behoudt originele titel + bullets)
        if (adjustMontageInPlace(lines[i], lastCat, lastBed)) changed = true;
        continue;
      }
    }

    // STAP 2c: VERKOOPTEKSTEN (optioneel)
    if (ENHANCE_DESCRIPTIONS) {
      if (enhanceAllDescriptions(lines)) changed = true;
    }

    // STAP 2d: TITELS BOLD MAKEN (**)
    for (const l of lines) {
      const firstLine = l.description?.split('\n')[0] || '';
      if (!firstLine.startsWith('**') && l.pricePerUnit > 0) {
        const clean = firstLine.replace(/^\*\*|\*\*$/g, '');
        l.description = '**' + clean + '**' + l.description.substring(firstLine.length);
        changed = true;
      }
    }

    // STAP 3: HERORDENEN
    const { newLines, changed: reorderChanged } = reorderAndMerge(lines);
    if (reorderChanged) changed = true;

    // STAP 4: SELF-CHECK
    const errors = selfCheck(origLines, newLines);
    if (errors.length > 0) {
      console.log('⚠️ SELF-CHECK FAIL #' + docInfo.quotationNumber + ' ' + item.summary + ': ' + errors.join(', '));
      await sendTelegram('⚠️ Self-check fail: #' + docInfo.quotationNumber + ' ' + item.summary + '\n' + errors.join('\n'));
      errorCount++; continue;
    }

    // STAP 5: OPSLAAN + STATUS
    if (changed) {
      plg.data.lines = newLines;
      if (!await saveDoc(docInfo.documentId, qd)) { errorCount++; continue; }
      fixCount++;
    } else {
      okCount++;
    }
    await setStatus(item.id, GECONTROLEERD);
  }

  console.log('Stap 1 klaar: OK:' + okCount + ' Fixed:' + fixCount + ' Routed:' + routeCount + ' Errors:' + errorCount);

  // SHEET BIJWERKEN
  const gcItemsData = await rpGet('/contact-service/' + PID + '/backlogs/' + BACKLOG_ID + '/items');
  const gcItems = (gcItemsData?.items || []).filter(i =>
    (i.status_id === GECONTROLEERD || i.status_id === TEVER_STATUS || i.status_id === GORDIJNEN_STATUS) && i.timestamp_created > sevenDaysAgo &&
    !i.technical_labels?.some(l => l.type === 'ITEM_ARCHIVED')
  );

  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, '../data/google-service-account.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const MAAND_NAMEN = ['Jan', 'Feb', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
  const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const bestaandeTabs = sheetMeta.data.sheets.map(s => ({ title: s.properties.title, id: s.properties.sheetId }));

  const perMaand = {};
  let teVerSheetCount = 0;

  for (const item of gcItems) {
    const lcId = item.item_subject?.id;
    if (!lcId) continue;
    const docInfo = await getDocForItem(lcId);
    const desc = item.description || '';
    const afkomstRaw = desc.match(/Hoe komt u bij ons terecht\?:\s*([^\n]+)/i)?.[1]?.trim()?.toLowerCase() || '';
    const afkomst = AFKOMST_MAP[afkomstRaw] || afkomstRaw || '';
    const city = desc.match(/Plaats:\s*([^\n]+)/i)?.[1]?.trim() || '';
    const phone = (item.fields?.phone || '').replace(/^\+/, '');

    let bedrag = 0, productCat = '', offerteNr = docInfo?.quotationNumber || '';
    if (docInfo) {
      const fullData = await getFullDoc(docInfo.documentId);
      if (fullData?.quotationData) {
        const plg = fullData.quotationData.segments?.defaultTemplatePriceLineGroup;
        if (plg?.data?.lines) {
          const total = plg.data.lines.reduce((s, l) => s + l.units * l.pricePerUnit, 0);
          const disc = plg.data.groupDiscount?.amount || 0;
          bedrag = total * (1 - disc / 100);
          productCat = mapProductCategory(plg.data.lines);
        }
      }
    }

    const teVer = item.status_id === TEVER_STATUS;
    if (teVer) teVerSheetCount++;

    const d = new Date(item.timestamp_created);
    const datum = d.getDate() + '-' + (d.getMonth() + 1) + '-' + String(d.getFullYear()).slice(-2);
    const tabNaam = MAAND_NAMEN[d.getMonth()] + ' ' + d.getFullYear();
    const bedragStr = teVer ? 'TE VER' : (bedrag > 0 ? ('€ ' + bedrag.toFixed(2).replace('.', ',')) : '');

    if (!perMaand[tabNaam]) perMaand[tabNaam] = [];
    perMaand[tabNaam].push([datum, item.summary.split(' ')[0], item.summary.split(' ').slice(1).join(' '),
      city, phone, bedragStr, offerteNr, '', 'Online', afkomst, 'Prive', productCat]);
  }

  let sheetRows = 0;
  for (const [tabNaam, rows] of Object.entries(perMaand)) {
    rows.sort((a, b) => (parseInt(a[6]) || 0) - (parseInt(b[6]) || 0));
    const tab = bestaandeTabs.find(t => t.title === tabNaam);
    if (!tab) {
      await sendTelegram('Tab "' + tabNaam + '" bestaat niet. Maak deze aan.');
      continue;
    }
    // Dedup op offerte nummer
    const existRes = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: tabNaam + '!G4:G2000' });
    const existingNrs = new Set((existRes.data.values || []).map(r => r[0]).filter(Boolean));
    const newRows = rows.filter(r => !existingNrs.has(r[6]));
    if (newRows.length === 0) continue;

    const fullRes = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: tabNaam + '!A4:A2000' });
    let lastRow = 3;
    for (let i = (fullRes.data.values || []).length - 1; i >= 0; i--) {
      if ((fullRes.data.values || [])[i][0]?.trim()) { lastRow = i + 4; break; }
    }
    const startRow = lastRow + 1;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID, range: tabNaam + '!A' + startRow + ':L' + (startRow + newRows.length - 1),
      valueInputOption: 'USER_ENTERED', requestBody: { values: newRows },
    });
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID, requestBody: { requests: [{ repeatCell: {
        range: { sheetId: tab.id, startRowIndex: startRow - 1, endRowIndex: startRow - 1 + newRows.length, startColumnIndex: 0, endColumnIndex: 12 },
        cell: { userEnteredFormat: { backgroundColor: { red: 1, green: 1, blue: 0 } } },
        fields: 'userEnteredFormat.backgroundColor',
      }}]},
    });
    sheetRows += newRows.length;
  }

  console.log('Sheet: ' + sheetRows + ' rijen, ' + teVerSheetCount + ' TE VER');

  if (ocItems.length > 0) {
    await sendTelegram('Offerte controle v3: ' + okCount + ' OK, ' + fixCount + ' aangepast, ' + routeCount + ' gerouted, ' + errorCount + ' errors\nSheet: ' + sheetRows + ' rijen');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
