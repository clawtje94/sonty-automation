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
const ENHANCE_DESCRIPTIONS = true; // Goedgekeurde teksten (test offerte #20266838, 2026-06-10)

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
  if (d.includes('zip design') || d.includes('square') || d.includes('zipscreen')) return 'screen';
  if (d.includes('sunproject') || d.includes('suncube')) return 'uitvalscherm';
  if (d.includes('suneye') || d.includes('sunbasic') || d.includes('sunelite') || d.includes('knikarm')) return 'knikarmscherm';
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

// ============ VERKOOPTEKSTEN (ENHANCE) — goedgekeurd door Daimy 2026-06-10 (test offerte #20266838) ============
// REGELS: productnaam NOOIT aanpassen, originele velden NOOIT verwijderen, alleen "Waarom" blok toevoegen

const WAAROM_SONTY_TEXT = '**Waarom Sonty?**\n\n- Sunmaster Premium Dealer: wij leveren uitsluitend A-merk zonwering van de hoogste kwaliteit\n- Eigen montageteam: al onze monteurs zijn in dienst, geen onderaannemers\n- Persoonlijk advies: gratis inmeetafspraak bij u thuis\n- 3000+ tevreden klanten\n- 4.9/5.0 op Google met 500+ reviews\n- Alles uit eigen hand: van advies tot montage en nazorg';

function extractField(desc, field) {
  const m = desc.match(new RegExp(field + ':\\s*([^\\n]+)', 'i'));
  return m ? m[1].trim() : '';
}

// Goedgekeurde "Waarom dit product" blokken per categorie + variant
function getWaaromBlock(firstLine, cat, bedType) {
  const fl = firstLine.toLowerCase();
  const isSolar = bedType === 'solar';
  const isDraai = bedType === 'draaischakelaar';
  const isHand = bedType === 'handbediend';

  if (cat === 'rolluik') {
    const b = ['Waarom dit rolluik:',
      '- Sunmaster RollSUPER: premium kwaliteit, Nederlands geproduceerd',
      '- Dubbelwandige aluminium lamellen met PU-schuim voor isolatie'];
    if (isSolar) b.push('- Op zonne-energie: geen bekabeling nodig, volledig draadloos', '- Geen elektricien nodig: bespaart op installatiekosten');
    else if (isDraai) b.push('- Somfy motor met vaste draaischakelaar op de muur');
    else b.push('- Fluisterstille Somfy motor met afstandsbediening');
    b.push('- Bescherming tegen inbraak, zon, warmte en kou');
    return b;
  }
  if (cat === 'screen') {
    const b = ['Waarom dit screen:',
      '- Sunmaster screen: premium kwaliteit met zip-technologie',
      '- Ritsgeleidingssysteem: doek zit vast in de geleiders, geen klapperen bij wind'];
    if (isSolar) b.push('- Op zonne-energie: geen bekabeling nodig, volledig draadloos');
    else if (isDraai) b.push('- Somfy motor met vaste draaischakelaar op de muur');
    else b.push('- Fluisterstille Somfy motor met afstandsbediening');
    b.push('- Bescherming tegen zon, warmte en inkijk met behoud van uitzicht');
    b.push('- Compacte cassette: doek en motor beschermd tegen weersinvloeden');
    return b;
  }
  if (cat === 'knikarmscherm') {
    const b = ['Waarom dit knikarmscherm:'];
    if (fl.includes('sunelite')) {
      b.push('- Sunmaster Sunelite: knikarmscherm uit het hoogste segment');
      b.push('- Volledig gesloten cassette: doek en mechaniek maximaal beschermd');
    } else if (fl.includes('suneye')) {
      b.push('- Sunmaster Suneye: premium knikarmscherm met gesloten cassette');
      if (fl.includes('voorraad')) b.push('- Direct leverbaar uit voorraad: snellere levertijd dan maatwerk');
      b.push('- Gesloten cassette: doek en mechaniek volledig beschermd');
    } else {
      b.push('- Sunmaster knikarmscherm: premium kwaliteit, Nederlands geproduceerd');
    }
    b.push('- Sterke aluminium armen: lang meegaand en stabiel');
    if (isHand) b.push('- Bediening via slingerstang aan de buitenzijde', '- Geen motor of elektra nodig: eenvoudige installatie');
    else if (isDraai) b.push('- Somfy motor met vaste draaischakelaar op de muur');
    else b.push('- Fluisterstille Somfy motor met afstandsbediening');
    return b;
  }
  if (cat === 'uitvalscherm') {
    const b = ['Waarom dit uitvalscherm:',
      '- Sunmaster uitvalscherm: compact en stijlvol'];
    if (isHand) b.push('- Bediening via slingerstang aan de buitenzijde', '- Geen motor of elektra nodig');
    else if (isSolar) b.push('- Op zonne-energie: geen bekabeling nodig, volledig draadloos');
    else if (isDraai) b.push('- Somfy motor met vaste draaischakelaar op de muur');
    else b.push('- Fluisterstille Somfy motor met afstandsbediening');
    b.push('- Bescherming tegen directe zonnestraling en warmte');
    return b;
  }
  if (cat === 'pergola') {
    return ['Waarom deze pergola:',
      '- Sunmaster Pergola: terrasoverkapping met waterdicht doek',
      '- Beschermd tegen zon en regen: uw terras het hele jaar bruikbaar',
      '- Stevig aluminium frame: duurzaam en onderhoudsarm',
      '- Gemotoriseerd: doek in- en uitrollen met afstandsbediening'];
  }
  if (cat === 'serre') {
    return ['Waarom deze serre zonwering:',
      '- Sunmaster Suncontrol: speciaal ontworpen voor glazen daken en serres',
      '- Houdt warmte buiten: aangenaam klimaat in uw serre',
      '- Stevig aluminium frame met strakke afwerking',
      '- Fluisterstille Somfy motor met afstandsbediening'];
  }
  return null;
}

