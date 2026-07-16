#!/usr/bin/env node
/**
 * Nachtelijke prijs-steekproef — vangnet tegen stille prijsfouten
 *
 * Draait dagelijks om 03:30. Pakt 20 willekeurige recent VERSTUURDE offertes
 * en rekent elke productregel na tegen het Sunmaster prijsboek (via de
 * v4-prijsengine). Afwijking > €1 → Telegram-alert met details.
 *
 * Leest ALLEEN — corrigeert niets. Correctie blijft het werk van v4;
 * dit script bestaat om bugs zoals de gekoppelde-pergola-fout (die weken
 * onopgemerkt bleef) binnen één dag te signaleren.
 */

const fs = require('fs');
const path = require('path');

const KEY = 'reuzenpanda_cpat_WMD2KmDRune53bj7.d0_ls8loPpAjb2TrSNOS_Xd_QLdxHq1xwOC9pyyJado';
const PID = '731483fa-ef6b-4aae-afcf-883ec09219dd';
const BOARD = 'edb9b0b7-b70e-4064-95b5-ec0d03357c0a';
const B = 'https://backend.reuzenpanda.nl';
const H = { Authorization: 'Bearer ' + KEY };
const TG_TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
const TG_CHAT = '1700128390';
const STEEKPROEF = 20;
// Alleen recente offertes: test de HUIDIGE prijsengine, niet de historie
// (oude offertes van vóór een fix zouden anders wekenlang valse alerts geven)
const MAX_LEEFTIJD_DAGEN = 4;
const GEMELD_FILE = path.join(__dirname, '.steekproef-gemeld.json');
function getGemeld() { try { return JSON.parse(fs.readFileSync(GEMELD_FILE, 'utf8')); } catch { return {}; } }
function markGemeld(nrs) {
  const g = getGemeld();
  for (const n of nrs) g[n] = new Date().toISOString();
  fs.writeFileSync(GEMELD_FILE, JSON.stringify(g, null, 1));
}

// v4-prijsengine hergebruiken (zelfde functies als de daemon zelf gebruikt)
const V4_PATH = path.join(__dirname, 'cron-offerte-controle-v4-combined.js');
const src = fs.readFileSync(V4_PATH, 'utf8');
const SUNMASTER_PRICES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'sunmaster-prices-2026.json'), 'utf8'));
const MARKUP = 1.10;
function grab(name) {
  const m = src.match(new RegExp('function ' + name + '\\([\\s\\S]*?\\n\\}'));
  if (!m) throw new Error('v4-functie niet gevonden: ' + name);
  return m[0];
}
/* eslint-disable no-eval */
// Alles in ÉÉN eval: function-declaraties lekken in sloppy mode naar module-scope, maar
// const-declaraties blijven in de eval-scope. Alleen als consts en functies in dezelfde
// eval zitten zien de functies de consts via hun closure. Losse evals gaven
// "STANDAARD_KLEUREN_MAP is not defined" zodra de steekproef een kleuren-/markiesregel trok.
const v4Snippets = [
  src.match(/const MK_UITVAL_COLS[\s\S]*?const MK_BEDIENING = \{[\s\S]*?\};/)[0],
  src.match(/const STANDAARD_KLEUREN_MAP = \{[\s\S]*?\};/)[0],
];
for (const fn of ['findNearest', 'getCategory', 'getProductKey', 'extractField', 'extractMaatFromDesc', 'lookupPrice', 'calculateCorrectPrice', 'correctProductPrice', 'isStandaardKleur', 'mkLookupMarkies', 'mkLookupBovenkap', 'mkLookupZijkap', 'mkGetTabel', 'mkTotaalExcl']) {
  v4Snippets.push(grab(fn));
}
eval(v4Snippets.join('\n'));

async function rpGet(ep) {
  const r = await fetch(B + ep, { headers: H });
  if (!r.ok) throw new Error('RP ' + r.status + ' op ' + ep);
  return r.json();
}

async function telegram(text) {
  await fetch('https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT, text }),
  }).catch(() => {});
}

