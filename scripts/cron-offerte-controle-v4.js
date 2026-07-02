#!/usr/bin/env node
/**
 * Offerte controle v4 — CONCEPT (test)
 *
 * Uitbreiding op v3:
 * - Upgrade/downgrade opties per product IN de productbeschrijving
 * - Correcte cassette/geleiding/onderlat/type info per product
 * - RAL kleur met (standaard) of (niet standaard)
 * - Bediening + Handzender op aparte regels
 * - Prijzen uit lokaal JSON bestand (data/sunmaster-prices-2026.json)
 * - "je" taal, niet "u"
 *
 * NIET in v4 (blijft in v3): routing, TE VER, sheet, status changes, Waarom Sonty
 * Dit script doet ALLEEN de upgrade/downgrade toevoeging op bestaande offertes.
 *
 * Test: node scripts/cron-offerte-controle-v4.js --dry-run [quotationNumber]
 *       node scripts/cron-offerte-controle-v4.js --apply [quotationNumber]
 */

const fs = require('fs');
const path = require('path');

const RP_API_KEY = 'reuzenpanda_cpat_WMD2KmDRune53bj7.d0_ls8loPpAjb2TrSNOS_Xd_QLdxHq1xwOC9pyyJado';
const PID = '731483fa-ef6b-4aae-afcf-883ec09219dd';
const BACKLOG_ID = 'e9d5462b-0f3e-43b5-ba60-d61a1ca4f0d7';
const TG_TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
const MARKUP = 1.10;

// Prijzen laden
const PRICES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'sunmaster-prices-2026.json'), 'utf8'));

// ============ API HELPERS ============

async function fetchRetry(url, options, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try { return await fetch(url, options); }
    catch (e) {
      if (i === tries) throw e;
      console.log('  (retry ' + (i+1) + '/' + tries + ': ' + (e.cause?.code || e.message) + ')');
      await new Promise(r => setTimeout(r, i * 5000));
    }
  }
}