// Voeg Waarom blok toe aan product description — origineel blijft volledig intact
function insertWaaromBlock(desc, waaromLines) {
  let lines = desc.split('\n');
  // Verwijder bestaand Waarom/Wat u krijgt blok (idempotent)
  const oldIdx = lines.findIndex(l => /^Waarom (dit|deze) .+:$/.test(l.trim()) || l.trim().startsWith('Wat u krijgt'));
  if (oldIdx >= 0) {
    const garIdx = lines.findIndex((l, i) => i > oldIdx && l.trim().startsWith('Garantie'));
    lines.splice(oldIdx, garIdx >= 0 ? garIdx - oldIdx : lines.length - oldIdx);
  }
  // Voeg Waarom blok toe vóór Garantie (of aan het einde)
  const gi = lines.findIndex(l => l.trim().startsWith('Garantie'));
  const insertAt = gi >= 0 ? gi : lines.length;
  // Zorg voor lege regel ervoor
  const block = ['', ...waaromLines, ''];
  lines.splice(insertAt, 0, ...block);
  // Dubbele lege regels opruimen
  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

function enhanceTahoma(desc) {
  const title = desc.split('\n')[0].replace(/^\*\*|\*\*$/g, '');
  return title + '\n- Automatiseren van je Somfy producten\n- Producten bedienen waar je ook bent met de telefoon\n- Inclusief installatie en uitleg\n- Al uw smart home producten op 1 app (zoals Philips Hue)';
}

function enhanceEolis(desc) {
  const title = desc.split('\n')[0].replace(/^\*\*|\*\*$/g, '');
  return title + '\n- Automatische windbeveiliging\n- Zonwering rolt automatisch in bij harde wind\n- Ingebouwd in de voorlijst\n- Werkt draadloos samen met uw Somfy motor';
}

function enhanceAllDescriptions(lines) {
  let changed = false;
  for (let i = 0; i < lines.length; i++) {
    const fl = (lines[i].description?.split('\n')[0] || '').replace(/^\*\*|\*\*$/g, '').toLowerCase();
    const orig = lines[i].description;
    if (fl.includes('montage') || fl.includes('inmeten')) {
      // Montage: NIET aanpassen (originele bullets behouden)
      continue;
    } else if (fl.includes('tahoma')) {
      lines[i].description = enhanceTahoma(lines[i].description);
    } else if (fl.includes('eolis')) {
      lines[i].description = enhanceEolis(lines[i].description);
    } else if (fl.includes('connectivity')) {
      continue;
    } else if (lines[i].pricePerUnit > 0) {
      const cat = getCategory(fl);
      if (cat) {
        const bediening = extractField(lines[i].description, 'Bediening');
        const motor = extractField(lines[i].description, 'Motor');
        const bedType = getBedType(bediening, motor);
        const waarom = getWaaromBlock(fl, cat, bedType);
        if (waarom) {
          lines[i].description = insertWaaromBlock(lines[i].description, waarom);
        }
      }
    }
    if (lines[i].description !== orig) changed = true;
  }
  return changed;
}

// "Waarom Sonty" tekstblok 1x onderaan het document (via renderRows)
function addWaaromSontyBlock(qd) {
  // Check of het al bestaat (idempotent)
  for (const seg of Object.values(qd.segments || {})) {
    if (seg?.type === 'text' && typeof seg.data === 'string' && seg.data.includes('Waarom Sonty')) return false;
  }
  const textId = require('crypto').randomUUID();
  qd.segments[textId] = { type: 'text', data: WAAROM_SONTY_TEXT };
  const sigIdx = (qd.renderRows || []).findIndex(r => r.columns?.some(c => c.elements?.some(e => e.type === 'signature' || e.type === 'userDecline')));
  const insertAt = sigIdx >= 0 ? sigIdx : qd.renderRows.length;
  qd.renderRows.splice(insertAt, 0,
    { delegateMargins: false, widths: [100], columns: [{ elements: [{ type: 'empty', target: '2lh' }] }] },
    { delegateMargins: false, widths: [100], columns: [{ elements: [{ type: 'text', target: textId }] }] },
    { delegateMargins: false, widths: [100], columns: [{ elements: [{ type: 'empty', target: '2lh' }] }] }
  );
  return true;
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
    if (d.includes('zip design') || d.includes('sunproject') || d.includes('suncube') || d.includes('square') || d.includes('suncontrol') || d.includes('zipscreen')) return 'Screens';
    if (d.includes('sunelite')) return 'Knikarmscherm';
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
  if (now.getDay() === 0 || now.getHours() < 9 || now.getHours() >= 18) {
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
    const isGordijn = lines.some(l => l.description?.toLowerCase().includes('gordijn') || (l.description?.toLowerCase().includes('plisse') && !l.description?.toLowerCase().includes('zip')))
      || desc.toLowerCase().includes('gordijn') || (desc.toLowerCase().includes('pliss') && !desc.toLowerCase().includes('zip'));

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

    // STAP 4b: WAAROM SONTY TEKSTBLOK (1x onderaan document)
    if (ENHANCE_DESCRIPTIONS) {
      if (addWaaromSontyBlock(qd)) changed = true;
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
