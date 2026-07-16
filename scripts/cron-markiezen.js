#!/usr/bin/env node
/**
 * Markiezen offerte automatisering
 *
 * 3x per dag: 9:30, 13:00, 17:00 (ma-za) — zelfde schema als v3
 *
 * Stap 1: Pak markiezen uit "Handmatige controle" (ALLEEN die status!)
 *         Bouw offerte: markies + bovenkap + zijkappen + bediening, alles incl BTW
 *         Status → "Gecontroleerd"
 *
 * Stap 2 (dag erna via v3): Gecontroleerd → sheet + Offerte verstuurd
 *
 * Pricing: Markiezen Nederland 2026 (excl BTW = verkoopprijs)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RP_API_KEY = 'reuzenpanda_cpat_WMD2KmDRune53bj7.d0_ls8loPpAjb2TrSNOS_Xd_QLdxHq1xwOC9pyyJado';
const PID = '731483fa-ef6b-4aae-afcf-883ec09219dd';
const BACKLOG_ID = 'e9d5462b-0f3e-43b5-ba60-d61a1ca4f0d7';
const HANDMATIG = '6221c9fd-c835-45dc-a494-f81e40a8e184';
const GECONTROLEERD = 'c860c5ae-7eef-45cc-8e79-3b4bcd285b7a';
const TG_TOKEN = '8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40';

const WAAROM_SONTY = '**Waarom Sonty?**\n\n- Eigen montageteam: al onze monteurs zijn in dienst, geen onderaannemers\n- Persoonlijk advies: gratis inmeetafspraak bij u thuis\n- 3000+ tevreden klanten\n- 4.9/5.0 op Google met 500+ reviews\n- Alles uit eigen hand: van advies tot montage en nazorg';

// ============ API HELPERS ============

async function fetchRetry(url, options, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try { return await fetch(url, options); }
    catch (e) {
      if (i === tries) throw e;
      console.log('  (netwerkfout, poging ' + (i+1) + '/' + tries + ')');
      await new Promise(r => setTimeout(r, i * 5000));
    }
  }
}

async function rpGet(ep) {
  const res = await fetchRetry('https://backend.reuzenpanda.nl' + ep, { headers: { 'Authorization': 'Bearer ' + RP_API_KEY } });
  if (!res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

async function setStatus(itemId, statusId) {
  const res = await fetchRetry('https://backend.reuzenpanda.nl/contact-service/' + PID + '/backlogs/' + BACKLOG_ID + '/items/' + itemId, {
    method: 'PATCH', headers: { 'Authorization': 'Bearer ' + RP_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ item: { status_id: statusId } }),
  });
  return res.ok;
}

async function sendTelegram(text) {
  await fetchRetry('https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: 1700128390, text: text.substring(0, 4000) }),
  }).catch(() => {});
}

// ============ PRIJSTABELLEN (excl BTW) ============

const UITVAL_COLS = [80,90,100,115,135,150,165,180,200];
const GRENEN = [[100,[593,667,708,805,929,1088,1196,1317,1448]],[120,[619,698,734,837,963,1131,1247,1371,1510]],[140,[642,726,767,864,990,1173,1289,1419,1560]],[160,[665,757,800,901,1029,1214,1332,1466,1614]],[180,[690,777,835,934,1060,1253,1378,1517,1666]],[200,[715,809,860,972,1094,1293,1426,1566,1723]],[220,[738,837,893,999,1127,1332,1466,1614,1773]],[240,[762,864,926,1036,1160,1378,1517,1666,1835]],[260,[785,888,955,1067,1191,1427,1568,1725,1900]],[280,[809,918,988,1098,1224,1458,1602,1763,1941]],[300,[839,949,1021,1131,1260,1499,1651,1817,1995]],[320,[859,972,1050,1168,1293,1543,1694,1864,2051]],[340,[882,1001,1083,1201,1322,1579,1740,1912,2102]],[360,[906,1029,1114,1237,1357,1628,1790,1966,2164]],[380,[932,1040,1150,1268,1392,1651,1817,1998,2199]],[400,[955,1086,1178,1301,1427,1713,1885,2070,2277]],[420,[980,1106,1212,1334,1456,1751,1922,2115,2327]]];
const ALUMINIUM = [[100,[593,667,708,805,929,1088,1196,1317,1448]],[120,[619,698,734,837,963,1131,1247,1371,1510]],[140,[642,726,767,864,990,1173,1289,1419,1560]],[160,[665,757,800,901,1052,1214,1332,1466,1614]],[180,[690,777,835,934,1071,1253,1378,1525,1666]],[200,[715,809,860,972,1094,1293,1426,1566,1723]],[220,[738,837,893,999,1127,1332,1466,1614,1773]],[240,[762,864,926,1036,1160,1378,1517,1666,1835]],[260,[785,888,955,1067,1191,1427,1568,1725,1900]],[280,[809,918,987,1098,1224,1458,1602,1763,1941]],[300,[839,949,1021,1131,1260,1499,1651,1817,1995]],[320,[859,972,1050,1168,1293,1543,1694,1864,2051]],[340,[882,1001,1083,1201,1322,1579,1740,1912,2102]],[360,[906,1029,1114,1237,1357,1628,1790,1966,2164]],[380,[932,1040,1150,1268,1392,1651,1817,1998,2199]],[400,[955,1086,1178,1301,1427,1713,1885,2070,2277]],[420,[980,1106,1212,1334,1456,1751,1922,2115,2327]],[440,[1001,1127,1243,1368,1491,1790,1966,2164,2380]],[460,[1032,1168,1271,1402,1525,1833,2018,2218,2440]],[480,[1050,1191,1303,1432,1560,1877,2062,2269,2496]],[500,[1074,1217,1339,1469,1591,1902,2094,2303,2532]]];
const HARDHOUT = [[100,[622,700,743,846,976,1142,1256,1383,1521]],[120,[651,733,772,878,1010,1189,1310,1439,1585]],[140,[674,762,806,908,1041,1232,1353,1490,1639]],[160,[698,794,840,946,1081,1275,1399,1541,1696]],[180,[723,816,875,981,1121,1316,1448,1592,1749]],[200,[752,851,903,1021,1148,1328,1496,1644,1804]],[220,[775,878,937,1049,1183,1399,1541,1696,1864]],[240,[799,908,972,1088,1217,1448,1592,1749,1928]],[260,[825,932,1002,1121,1252,1498,1646,1812,1995]],[280,[851,965,1039,1153,1285,1532,1683,1853,2037]],[300,[882,996,1072,1189,1323,1574,1734,1909,2094]],[320,[902,1021,1103,1225,1357,1620,1779,1958,2154]],[340,[926,1051,1137,1261,1388,1659,1826,2008,2208]],[360,[950,1081,1169,1299,1426,1708,1879,2066,2272]],[380,[979,1091,1206,1332,1461,1734,1909,2098,2308]],[400,[1002,1140,1237,1366,1498,1799,1978,2174,2390]],[420,[1029,1161,1271,1402,1528,1838,2020,2222,2443]]];
const BOVENKAP_BREEDTE = [100,120,140,160,180,200,220,240,260,280,300,320,340,360,380,400,420,440,460,480,500,520,540,560,580,600,620,640,660,680,700];
const BOVENKAP_HARDHOUT = [122,127,139,149,157,163,175,188,195,200,205,213,220,229,236,246,254,264,272,282,293,304,316,330,341,354,367,379,392,403,419];
const BOVENKAP_ALU = [185,190,213,229,242,252,268,284,300,307,315,327,340,351,364,379,391,406,418,430,450,465,481,496,507,522,536,547,558,574,588];
const ZIJKAP_HARDHOUT = [105,110,117,124,134,145,177,197,216];
const ZIJKAP_ALU = [132,156,165,174,184,199,216,228,242];

const BEDIENING = {
  'Handbediend': { excl: 0, label: 'Handbediend (koord): geen motor nodig' },
  'Draaischakelaar': { excl: 330, label: 'Draaischakelaar (Somfy LT motor): vaste schakelaar aan de muur' },
  'Motor + afstandsbediening': { excl: 495, label: 'Motor + afstandsbediening (Somfy IO): bedien uw markies elektrisch met afstandsbediening' },
  'Brel Solar motor': { excl: 565, label: 'Brel Solar motor: draadloze motor op zonne-energie' },
  'Somfy IO motor Solar': { excl: 665, label: 'Somfy Solar motor: draadloze motor op zonne-energie met afstandsbediening' },
};

// ============ LOOKUP FUNCTIES ============

function lookupMarkies(tabel, breedteMM, uitvalMM) {
  const breed = Math.ceil(breedteMM / 10), uitv = Math.ceil(uitvalMM / 10);
  let row = tabel[tabel.length - 1][1];
  for (const [b, p] of tabel) { if (b >= breed) { row = p; break; } }
  let idx = UITVAL_COLS.length - 1;
  for (let i = 0; i < UITVAL_COLS.length; i++) { if (UITVAL_COLS[i] >= uitv) { idx = i; break; } }
  return row[idx];
}
function lookupBovenkap(breedteMM, alu) {
  const breed = Math.ceil(breedteMM / 10);
  let idx = BOVENKAP_BREEDTE.length - 1;
  for (let i = 0; i < BOVENKAP_BREEDTE.length; i++) { if (BOVENKAP_BREEDTE[i] >= breed) { idx = i; break; } }
  return alu ? BOVENKAP_ALU[idx] : BOVENKAP_HARDHOUT[idx];
}
function lookupZijkap(uitvalMM, alu) {
  const uitv = Math.ceil(uitvalMM / 10);
  let idx = UITVAL_COLS.length - 1;
  for (let i = 0; i < UITVAL_COLS.length; i++) { if (UITVAL_COLS[i] >= uitv) { idx = i; break; } }
  return alu ? ZIJKAP_ALU[idx] : ZIJKAP_HARDHOUT[idx];
}
function getTabel(mat) { return mat === 'Aluminium' ? ALUMINIUM : mat === 'Hardhout' ? HARDHOUT : GRENEN; }
function getMatLabel(mat) { return mat === 'Aluminium' ? 'aluminium' : mat === 'Hardhout' ? 'hardhouten' : 'grenenhouten'; }
function totaalExcl(mat, breedteMM, uitvalMM) {
  const alu = mat === 'Aluminium';
  return lookupMarkies(getTabel(mat), breedteMM, uitvalMM) + lookupBovenkap(breedteMM, alu) + (uitvalMM > 0 ? lookupZijkap(uitvalMM, alu) : 0);
}

// ============ OPTIES BLOK ============

function buildOptiesBlok(bediening, materiaal, breedteMM, uitvalMM) {
  let t = '**Opties (op aanvraag toe te voegen)**\n\n';

  const huidigTotaal = totaalExcl(materiaal, breedteMM, uitvalMM);
  const matOpties = [
    { key: 'Grenen', label: 'Grenenhouten kap: klassieke uitstraling' },
    { key: 'Hardhout', label: 'Hardhouten kap (meranti): duurzamer hout met langere levensduur' },
    { key: 'Aluminium', label: 'Aluminium kap: onderhoudsvrij, leverbaar in 8 standaard RAL kleuren' },
  ].filter(o => !(materiaal === 'Hout' || materiaal === 'Grenen' ? o.key === 'Grenen' : materiaal === o.key));

  if (matOpties.length > 0) {
    t += 'Materiaal kap:\n';
    for (const opt of matOpties) {
      const verschil = Math.round((totaalExcl(opt.key, breedteMM, uitvalMM) - huidigTotaal) * 1.21);
      t += '- ' + opt.label + ' — ' + (verschil >= 0 ? '+€' + verschil : '-€' + Math.abs(verschil)) + '\n';
    }
  }

  const huidigBed = BEDIENING[bediening]?.excl || 0;
  const anderen = Object.entries(BEDIENING).filter(([k]) => k !== bediening);
  if (anderen.length > 0) {
    t += '\nBediening (alternatief voor uw huidige keuze):\n';
    for (const [, info] of anderen) {
      const verschil = Math.round((info.excl - huidigBed) * 1.21);
      t += '- ' + info.label + ' — ' + (verschil >= 0 ? '+€' + verschil : '-€' + Math.abs(verschil)) + '\n';
    }
  }

  t += '\nExtra opties:\n';
  t += '- Stormstrook: extra doekstrook die het raam beschermt als de markies is ingeklapt — +€67\n';
  const tussenAanbevolen = (materiaal === 'Aluminium' && breedteMM > 4400) || (materiaal !== 'Aluminium' && breedteMM > 3000);
  t += '- Tussenpoot: extra steunpoot in het midden' + (tussenAanbevolen ? ' (aanbevolen bij uw breedte)' : '') + ' — +€194\n';
  t += '- Niet-standaard RAL kleur — +10%\n';
  t += '- Premium doekcollectie: Swela/Sunvas (+15%), Dickson MAX (+20%), Sattler Lumera (+5%)\n';
  t += '- Koord onderlangs i.p.v. bovenlangs — +€48\n';
  t += '- Spots/verlichting: dimbare inbouwspots — vanaf €847';
  return t;
}

// ============ MAIN ============

async function main() {
  const now = new Date();
  if (now.getDay() === 0 || now.getHours() < 9 || now.getHours() >= 18) {
    console.log('[' + now.toISOString().substring(11, 19) + '] Buiten kantooruren, skip');
    return;
  }
  console.log('[' + now.toISOString().substring(11, 19) + '] Markiezen start');

  const itemsData = await rpGet('/contact-service/' + PID + '/backlogs/' + BACKLOG_ID + '/items');
  const items = (itemsData?.items || []).filter(i =>
    i.status_id === HANDMATIG &&
    !i.technical_labels?.some(l => l.type === 'ITEM_ARCHIVED') &&
    (i.description || '').includes('Markiezen:')
  );

  console.log('Markiezen in Handmatige controle: ' + items.length);
  if (items.length === 0) return;

  const baseLine = { imageUri: null, vatPercentage: 21, discount: null, lockTotalPrice: false };
  const backupDir = path.join(__dirname, '../data/offerte-backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  let processed = 0, errors = 0;

  for (const item of items) {
    try {
      const desc = item.description || '';
      const lcId = item.item_subject?.id;
      if (!lcId) continue;

      const docData = await rpGet('/document-service/v1/' + PID + '/quotations?lead_configuration_id=' + lcId);
      const docs = (docData?.quotationDatas || []);
      docs.sort((a, b) => (b.quotationCreationTimestamp || 0) - (a.quotationCreationTimestamp || 0));
      if (!docs[0]) continue;

      const docId = docs[0].documentId;
      const full = await rpGet('/document-service/v1/' + PID + '/quotations/' + docId);
      const qd = full.quotationData;

      // Backup
      const backupFile = path.join(backupDir, docs[0].quotationNumber + '.json');
      if (!fs.existsSync(backupFile)) {
        fs.writeFileSync(backupFile, JSON.stringify({ quotationNumber: docs[0].quotationNumber, name: item.summary, timestamp: new Date().toISOString(), lines: JSON.parse(JSON.stringify(qd.segments.defaultTemplatePriceLineGroup.data.lines)) }, null, 2));
      }

      // Parse markiezen
      const markiezen = [];
      let cur = null;
      for (const line of desc.split('\n')) {
        const mm = line.match(/(\d+)x Markiezen/);
        if (mm) { if (cur) markiezen.push(cur); cur = { units: parseInt(mm[1]), materiaal: '', breedte: 0, uitval: 0, bediening: 'Handbediend', framekleur: '', doekkleur: '' }; }
        if (cur) {
          const m1 = line.match(/kies_materiaal: (.+)/); if (m1) cur.materiaal = m1[1].trim();
          const m2 = line.match(/breedte: ([\d.]+)/); if (m2) cur.breedte = parseFloat(m2[1]);
          const m3 = line.match(/uitval: (\d+)/); if (m3) cur.uitval = parseInt(m3[1]);
          const m4 = line.match(/welk_type_bediening_wil_je\?: (.+)/); if (m4) cur.bediening = m4[1].trim();
          const m5 = line.match(/framekleur: (.+)/); if (m5) cur.framekleur = m5[1].trim();
          const m6 = line.match(/doekkleur: (.+)/); if (m6) cur.doekkleur = m6[1].trim();
        }
      }
      if (cur) markiezen.push(cur);
      if (markiezen.length === 0) continue;

      // Bouw markies-regels — BEHOUD bestaande niet-markies regels
      const existingLines = qd.segments.defaultTemplatePriceLineGroup.data.lines;

      // Scheid bestaande regels: niet-markies behouden, markies-regels (€0) + markies-montage verwijderen
      const keepLines = existingLines.filter(l => {
        const fl = (l.description?.split('\n')[0] || '').toLowerCase();
        // Verwijder: markies €0 regels, markies montage, oude markies opties
        if (fl.includes('markies') && l.pricePerUnit === 0 && l.units <= 1) return false;
        if (fl.includes('montage markies')) return false;
        if (fl.includes('opties (op aanvraag') || fl.includes('opties (niet inbegrepen')) return false;
        return true;
      });

      const markiesLines = [];
      let totalMontages = 0;

      for (const mk of markiezen) {
        if (mk.breedte <= 0) continue;
        const alu = mk.materiaal === 'Aluminium';
        const markiesExcl = lookupMarkies(getTabel(mk.materiaal), mk.breedte, mk.uitval);
        const bedExcl = BEDIENING[mk.bediening]?.excl || 0;
        const bovenkExcl = lookupBovenkap(mk.breedte, alu);
        const zijkExcl = mk.uitval > 0 ? lookupZijkap(mk.uitval, alu) : 0;
        const totaalIncl = Math.round((markiesExcl + bedExcl + bovenkExcl + zijkExcl) * 1.21 * 100) / 100;

        let bedDesc = '';
        if (mk.bediening === 'Handbediend') bedDesc = 'Handbediend (koord bovenlangs)';
        else if (mk.bediening === 'Motor + afstandsbediening') bedDesc = 'Elektrisch (Somfy IO motor met afstandsbediening)';
        else if (mk.bediening.includes('Solar') || mk.bediening.includes('Brel')) bedDesc = 'Elektrisch solar (draadloze motor op zonne-energie met afstandsbediening)';
        else if (mk.bediening === 'Draaischakelaar') bedDesc = 'Elektrisch (Somfy LT motor met draaischakelaar)';
        else bedDesc = mk.bediening;

        let d = '**Markies ' + getMatLabel(mk.materiaal) + ' kap**\n';
        d += 'Breedte: ' + Math.round(mk.breedte) + ' mm\n';
        if (mk.uitval > 0) d += 'Uitval: ' + mk.uitval + ' mm\n';
        d += 'Frame kleur: ' + (mk.framekleur || 'naar keuze') + '\n';
        d += 'Kleur doek: ' + (mk.doekkleur || 'naar keuze') + '\n';
        d += 'Bediening: ' + bedDesc + '\n';
        d += '\nInclusief:\n';
        d += '- ' + (alu ? 'Aluminium' : 'Houten') + ' bovenkap (recht 25cm diep)\n';
        d += '- Zijkappen (set van 2, ' + (alu ? 'aluminium recht 20cm' : 'hardhout recht 22cm') + ')\n';
        d += '- Koord met RVS katrollen en koordkikker\n- PVC afbiesband in kleur\n- Slijtlat\n';
        d += '- Doek uit de standaard collectie (Tibelly/Dickson/Sattler/Citel)\n';
        d += '- Volant (schulp, recht of recht met inkam)\n- Scharnieren in kleur\n';
        if (bedExcl > 0) {
          if (mk.bediening === 'Motor + afstandsbediening') d += '- Somfy IO motor met afstandsbediening\n';
          else if (mk.bediening === 'Draaischakelaar') d += '- Somfy LT motor met draaischakelaar\n';
          else d += '- ' + mk.bediening + '\n';
        }
        // Garantiebeleid Daimy 2026-07-16: 3 jaar montage, 5 jaar product, 7 jaar motor
        d += '\nGarantie:\n- 3 jaar op de montage\n- 5 jaar op het product\n';
        if (bedExcl > 0) d += '- 7 jaar op de motor';

        markiesLines.push({ ...baseLine, units: mk.units, pricePerUnit: totaalIncl, position: 0, description: d });
        totalMontages += mk.units;
      }

      // Montage markies
      markiesLines.push({ ...baseLine, units: totalMontages, pricePerUnit: 275, position: 0, description: '**Inmeten + montage markies**\n- Inmeetafspraak bij u thuis\n- Professionele montage door ons eigen montageteam\n- Klein materiaal en bevestiging\n- Verwerken verpakkingsmateriaal' });

      // Opties
      const mk0 = markiezen[0];
      markiesLines.push({ ...baseLine, units: 0, pricePerUnit: 0, position: 0, description: buildOptiesBlok(mk0.bediening, mk0.materiaal, mk0.breedte, mk0.uitval) });

      // Combineer: bestaande producten + markies-regels
      const combinedLines = [...keepLines, ...markiesLines];
      // Herpositioneer
      combinedLines.forEach((l, i) => l.position = i);

      // Update offerte
      qd.segments.defaultTemplatePriceLineGroup.data.lines = combinedLines;
      // Korting: alleen zetten als er nog geen korting is
      if (!qd.segments.defaultTemplatePriceLineGroup.data.groupDiscount?.amount) {
        qd.segments.defaultTemplatePriceLineGroup.data.groupDiscount = { type: 'PERCENTAGE', amount: 15, name: '15% tijdelijke actie' };
      }

      // Waarom Sonty
      let hasSonty = false;
      for (const seg of Object.values(qd.segments || {})) {
        if (seg?.type === 'text' && typeof seg.data === 'string' && seg.data.includes('Waarom Sonty')) hasSonty = true;
      }
      if (!hasSonty) {
        const textId = crypto.randomUUID();
        qd.segments[textId] = { type: 'text', data: WAAROM_SONTY };
        const sigIdx = (qd.renderRows || []).findIndex(r => r.columns?.some(c => c.elements?.some(e => e.type === 'signature' || e.type === 'userDecline')));
        const insertAt = sigIdx >= 0 ? sigIdx : qd.renderRows.length;
        qd.renderRows.splice(insertAt, 0,
          { delegateMargins: false, widths: [100], columns: [{ elements: [{ type: 'empty', target: '2lh' }] }] },
          { delegateMargins: false, widths: [100], columns: [{ elements: [{ type: 'text', target: textId }] }] },
          { delegateMargins: false, widths: [100], columns: [{ elements: [{ type: 'empty', target: '2lh' }] }] }
        );
      }

      // Opslaan
      const saveRes = await fetchRetry('https://backend.reuzenpanda.nl/document-service/v1/' + PID + '/quotations/' + docId, {
        method: 'PUT', headers: { 'Authorization': 'Bearer ' + RP_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(qd),
      });

      if (!saveRes.ok) { errors++; console.log('  FAIL opslaan: ' + item.summary); continue; }

      // Verificatie
      const verify = await rpGet('/document-service/v1/' + PID + '/quotations/' + docId);
      const vLines = verify.quotationData.segments.defaultTemplatePriceLineGroup.data.lines;
      let checkOk = true;
      for (const vl of vLines) {
        if (vl.pricePerUnit > 0 && !vl.description.startsWith('**')) checkOk = false;
      }
      if (!verify.quotationData.segments.defaultTemplatePriceLineGroup.data.groupDiscount?.amount) checkOk = false;

      if (!checkOk) {
        console.log('  ⚠️ Verificatie FAIL: ' + item.summary);
        errors++;
        continue;
      }

      // Status → Gecontroleerd
      await setStatus(item.id, GECONTROLEERD);
      processed++;
      console.log('  ✅ ' + item.summary + ' → Gecontroleerd');

    } catch (e) {
      console.log('  ERROR ' + item.summary + ': ' + (e.cause?.code || e.message)?.substring(0, 80));
      errors++;
    }
  }

  console.log('Klaar: ' + processed + ' verwerkt, ' + errors + ' fouten');

  if (processed > 0 || errors > 0) {
    await sendTelegram('Markiezen: ' + processed + ' offerte(s) opgebouwd' + (errors > 0 ? ', ' + errors + ' fouten' : '') + ' → Gecontroleerd');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
