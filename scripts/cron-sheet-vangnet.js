#!/usr/bin/env node
// SHEET-VANGNET (Daimy 2026-08-16, casus Edwin Kanters / Barbara Weeink).
//
// Aanleiding: offerte-rijen in het register schrijft V4, maar alleen voor items die op het
// moment van een run (ma-za 09:00/17:00) in een register-status staan én korter dan 7 dagen
// geleden zijn aangemaakt. Twee soorten dossiers vallen daar structureel buiten:
//   1. dossiers die de kolom "Offerte controle" overslaan (RP maakt bij sommige aanvragen
//      direct meerdere offertes) en pas in het weekend op "Inmeten inplannen" komen — vóór de
//      maandagrun zijn ze alweer doorgeschoven (Edwin Kanters, 8 gevallen in de audit 16-08);
//   2. nieuwe offertes op een OUD item (ouder dan 7 dagen) — die haalt geen enkel V4-filter
//      (Barbara Weeink: item uit 2025, offerte 13-08-2026).
//
// Dit vangnet draait als eigen cron (óók op zondag), kijkt naar alle recent bewogen dossiers
// in de hele flow en schrijft ontbrekende offerte-rijen alsnog — in de maandtab van de
// OFFERTE-datum, niet van de item-datum. Dubbele rijen zijn uitgesloten doordat ALLE
// offertenummers van het dossier tegen kolom G van de kandidaat-tabs worden gecheckt
// (zelfde dedupe-sleutel als V4 gebruikt).
//
// Draai met DRY=1 voor een proefdraai zonder schrijven.
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const CFG = require('./ai-ks/config.js');

const H = { Authorization: 'Bearer ' + CFG.RP_API_KEY };
const SHEET_ID = '1NesKeIKLVOLJjSy-fqo5KXrEVG2VJTYSfjgN7EHY85g';
const STATE_FILE = path.join(__dirname, '..', 'data', 'sheet-vangnet-state.json');
const DRY = !!process.env.DRY;
const TG_TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';
const TG_CHAT = 1700128390;

// Flow-statussen ná (of buiten) de kolommen die V4 zelf al naar de sheet schrijft.
const STATUSSEN = {
  '15c4f0be-c6bf-447d-bf5f-a233c482eb53': 'Offerte verstuurd',
  '2e9819bd-26f0-4082-8f18-32bb48f87f54': 'Inmeten inplannen',
  'f895f76f-175e-4ea0-bb7c-6cc2f4e5d846': 'Gripp invullen',
  '2082ad8a-517c-4e24-8c0f-a5be69b1588a': 'Afgerond',
};
const KANDIDAAT_DAGEN = 10;  // item moet recent bewogen zijn
const DOC_MAX_DAGEN = 45;    // oudere offertes zijn historie, geen register-achterstand
const MAX_RIJEN_PER_RUN = 20;

const MAAND_NAMEN = ['Jan', 'Feb', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
const AFKOMST_MAP = { google: 'Google', instagram: 'Instagram', facebook: 'Facebook', winkel: 'Winkel', buren: 'Buren', bekenden: 'Bekenden', anders: 'Anders' };
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

function productCat(lines) {
  const t = lines.map((l) => (l.description || '').split('\n')[0]).join(' ').toLowerCase();
  if (t.includes('voorraad')) return 'Voorraadscherm';
  if (/suneye|sunbasic|sunelite|knikarm/.test(t)) return 'Knikarmscherm';
  if (t.includes('pergola')) return 'Pergola';
  if (t.includes('rolluik')) return 'Rolluiken';
  if (/screen|zip/.test(t)) return 'Screens';
  if (/gordijn|plisse|jaloezie|rolgordijn|duette|vouwgordijn/.test(t)) return 'Raamdecoratie';
  if (t.includes('markies')) return 'Markiezen';
  if (/horren|\bhor\b/.test(t)) return 'Horren';
  return '';
}

// Offertewaarde zoals hij op de offerte staat: regelkortingen én groepskorting meegerekend
// (V4's eigen sheet-stap negeert regelkortingen, maar niet-genormaliseerde offertes zoals
// die van Edwin hebben juist alléén regelkortingen).
function offerteBedrag(data) {
  let totaal = (data.lines || []).reduce((s, l) => {
    const d = l.discount && l.discount.type === 'PERCENTAGE' ? (l.discount.amount || 0) : 0;
    return s + (l.units || 1) * (l.pricePerUnit || 0) * (1 - d / 100);
  }, 0);
  if (data.groupDiscount && data.groupDiscount.amount) totaal *= 1 - data.groupDiscount.amount / 100;
  return totaal;
}

async function rpGet(ep) {
  const r = await fetch('https://backend.reuzenpanda.nl' + ep, { headers: H });
  return r.ok ? r.json() : null;
}

async function telegram(tekst) {
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT, text: tekst.substring(0, 4000) }),
  }).catch(() => {});
}