(async () => {
  console.log('[' + new Date().toISOString() + '] Prijs-steekproef start');
  const items = (await rpGet(`/contact-service/${PID}/boards/${BOARD}/items`)).items || [];
  const cutoff = Date.now() - MAX_LEEFTIJD_DAGEN * 86400000;
  const kandidaten = items.filter(i =>
    i.item_subject?.id && i.timestamp_created > cutoff &&
    !(i.technical_labels || []).some(l => l.type === 'ITEM_ARCHIVED')
  );
  // Willekeurige steekproef
  const gekozen = [];
  const pool = [...kandidaten];
  while (gekozen.length < STEEKPROEF && pool.length > 0) {
    gekozen.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  console.log('Kandidaten: ' + kandidaten.length + ', steekproef: ' + gekozen.length);

  const afwijkingen = [];
  let gecheckt = 0, regels = 0;
  for (const item of gekozen) {
    let docs;
    try {
      docs = (await rpGet(`/document-service/v1/${PID}/quotations?lead_configuration_id=${item.item_subject.id}`)).quotationDatas || [];
    } catch (e) { console.log('  skip (docs): ' + e.message); continue; }
    if (!docs.length) continue;
    docs.sort((a, b) => (b.quotationCreationTimestamp || 0) - (a.quotationCreationTimestamp || 0));
    if (docs[0].quotationStatus !== 'SENT') continue;
    let doc;
    try {
      doc = (await rpGet(`/document-service/v1/${PID}/quotations/${docs[0].documentId}`)).quotationData;
    } catch (e) { console.log('  skip (doc): ' + e.message); continue; }
    const lines = doc.segments?.defaultTemplatePriceLineGroup?.data?.lines || [];
    gecheckt++;

    for (const l of lines) {
      const desc = l.description || '';
      const firstLine = desc.split('\n')[0] || '';
      const fl = firstLine.toLowerCase();
      if (fl.includes('montage') || fl.includes('inmeten') || fl.includes('voorraad') || fl.includes('korting')) continue;
      // Roma heeft een eigen prijsboek (netto × 1,15) — getProductKey zou "zipSCREEN.2" als
      // Sunmaster-zipscreen prijzen en valse afwijkingen melden. Duo-offertes zijn bovendien
      // machine-gegenereerd uit roma-prices-2025.json, dus buiten scope net als markiezen.
      if (fl.includes('roma')) continue;
      // Voorraadschermen hebben een handmatige actieprijs; het woord 'voorraad' kan uit de
      // titel ontbreken (bv. #20269669) — de standaard voorraadzin in de tekst telt ook.
      if (desc.includes('Direct leverbaar uit voorraad')) continue;
      if (l.pricePerUnit <= 0) continue;
      const pKey = getProductKey(firstLine);
      if (!pKey) continue; // markiezen/onbekende producten: buiten scope van de steekproef
      const maat = extractMaatFromDesc(desc);
      if (!maat.breedte && !maat.hoogte) continue;
      regels++;
      // Exact hetzelfde rekenpad als v4 (correctProductPrice, dry-run op een kopie). Een eigen
      // kopie van de kleur-/bedieningslogica liep uit de pas (kende trendkleuren niet) en gaf
      // dagenlang valse alerts op offertes die gewoon klopten.
      const proef = { description: desc, pricePerUnit: l.pricePerUnit };
      const origLog = console.log;
      console.log = () => {}; // correctProductPrice logt "Prijs gecorrigeerd" — hier alleen rekenen
      let pc;
      try { pc = correctProductPrice(proef, pKey, maat.breedte, maat.hoogte, maat.uitval); }
      finally { console.log = origLog; }
      if (pc.priceUnknown) {
        afwijkingen.push('#' + doc.quotationNumber + ' ' + item.summary + ': "' + firstLine.replace(/\*/g, '') + '" — prijs niet bepaalbaar (maat buiten tabel?), staat op €' + l.pricePerUnit);
        continue;
      }
      if (pc.changed) {
        const verwacht = proef.pricePerUnit;
        const verschil = Math.round((l.pricePerUnit - verwacht) * 100) / 100;
        afwijkingen.push('#' + doc.quotationNumber + ' ' + item.summary + ': "' + firstLine.replace(/\*/g, '') + '" staat op €' + l.pricePerUnit + ', hoort €' + verwacht + ' (' + (verschil > 0 ? '+' : '') + verschil + ')');
      }
    }
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('Gecheckt: ' + gecheckt + ' offertes, ' + regels + ' productregels, ' + afwijkingen.length + ' afwijkingen');
  for (const a of afwijkingen) console.log('  AFWIJKING: ' + a);

  // Alleen alerten over offertes die nog niet eerder gemeld zijn
  const gemeld = getGemeld();
  const nieuw = afwijkingen.filter(a => { const nr = a.match(/#(\d+)/)?.[1]; return nr && !gemeld[nr]; });
  if (nieuw.length > 0) {
    await telegram('🚨 PRIJS-STEEKPROEF: ' + nieuw.length + ' afwijking(en) gevonden in ' + gecheckt + ' recente offertes:\n\n' +
      nieuw.slice(0, 15).join('\n') + (nieuw.length > 15 ? '\n… en ' + (nieuw.length - 15) + ' meer (zie logs/prijs-steekproef.log)' : '') +
      '\n\nLet op: een afwijking kan ook een handmatige prijsafspraak zijn — check vóór je corrigeert.');
    markGemeld(nieuw.map(a => a.match(/#(\d+)/)?.[1]).filter(Boolean));
  }
})().catch(async (e) => {
  console.error('CRASH:', e.message);
  await telegram('⚠️ Prijs-steekproef gecrasht: ' + e.message.slice(0, 200));
  process.exit(1);
});