async function rpGet(ep) {
  const res = await fetchRetry('https://backend.reuzenpanda.nl' + ep, { headers: { 'Authorization': 'Bearer ' + RP_API_KEY } });
  if (!res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

async function rpPut(ep, body) {
  const res = await fetchRetry('https://backend.reuzenpanda.nl' + ep, {
    method: 'PUT', headers: { 'Authorization': 'Bearer ' + RP_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.ok;
}

async function sendTelegram(text) {
  await fetch('https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: 1700128390, text: text.substring(0, 4000) }),
  }).catch(() => {});
}

// ============ PRODUCT DETECTIE ============

function getProductKey(firstLine) {
  const d = firstLine.toLowerCase();
  // Knikarmschermen
  if (d.includes('sunelite')) return 'sunelite';
  if (d.includes('suneye') && d.includes('xl')) return 'suneyeXL';
  if (d.includes('suneye')) return 'suneye';
  if (d.includes('sunbasic') && d.includes('cassette')) return 'sunbasicCassette';
  if (d.includes('sunbasic')) return 'sunbasic';
  if (d.includes('knikarm')) return 'suneye'; // default knikarm
  // Zipscreens
  if (d.includes('zip design') || d.includes('zip design 110')) return 'zipDesign110';
  if (d.includes('zip square') || d.includes('zip carré') || d.includes('zip carre')) return 'zipSquare85100';
  // Screens zonder ZIP
  if (d.includes('screen') || d.includes('square') || d.includes('carré') || d.includes('carre')) {
    if (d.includes('zip')) return 'zipSquare85100';
    return 'screenSquare85100'; // regulier screen
  }
  // Rolluiken
  if (d.includes('rolluik') && d.includes('s-37')) return 'rolluikS37';
  if (d.includes('rolluik') && d.includes('s-42')) return 'rolluikS42';
  if (d.includes('rollsuper') || d.includes('roll super')) return 'rolluikS42'; // RollSUPER = S-42
  if (d.includes('rolluik')) return 'rolluikS42'; // default = S-42 (meest verkocht via RP)
  // Uitvalschermen
  if (d.includes('suncube')) return 'suncube150';
  if (d.includes('sunproject')) return 'sunproject100';
  // Serre/Veranda
  if (d.includes('pergola')) return 'suncontrolPergola';
  if (d.includes('suncontrol') && d.includes('165')) return 'suncontrol165ZIP';
  if (d.includes('suncontrol') && d.includes('150')) return 'suncontrol150';
  if (d.includes('suncontrol') || d.includes('serre') || d.includes('veranda')) return 'suncontrol165ZIP';
  // Voorraadscherm → behandel als screen
  if (d.includes('voorraad')) return 'zipSquare85100';
  return null;
}

function getCategory(key) {
  if (!key) return null;
  if (['sunbasic','sunbasicCassette','suneye','suneyeXL','sunelite'].includes(key)) return 'knikarmscherm';
  if (['zipDesign110','zipSquare85100','screenSquare85100'].includes(key)) return 'screen';
  if (['rolluikS37','rolluikS42'].includes(key)) return 'rolluik';
  if (['suncube150','sunproject100'].includes(key)) return 'uitvalscherm';
  if (['suncontrol150','suncontrol165ZIP','suncontrolPergola'].includes(key)) return 'serre';
  return null;
}

// ============ MAAT EXTRACTIE ============

function extractMaat(desc) {
  const breedte = desc.match(/breedte[:\s]*(\d+[\.,]?\d*)\s*(mm|cm)?/i);
  const hoogte = desc.match(/hoogte[:\s]*(\d+[\.,]?\d*)\s*(mm|cm)?/i);
  // Uitval: match "Uitval: 3000 mm" maar NIET "uitval 115 tot 90°" (dat is doek-spec)
  const uitval = desc.match(/uitval[:\s]*(\d+[\.,]?\d*)\s*(mm|cm)\b/i);
  // Doek: "Doek: 165" of "Doek 165" (geeft doekbreedte in cm, niet een maat)
  const doek = desc.match(/doek[:\s]*(\d{3})\b/i);

  function toCm(val, unit) {
    const n = parseFloat(val.replace(',', '.'));
    return (unit || 'mm').toLowerCase() === 'cm' ? n : n / 10;
  }

  return {
    breedte: breedte ? toCm(breedte[1], breedte[2]) : null,
    hoogte: hoogte ? toCm(hoogte[1], hoogte[2]) : null,
    uitval: uitval ? toCm(uitval[1], uitval[2]) : null,
    doek: doek ? parseInt(doek[1]) : null,
  };
}

function extractKleur(desc) {
  const m = desc.match(/(?:frame\s*kleur|kleur)[:\s]*(RAL\s*\d+|[A-Za-z\s]+?)(?:\s*\(|$|\n)/im);
  return m ? m[1].trim() : null;
}

function extractBediening(desc) {
  const m = desc.match(/bediening[:\s]*([^\n]+)/i);
  return m ? m[1].trim().toLowerCase() : '';
}

// ============ PRIJS LOOKUP ============

// Vind de dichtstbijzijnde waarde in een tabel (rond omhoog)
function findNearest(table, key) {
  const keys = Object.keys(table).map(Number).sort((a,b) => a-b);
  for (const k of keys) {
    if (k >= key) return { key: k, value: table[k] };
  }
  return keys.length > 0 ? { key: keys[keys.length-1], value: table[keys[keys.length-1]] } : null;
}

function lookupPrice(productKey, breedteCm, hoogteCm, uitvalCm) {
  const product = PRICES[productKey];
  if (!product) return null;
  const cat = getCategory(productKey);

  // Knikarmschermen: tables[uitval][breedte]
  if (product.tables && cat === 'knikarmscherm') {
    const uitval = uitvalCm || 300;
    const tbl = product.tables[findNearest(product.tables, uitval)?.key];
    if (!tbl) return null;
    const entry = findNearest(tbl, breedteCm);
    return entry ? entry.value : null;
  }

  // Uitvalschermen: tables[doekbreedte][schermbreedte] — doek default 165
  if (product.tables && cat === 'uitvalscherm') {
    const doek = 165; // standaard doek
    const tbl = product.tables[findNearest(product.tables, doek)?.key];
    if (!tbl) return null;
    const entry = findNearest(tbl, breedteCm);
    return entry ? entry.value : null;
  }

  // Serre/Veranda: tables[uitval][breedte]
  if (product.tables && cat === 'serre') {
    const uitval = uitvalCm || 300;
    const tbl = product.tables[findNearest(product.tables, uitval)?.key];
    if (!tbl) return null;
    const entry = findNearest(tbl, breedteCm);
    return entry ? entry.value : null;
  }

  // Zipscreens: tableLarge[breedte][hoogte] of tableSmall[breedte][hoogte]
  if (product.tableLarge || product.tableSmall) {
    const b = breedteCm;
    const h = hoogteCm || 150;
    // Probeer eerst large, dan small
    for (const tbl of [product.tableLarge, product.tableSmall]) {
      if (!tbl) continue;
      const bEntry = findNearest(tbl, b);
      if (bEntry) {
        const hEntry = findNearest(bEntry.value, h);
        if (hEntry) return hEntry.value;
      }
    }
    return null;
  }

  // Rolluiken/screens: table[breedte][hoogte] (als genest)
  if (product.table) {
    const bEntry = findNearest(product.table, breedteCm);
    if (bEntry && typeof bEntry.value === 'object') {
      const hEntry = findNearest(bEntry.value, hoogteCm || breedteCm);
      if (hEntry) return hEntry.value;
    }
    return null;
  }

  return null;
}

// ============ STANDAARDKLEUR CHECK ============

const STANDAARD_KLEUREN = {
  knikarmscherm: {
    suneye: ['RAL 9010', 'RAL 9001', 'Antraciet structuur', 'Antraciet', 'RAL 9005 structuur', 'RAL 9005'],
    suneyeXL: ['RAL 9010', 'RAL 9001', 'Antraciet structuur', 'Antraciet', 'RAL 9005 structuur', 'RAL 9005'],
    sunelite: ['RAL 9010', 'RAL 9010 mat', 'Antraciet structuur', 'Antraciet'],
    sunbasic: ['RAL 9001', 'Antraciet structuur', 'Antraciet'],
    sunbasicCassette: ['RAL 9001', 'Antraciet structuur', 'Antraciet'],
  },
  screen: {
    zipDesign110: ['RAL 9010', 'RAL 9001', 'Antraciet structuur', 'Antraciet', 'RAL 9005 structuur', 'RAL 9005'],
    zipSquare85100: ['RAL 9010', 'RAL 9001', 'Antraciet structuur', 'Antraciet', 'RAL 9005 structuur', 'RAL 9005'],
  },
  rolluik: {
    rolluikS37: ['RAL 9010', 'Cremewit', 'DB703', 'RAL 9007', 'Quarts grijs', 'RAL 9005', 'RAL 7021', 'Antraciet'],
    rolluikS42: ['RAL 9010', 'Cremewit', 'DB703', 'RAL 9007', 'Quarts grijs', 'RAL 9005', 'RAL 7021', 'Antraciet'],
  },
  serre: {
    suncontrol150: ['Antraciet structuur', 'Antraciet', 'RAL 9010', 'RAL 9010 structuur', 'RAL 9005 structuur', 'RAL 9005', 'RAL 9007 structuur', 'RAL 9007', 'Brons structuur'],
    suncontrol165ZIP: ['Antraciet structuur', 'Antraciet', 'RAL 9010', 'RAL 9010 structuur', 'RAL 9005 structuur', 'RAL 9005', 'RAL 9007 structuur', 'RAL 9007', 'Brons structuur'],
    suncontrolPergola: ['Antraciet structuur', 'Antraciet', 'RAL 9010', 'RAL 9010 structuur', 'RAL 9005 structuur', 'RAL 9005', 'RAL 9007 structuur', 'RAL 9007', 'Brons structuur'],
  },
};

function isStandaardKleur(productKey, kleur) {
  if (!kleur) return true; // onbekend = geen meerprijs tonen
  const cat = getCategory(productKey);
  const kleuren = STANDAARD_KLEUREN[cat]?.[productKey] || [];
  const norm = kleur.toLowerCase().replace(/\s+/g, ' ').trim();
  return kleuren.some(k => norm.includes(k.toLowerCase()));
}

// ============ CASSETTE/TYPE INFO ============

const PRODUCT_INFO = {
  sunbasic: { cassette: 'Geen (open arm)', motor: 'Somfy Sunea IO' },
  sunbasicCassette: { cassette: 'Gesloten', motor: 'Somfy Sunea IO' },
  suneye: { cassette: 'Gesloten, slank design', motor: 'Somfy Sunea IO' },
  suneyeXL: { cassette: 'Gesloten, slank design (extra breed)', motor: 'Somfy Sunea IO' },
  sunelite: { cassette: 'Gesloten, premium design', motor: 'Somfy Sunea IO' },
  zipDesign110: { geleiding: 'ZIP (windvast)', onderlat: 'Geïntegreerd (strak design)', motor: 'Somfy Sunilus IO (17 rpm)' },
  zipSquare85100: { geleiding: 'ZIP (windvast)', onderlat: 'Standaard (los)', motor: 'Somfy Sunilus IO (17 rpm)' },
  screenSquare85100: { geleiding: 'Zijgeleiders (niet windvast)', onderlat: 'Standaard', motor: 'Screenjob LS40' },
  rolluikS37: { kast: '45° afgeschuinde kast (standaard)', profiel: 'S-37 (standaard, tot 300cm)', motor: 'Somfy RS 100 IO (17 rpm)' },
  rolluikS42: { kast: '45° afgeschuinde kast (standaard)', profiel: 'S-42 (breed, tot 400cm)', motor: 'Somfy RS 100 IO (17 rpm)' },
  suncube150: { cassette: 'Gesloten, rond design (150mm)', motor: 'Somfy Sunea IO' },
  sunproject100: { cassette: 'Gesloten, rechthoekig (100mm)', motor: 'Somfy Sunea IO' },
  suncontrol150: { type: 'Onderdak zonwering', motor: 'Somfy Sunea IO' },
  suncontrol165ZIP: { type: 'Onderdak zonwering (windvast ZIP)', motor: 'Somfy Sunea IO' },
  suncontrolPergola: { type: 'Vrijstaande pergola (windvast ZIP)', motor: 'Somfy Sunea IO' },
};

// ============ UPGRADE/DOWNGRADE OPTIES GENEREREN ============

function buildOptionsBlock(productKey, breedteCm, hoogteCm, uitvalCm, bedieningType) {
  const cat = getCategory(productKey);
  if (!cat) return null;

  const currentPrice = lookupPrice(productKey, breedteCm, hoogteCm, uitvalCm);
  if (!currentPrice) return null;

  // Huidige totaalprijs met IO motor + handzender
  const hz = PRICES.handzenderPrijs; // 76

  const lines = [];
  lines.push('');
  lines.push('**Liever een ander model of bediening?**');
  lines.push('');

  // === MODEL ALTERNATIEVEN ===
  const modelAlts = [];

  if (cat === 'knikarmscherm') {
    const alts = { sunbasic: 'SunBasic (open arm, geen cassette)', sunbasicCassette: 'SunBasic Cassette (gesloten, instap)',
      suneye: 'SunEye (gesloten, slank design)', suneyeXL: 'SunEye XL (extra breed, tot 745cm)',
      sunelite: 'SunElite (topmodel, LED mogelijk)' };
    for (const [key, label] of Object.entries(alts)) {
      if (key === productKey) continue;
      const altPrice = lookupPrice(key, breedteCm, hoogteCm, uitvalCm);
      if (altPrice) {
        const diff = Math.round((altPrice - currentPrice) * MARKUP);
        const sign = diff >= 0 ? '+€' : '-€';
        modelAlts.push('• ' + label + ': ' + sign + Math.abs(diff));
      }
    }
  }

  if (cat === 'screen') {
    const alts = { zipDesign110: 'Zip Design 110 (ZIP, geïntegreerde onderlat)',
      zipSquare85100: 'Zip Square 85/100 (ZIP, kleiner profiel)' };
    for (const [key, label] of Object.entries(alts)) {
      if (key === productKey) continue;
      const altPrice = lookupPrice(key, breedteCm, hoogteCm, uitvalCm);
      if (altPrice) {
        const diff = Math.round((altPrice - currentPrice) * MARKUP);
        const sign = diff >= 0 ? '+€' : '-€';
        modelAlts.push('• ' + label + ': ' + sign + Math.abs(diff));
      }
    }
  }

  if (cat === 'rolluik') {
    if (productKey === 'rolluikS37') {
      const altPrice = lookupPrice('rolluikS42', breedteCm, hoogteCm);
      if (altPrice) {
        const diff = Math.round((altPrice - currentPrice) * MARKUP);
        modelAlts.push('• Rolluik S-42 (breder profiel, tot 400cm): +€' + Math.abs(diff));
      }
    } else {
      const altPrice = lookupPrice('rolluikS37', breedteCm, hoogteCm);
      if (altPrice) {
        const diff = Math.round((altPrice - currentPrice) * MARKUP);
        modelAlts.push('• Rolluik S-37 (standaard, tot 300cm): ' + (diff >= 0 ? '+' : '-') + '€' + Math.abs(diff));
      }
    }
  }

  if (cat === 'uitvalscherm') {
    const alts = { suncube150: 'SunCube 150 (rond, premium)', sunproject100: 'SunProject 100 (rechthoekig, breder leverbaar)' };
    for (const [key, label] of Object.entries(alts)) {
      if (key === productKey) continue;
      // Uitvalschermen: breedte lookup, doek = hoogte equivalent
      const altPrice = lookupPrice(key, breedteCm, hoogteCm, uitvalCm);
      if (altPrice) {
        const diff = Math.round((altPrice - currentPrice) * MARKUP);
        const sign = diff >= 0 ? '+€' : '-€';
        modelAlts.push('• ' + label + ': ' + sign + Math.abs(diff));
      }
    }
  }

  if (modelAlts.length > 0) {
    lines.push('Ander model:');
    lines.push(...modelAlts);
    lines.push('');
  }

  // === BEDIENING ALTERNATIEVEN ===
  const bedAlts = [];
  const hasHandzender = bedieningType === 'afstandsbediening' || bedieningType === 'io';

  if (cat === 'knikarmscherm') {
    // Standaard = Sunea IO in tabel. Handzender apart.
    if (hasHandzender) {
      bedAlts.push('• Draaistang (handmatig, geen motor): -€' + Math.round((300 + hz) * MARKUP));
      bedAlts.push('• Orea WT (bedraad, wandschakelaar): -€' + Math.round((51 + hz) * MARKUP));
    }
  }

  if (cat === 'screen') {
    if (hasHandzender) {
      bedAlts.push('• LT 50 draaischakelaar (bedraad): -€' + Math.round((89 + hz) * MARKUP));
      // Solar Brel: +135 (incl hz) maar bespaart losse hz
      const solarBrelDiff = Math.round((135 - hz) * MARKUP);
      bedAlts.push('• Solar Brel (zonnepaneel, incl. handzender): ' + (solarBrelDiff >= 0 ? '+' : '-') + '€' + Math.abs(solarBrelDiff));
      bedAlts.push('• Solar RS 100 IO (premium solar): +€' + Math.round(173 * MARKUP));
    }
  }

  if (cat === 'rolluik') {
    if (hasHandzender) {
      bedAlts.push('• Bandbediening (handmatig): -€' + Math.round((260 + hz) * MARKUP));
      bedAlts.push('• LT 50 draaischakelaar (bedraad): -€' + Math.round((150 + hz) * MARKUP));
      bedAlts.push('• Solar RS 100 IO (zonnepaneel): +€' + Math.round(239 * MARKUP));
      const solarBrelDiff = Math.round((199 - hz) * MARKUP);
      bedAlts.push('• Solar Brel (zonnepaneel, incl. handzender): +€' + Math.abs(solarBrelDiff));
    }
  }

  if (cat === 'uitvalscherm') {
    if (hasHandzender) {
      // SunCube: Orea WT standaard + Sunea IO (+60) + hz (+76)
      if (productKey === 'suncube150') {
        bedAlts.push('• Draaistang (handmatig): -€' + Math.round((60 + hz + 299) * MARKUP));
        bedAlts.push('• Orea WT (bedraad, wandschakelaar): -€' + Math.round((60 + hz) * MARKUP));
        const solarDiff = Math.round((135 - 60 - hz) * MARKUP);
        bedAlts.push('• Solar Brel (zonnepaneel, incl. handzender): ' + (solarDiff >= 0 ? '+' : '-') + '€' + Math.abs(solarDiff));
      }
      // SunProject: Somfy LT standaard + Sunea IO (+134) + hz (+76)
      if (productKey === 'sunproject100') {
        bedAlts.push('• Draaistang (handmatig): -€' + Math.round((134 + hz + 299) * MARKUP));
        bedAlts.push('• Somfy LT (bedraad, draaischakelaar): -€' + Math.round((134 + hz) * MARKUP));
        const solarDiff = Math.round((199 - 134 - hz) * MARKUP);
        bedAlts.push('• Solar Brel (zonnepaneel, incl. handzender): ' + (solarDiff >= 0 ? '+' : '-') + '€' + Math.abs(solarDiff));
      }
    }
  }

  if (cat === 'serre') {
    if (hasHandzender) {
      bedAlts.push('• Orea WT (bedraad, wandschakelaar): -€' + Math.round((50 + hz) * MARKUP));
    }
  }

  if (bedAlts.length > 0) {
    lines.push('Andere bediening:');
    lines.push(...bedAlts);
    lines.push('');
  }

  // === KLEUR/EXTRA ===
  const product = PRICES[productKey];
  const extraLines = [];

  if (product?.meerprijsTrend) {
    const trendEntry = findNearest(product.meerprijsTrend, breedteCm);
    if (trendEntry) extraLines.push('• Trendkleur: +€' + Math.round(trendEntry.value * MARKUP));
  }
  if (product?.meerprijsRAL) {
    const ralEntry = findNearest(product.meerprijsRAL, breedteCm);
    if (ralEntry) extraLines.push('• RAL kleur naar keuze: +€' + Math.round(ralEntry.value * MARKUP));
  }
  if (cat === 'rolluik') {
    extraLines.push('• Trendkleur: +15% | RAL kleur/ronde kast: +20%');
  }
  if (cat === 'serre') {
    extraLines.push('• RAL kleur naar keuze: +15%');
  }

  if (extraLines.length > 0) {
    lines.push('Extra:');
    lines.push(...extraLines);
    lines.push('');
  }

  lines.push('Laat het ons weten, we passen je offerte graag aan.');

  return lines.join('\n');
}

// ============ PRODUCT INFO TOEVOEGEN ============

function enrichProductDescription(desc, productKey, breedteCm, hoogteCm, uitvalCm) {
  const info = PRODUCT_INFO[productKey];
  if (!info) return desc;

  const origLines = desc.split('\n');
  const kleur = extractKleur(desc);
  const bedStr = extractBediening(desc);
  const isIO = bedStr.includes('afstandsbediening') || bedStr.includes('io') || bedStr.includes('motor');
  const bedType = isIO ? 'afstandsbediening' : 'handmatig';

  // Check of opties al bestaan (idempotent)
  if (desc.includes('Liever een ander model')) return desc;

  // Stap 1: Annoteer kleurregels met (standaard)/(niet standaard) — alleen EERSTE frame kleur
  const newLines = [];
  let kleurAnnotated = false;

  for (let i = 0; i < origLines.length; i++) {
    const t = origLines[i].trim().toLowerCase();

    // Annoteer alleen de eerste "frame kleur" of "kleur:" regel (niet "kleur doek" etc.)
    if (!kleurAnnotated && t.match(/^(frame\s*kleur)[:\s]/i) && !origLines[i].includes('(standaard') && !origLines[i].includes('(niet standaard')) {
      const isStd = isStandaardKleur(productKey, kleur);
      newLines.push(origLines[i].trimEnd() + (isStd ? ' (standaard)' : ' (niet standaard)'));
      kleurAnnotated = true;
    } else {
      newLines.push(origLines[i]);
    }
  }

  // Stap 2: Voeg product-specifieke info toe (cassette/geleiding/type) NA de garantie
  // Zodat het niet tussen bestaande RP-velden terechtkomt
  const fullText = newLines.join('\n').toLowerCase();
  const infoToAdd = [];
  if (info.cassette && !fullText.includes('cassette:')) infoToAdd.push('Cassette: ' + info.cassette);
  if (info.geleiding && !fullText.includes('geleiding:')) infoToAdd.push('Geleiding: ' + info.geleiding);
  if (info.onderlat && !fullText.includes('onderlat:') && !fullText.includes('design')) infoToAdd.push('Onderlat: ' + info.onderlat);
  if (info.type && !fullText.includes('type:')) infoToAdd.push('Type: ' + info.type);
  if (info.kast && !fullText.includes('kast:') && !fullText.includes('kastmaat')) infoToAdd.push('Kast: ' + info.kast);
  if (info.profiel && !fullText.includes('profiel:') && !fullText.includes('s-37') && !fullText.includes('s-42')) infoToAdd.push('Profiel: ' + info.profiel);

  if (infoToAdd.length > 0) {
    // Voeg toe vóór de garantie-regel, of aan het einde
    const gi = newLines.findIndex(l => l.trim().toLowerCase().startsWith('garantie'));
    const insertAt = gi >= 0 ? gi : newLines.length;
    newLines.splice(insertAt, 0, ...infoToAdd);
  }

  // Voeg upgrade/downgrade opties toe aan het einde
  const optionsBlock = buildOptionsBlock(productKey, breedteCm, hoogteCm, uitvalCm, bedType);
  if (optionsBlock) {
    return newLines.join('\n') + optionsBlock;
  }

  return newLines.join('\n');
}

// ============ MAIN ============

async function processQuotation(quotationNumber, dryRun) {
  console.log('Processing #' + quotationNumber + (dryRun ? ' (DRY RUN)' : '') + '...');

  // Zoek de offerte
  const backlogData = await rpGet('/contact-service/' + PID + '/backlogs/' + BACKLOG_ID + '/items');
  const items = backlogData?.items || [];
  let docId = null, lcId = null;

  for (const item of items) {
    lcId = item.item_subject?.id;
    if (!lcId) continue;
    const docData = await rpGet('/document-service/v1/' + PID + '/quotations?lead_configuration_id=' + lcId);
    const docs = docData?.quotationDatas || [];
    const found = docs.find(d => String(d.quotationNumber) === String(quotationNumber));
    if (found) { docId = found.documentId; break; }
  }

  if (!docId) { console.log('Offerte niet gevonden!'); return; }

  const fullDoc = await rpGet('/document-service/v1/' + PID + '/quotations/' + docId);
  const qd = fullDoc.quotationData;
  const plg = qd.segments?.defaultTemplatePriceLineGroup;
  if (!plg) { console.log('Geen prijslijnen gevonden!'); return; }

  // Backup
  const backupPath = path.join(__dirname, '..', 'data', 'offerte-backups', quotationNumber + '-v4-' + Date.now() + '.json');
  fs.writeFileSync(backupPath, JSON.stringify(qd, null, 2));
  console.log('Backup: ' + backupPath);

  const lines = plg.data.lines;
  let changedCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const firstLine = (lines[i].description?.split('\n')[0] || '').replace(/^\*\*|\*\*$/g, '');
    const productKey = getProductKey(firstLine);
    if (!productKey) continue;

    const maat = extractMaat(lines[i].description);
    const b = maat.breedte;
    const h = maat.hoogte;
    const u = maat.uitval;

    if (!b && !h) {
      console.log('  Skip ' + firstLine + ': geen maat gevonden');
      continue;
    }

    console.log('  ' + firstLine + ' → ' + productKey + ' (B=' + b + ' H=' + h + ' U=' + u + ')');

    const enriched = enrichProductDescription(lines[i].description, productKey, b, h, u);
    if (enriched !== lines[i].description) {
      if (dryRun) {
        console.log('  WOULD UPDATE:\n' + enriched.split('\n').map(l => '    | ' + l).join('\n'));
      } else {
        lines[i].description = enriched;
      }
      changedCount++;
    } else {
      console.log('  (geen wijziging)');
    }
  }

  if (changedCount === 0) {
    console.log('Geen wijzigingen nodig.');
    return;
  }

  if (dryRun) {
    console.log('\nDRY RUN: ' + changedCount + ' producten zouden worden aangepast.');
    return;
  }

  // Opslaan
  const ok = await rpPut('/document-service/v1/' + PID + '/quotations/' + docId, qd);
  console.log(ok ? '\nOpgeslagen! ' + changedCount + ' producten aangepast.' : '\nFOUT bij opslaan!');
}

// CLI
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const apply = args.includes('--apply');
const qNum = args.find(a => /^\d+$/.test(a));

if (!qNum) {
  console.log('Gebruik: node cron-offerte-controle-v4.js --dry-run 20266757');
  console.log('         node cron-offerte-controle-v4.js --apply 20266757');
  process.exit(1);
}

processQuotation(qNum, !apply).catch(e => { console.error(e); process.exit(1); });