(async () => {
  let state = {};
  try { state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { /* eerste run */ }

  const itemsData = await rpGet(`/contact-service/${CFG.RP_PID}/backlogs/${CFG.RP_BACKLOG}/items`);
  if (!Array.isArray(itemsData?.items)) { console.log('items-lijst niet op te halen, volgende run opnieuw'); process.exit(0); }
  const grens = Date.now() - KANDIDAAT_DAGEN * 86400000;
  const kandidaten = itemsData.items.filter((i) =>
    STATUSSEN[i.status_id] && i.timestamp_updated > grens &&
    !(i.technical_labels || []).some((l) => l.type === 'ITEM_ARCHIVED') &&
    state[i.id]?.updated !== i.timestamp_updated
  );
  console.log(`kandidaten: ${kandidaten.length} (van ${itemsData.items.length} items)`);

  const auth = new google.auth.GoogleAuth({ keyFile: path.join(__dirname, '..', 'data', 'google-service-account.json'), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const nummerCache = {}; // tabnaam -> Set van kolom-G-nummers
  async function nummersInTab(tabNaam) {
    if (!nummerCache[tabNaam]) {
      const r = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'${tabNaam}'!G4:G6000` }).catch(() => null);
      nummerCache[tabNaam] = new Set((r?.data.values || []).map((x) => x[0]).filter(Boolean));
    }
    return nummerCache[tabNaam];
  }

  let geschreven = 0;
  const regels = [];
  for (const item of kandidaten) {
    if (geschreven >= MAX_RIJEN_PER_RUN) { console.log('max rijen per run bereikt, rest volgende run'); break; }
    const klaar = (nummer) => { state[item.id] = { updated: item.timestamp_updated, nummer: nummer || null }; };
    const lcId = item.item_subject?.id;
    if (!lcId) { klaar(null); continue; }
    await wacht(150);
    const q = await rpGet(`/document-service/v1/${CFG.RP_PID}/quotations?lead_configuration_id=${lcId}`);
    const docs = (q?.quotationDatas || []).filter((d) => d.quotationNumber);
    if (!docs.length) { klaar(null); continue; }
    docs.sort((a, b) => (b.quotationStatus === 'ACCEPTED') - (a.quotationStatus === 'ACCEPTED') || (b.quotationCreationTimestamp || 0) - (a.quotationCreationTimestamp || 0));
    const doc = docs[0];
    if ((doc.quotationCreationTimestamp || 0) < Date.now() - DOC_MAX_DAGEN * 86400000) { klaar(doc.quotationNumber); continue; }

    // KORTING-VANGNET (zelfde casus Edwin): RP genereert bij sommige aanvragen direct
    // meerdere offerte-varianten (herkenbaar: >=2 docs met exact dezelfde creation-ms) die
    // nooit door de kolom Offerte controle gaan. Die docs hebben naamloze kortingen per
    // regel in plaats van de vaste opbouw (één benoemde groepskorting onderaan, zet V4).
    // Voor verse, ongetekende gevallen: naamloze regel-kortingen strippen en het item
    // terug naar Offerte controle zetten zodat de bestaande V4-verwerking hem normaliseert,
    // verstuurt én de sheet-rij schrijft. NIET strippen zonder terugzetten of andersom:
    // V4 haalt regel-kortingen zelf niet weg en zou er dubbele korting van maken.
    const OC_STATUS = '64788881-632c-4217-8f56-d20732c94b08';
    const machinaal = docs.length >= 2 && new Set(docs.map((x) => x.quotationCreationTimestamp)).size === 1;
    const ietsGetekend = docs.some((x) => /ACCEPTED|SIGNED/i.test(String(x.quotationStatus || '')));
    const vers = item.timestamp_created > Date.now() - 6 * 86400000; // V4 stap 1 pakt items tot 7 dagen
    if (machinaal && !ietsGetekend && vers && item.status_id === '15c4f0be-c6bf-447d-bf5f-a233c482eb53') {
      let naamlozeKorting = false;
      const volle = [];
      for (const dx of docs) {
        const f = await rpGet(`/document-service/v1/${CFG.RP_PID}/quotations/${dx.documentId}`);
        const qd = f?.quotationData;
        const ls = qd?.segments?.defaultTemplatePriceLineGroup?.data?.lines || [];
        if (ls.some((l) => l.discount && l.discount.type === 'PERCENTAGE' && l.discount.amount > 0 && !(l.discount.name || '').trim())) naamlozeKorting = true;
        volle.push({ dx, qd, ls });
        await wacht(150);
      }
      if (naamlozeKorting) {
        console.log(`${DRY ? '[DRY] ' : ''}⚠ ${item.summary}: machinaal gegenereerde varianten zonder controle — regel-kortingen strippen en terug naar Offerte controle`);
        if (!DRY) {
          let gelukt = true;
          for (const { dx, qd, ls } of volle) {
            if (!qd) continue;
            ls.forEach((l) => { if (l.discount && l.discount.type === 'PERCENTAGE' && !(l.discount.name || '').trim()) l.discount = null; });
            const put = await fetch(`https://backend.reuzenpanda.nl/document-service/v1/${CFG.RP_PID}/quotations/${dx.documentId}`, {
              method: 'PUT', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify(qd),
            });
            if (!put.ok) gelukt = false;
            await wacht(300);
          }
          const st = await fetch(`https://backend.reuzenpanda.nl/contact-service/${CFG.RP_PID}/backlogs/${CFG.RP_BACKLOG}/items/${item.id}`, {
            method: 'PATCH', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ item: { status_id: OC_STATUS } }),
          });
          if (gelukt && st.ok) {
            await telegram(`🔧 Sheet-vangnet: dossier ${item.summary} was door RP direct aangemaakt zonder controle (kortingen per regel). Regel-kortingen gestript en teruggezet naar Offerte controle; V4 normaliseert en verstuurt hem bij de volgende run.`);
            // Geen rij schrijven: V4 schrijft hem straks met het definitieve bedrag.
            // State niet afvinken; de statuswissel verandert timestamp_updated, dus de
            // volgende run controleert vanzelf of de rij er dan is.
            continue;
          }
          await telegram(`⚠️ Sheet-vangnet: normaliseren van dossier ${item.summary} MISLUKT (strip ${gelukt ? 'ok' : 'faalde'}, statuswissel ${st.ok ? 'ok' : 'faalde'}) — handmatig nakijken.`);
        } else {
          continue;
        }
      }
    }

    const alleNummers = docs.map((d) => String(d.quotationNumber));
    const d = new Date(doc.quotationCreationTimestamp);
    const docTab = `${MAAND_NAMEN[d.getMonth()]} ${d.getFullYear()}`;
    const ic = new Date(item.timestamp_created);
    const itemTab = `${MAAND_NAMEN[ic.getMonth()]} ${ic.getFullYear()}`;
    let bestaat = false;
    for (const tabNaam of new Set([docTab, itemTab])) {
      const kandTab = meta.data.sheets.find((s) => s.properties.title.trim() === tabNaam);
      if (!kandTab) continue;
      const set = await nummersInTab(kandTab.properties.title);
      if (alleNummers.some((n) => set.has(n))) { bestaat = true; break; }
    }
    if (bestaat) { klaar(doc.quotationNumber); continue; }

    const tab = meta.data.sheets.find((s) => s.properties.title.trim() === docTab);
    if (!tab) { console.log(`tab "${docTab}" bestaat niet — overslaan (${item.summary})`); klaar(null); continue; }
    const full = await rpGet(`/document-service/v1/${CFG.RP_PID}/quotations/${doc.documentId}`);
    const data = full?.quotationData?.segments?.defaultTemplatePriceLineGroup?.data;
    if (!data?.lines) { klaar(doc.quotationNumber); continue; }

    const desc = item.description || '';
    const stad = desc.match(/Plaats:\s*([^\n]+)/i)?.[1]?.trim() || '';
    const afkomstRaw = (desc.match(/Hoe komt u bij ons terecht\?:\s*([^\n]+)/i)?.[1] || '').trim().toLowerCase();
    let tel = ((item.free_fields || []).find((f) => f.label === 'phone')?.value || desc.match(/Telefoonnummer:\s*(\S+)/)?.[1] || '').replace(/[\s()\-.]/g, '').replace(/^(\+31)0/, '$1');
    if (tel.startsWith('06')) tel = '+31' + tel.slice(1);
    if (tel.startsWith('31') && !tel.startsWith('+')) tel = '+' + tel;
    const datum = `${d.getDate()}-${d.getMonth() + 1}-${String(d.getFullYear()).slice(-2)}`;
    const delen = (item.summary || '').trim().split(/\s+/);
    const rij = [datum, delen[0] || '', delen.slice(1).join(' '), stad, tel,
      '€ ' + offerteBedrag(data).toFixed(2).replace('.', ','), String(doc.quotationNumber), '',
      'Online', AFKOMST_MAP[afkomstRaw] || afkomstRaw || '', 'Prive', productCat(data.lines)];

    console.log(`${DRY ? '[DRY] ' : ''}→ ${docTab}: ${rij.join(' | ')}  [was: ${STATUSSEN[item.status_id]}]`);
    regels.push(`${item.summary} (${doc.quotationNumber}, ${docTab})`);
    if (!DRY) {
      const fullR = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'${tab.properties.title}'!A4:X6000` });
      const rows = fullR.data.values || [];
      let nextRow = 4;
      while (nextRow - 4 < rows.length) {
        const r = rows[nextRow - 4];
        if (![0, 19, 20, 21, 23].some((i2) => r?.[i2]?.toString().trim())) break;
        nextRow++;
      }
      await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: `'${tab.properties.title}'!A${nextRow}:L${nextRow}`, valueInputOption: 'USER_ENTERED', requestBody: { values: [rij] } });
      await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests: [{ repeatCell: { range: { sheetId: tab.properties.sheetId, startRowIndex: nextRow - 1, endRowIndex: nextRow, startColumnIndex: 0, endColumnIndex: 12 }, cell: { userEnteredFormat: { backgroundColor: { red: 1, green: 1, blue: 0 } } }, fields: 'userEnteredFormat.backgroundColor' } }] } });
      nummerCache[tab.properties.title]?.add(String(doc.quotationNumber));
      await wacht(1200); // Sheets-limiet 60 writes/min
    }
    geschreven++;
    klaar(doc.quotationNumber);
  }

  if (!DRY) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 1));
    if (geschreven > 0) await telegram(`📋 Sheet-vangnet: ${geschreven} ontbrekende offerte-rij(en) toegevoegd: ${regels.join('; ')}`);
  }
  console.log(`klaar: ${geschreven} rij(en) ${DRY ? 'zou geschreven worden' : 'geschreven'}`);
})();
