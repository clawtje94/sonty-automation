#!/usr/bin/env node
/**
 * Offerte controle v4 — v3 + upgrade/downgrade opties
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

// === V4: Sunmaster prijzen + upgrade/downgrade ===
const SUNMASTER_PRICES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'sunmaster-prices-2026.json'), 'utf8'));
const MARKUP = 1.10;

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
const TRENGO_EMAIL_CHANNEL = 1363384; // Aanvragen (aanvragen@sonty.nl)
const BOOKINGS_URL = 'https://bookings.cloud.microsoft/book/SontyMontage1@sontymontage.nl/s/lAKws2wHtEOFjHYzLwjXdQ2?ismsaljsauthenabled=true';
const TEVER_SENT_FILE = path.join(__dirname, '.tever-sent.json');
const SONTY_LAT = 52.0446, SONTY_LON = 4.3188;

// Verkoopteksten aan/uit — zet op false om alleen technische aanpassingen te doen
const ENHANCE_DESCRIPTIONS = true; // Goedgekeurde teksten (test offerte #20266838, 2026-06-10)

// ============ MARKIEZEN PRIJSTABELLEN (excl BTW = verkoopprijs) ============

const MK_UITVAL_COLS = [80,90,100,115,135,150,165,180,200];
const MK_GRENEN = [[100,[593,667,708,805,929,1088,1196,1317,1448]],[120,[619,698,734,837,963,1131,1247,1371,1510]],[140,[642,726,767,864,990,1173,1289,1419,1560]],[160,[665,757,800,901,1029,1214,1332,1466,1614]],[180,[690,777,835,934,1060,1253,1378,1517,1666]],[200,[715,809,860,972,1094,1293,1426,1566,1723]],[220,[738,837,893,999,1127,1332,1466,1614,1773]],[240,[762,864,926,1036,1160,1378,1517,1666,1835]],[260,[785,888,955,1067,1191,1427,1568,1725,1900]],[280,[809,918,988,1098,1224,1458,1602,1763,1941]],[300,[839,949,1021,1131,1260,1499,1651,1817,1995]],[320,[859,972,1050,1168,1293,1543,1694,1864,2051]],[340,[882,1001,1083,1201,1322,1579,1740,1912,2102]],[360,[906,1029,1114,1237,1357,1628,1790,1966,2164]],[380,[932,1040,1150,1268,1392,1651,1817,1998,2199]],[400,[955,1086,1178,1301,1427,1713,1885,2070,2277]],[420,[980,1106,1212,1334,1456,1751,1922,2115,2327]]];
const MK_ALUMINIUM = [[100,[593,667,708,805,929,1088,1196,1317,1448]],[120,[619,698,734,837,963,1131,1247,1371,1510]],[140,[642,726,767,864,990,1173,1289,1419,1560]],[160,[665,757,800,901,1052,1214,1332,1466,1614]],[180,[690,777,835,934,1071,1253,1378,1525,1666]],[200,[715,809,860,972,1094,1293,1426,1566,1723]],[220,[738,837,893,999,1127,1332,1466,1614,1773]],[240,[762,864,926,1036,1160,1378,1517,1666,1835]],[260,[785,888,955,1067,1191,1427,1568,1725,1900]],[280,[809,918,987,1098,1224,1458,1602,1763,1941]],[300,[839,949,1021,1131,1260,1499,1651,1817,1995]],[320,[859,972,1050,1168,1293,1543,1694,1864,2051]],[340,[882,1001,1083,1201,1322,1579,1740,1912,2102]],[360,[906,1029,1114,1237,1357,1628,1790,1966,2164]],[380,[932,1040,1150,1268,1392,1651,1817,1998,2199]],[400,[955,1086,1178,1301,1427,1713,1885,2070,2277]],[420,[980,1106,1212,1334,1456,1751,1922,2115,2327]],[440,[1001,1127,1243,1368,1491,1790,1966,2164,2380]],[460,[1032,1168,1271,1402,1525,1833,2018,2218,2440]],[480,[1050,1191,1303,1432,1560,1877,2062,2269,2496]],[500,[1074,1217,1339,1469,1591,1902,2094,2303,2532]]];
const MK_HARDHOUT = [[100,[622,700,743,846,976,1142,1256,1383,1521]],[120,[651,733,772,878,1010,1189,1310,1439,1585]],[140,[674,762,806,908,1041,1232,1353,1490,1639]],[160,[698,794,840,946,1081,1275,1399,1541,1696]],[180,[723,816,875,981,1121,1316,1448,1592,1749]],[200,[752,851,903,1021,1148,1328,1496,1644,1804]],[220,[775,878,937,1049,1183,1399,1541,1696,1864]],[240,[799,908,972,1088,1217,1448,1592,1749,1928]],[260,[825,932,1002,1121,1252,1498,1646,1812,1995]],[280,[851,965,1039,1153,1285,1532,1683,1853,2037]],[300,[882,996,1072,1189,1323,1574,1734,1909,2094]],[320,[902,1021,1103,1225,1357,1620,1779,1958,2154]],[340,[926,1051,1137,1261,1388,1659,1826,2008,2208]],[360,[950,1081,1169,1299,1426,1708,1879,2066,2272]],[380,[979,1091,1206,1332,1461,1734,1909,2098,2308]],[400,[1002,1140,1237,1366,1498,1799,1978,2174,2390]],[420,[1029,1161,1271,1402,1528,1838,2020,2222,2443]]];
const MK_BOVENKAP_B = [100,120,140,160,180,200,220,240,260,280,300,320,340,360,380,400,420,440,460,480,500,520,540,560,580,600,620,640,660,680,700];
const MK_BOVENKAP_HARDHOUT = [122,127,139,149,157,163,175,188,195,200,205,213,220,229,236,246,254,264,272,282,293,304,316,330,341,354,367,379,392,403,419];
const MK_BOVENKAP_ALU = [185,190,213,229,242,252,268,284,300,307,315,327,340,351,364,379,391,406,418,430,450,465,481,496,507,522,536,547,558,574,588];
const MK_ZIJKAP_HARDHOUT = [105,110,117,124,134,145,177,197,216];
const MK_ZIJKAP_ALU = [132,156,165,174,184,199,216,228,242];
const MK_BEDIENING = {
  'Handbediend': { excl: 0, label: 'Handbediend (koord): geen motor nodig' },
  'Draaischakelaar': { excl: 330, label: 'Draaischakelaar (Somfy LT motor): vaste schakelaar aan de muur' },
  'Motor + afstandsbediening': { excl: 495, label: 'Motor + afstandsbediening (Somfy IO): bedien je markies elektrisch' },
  'Brel Solar motor': { excl: 565, label: 'Brel Solar motor: draadloze motor op zonne-energie' },
  'Somfy IO motor Solar': { excl: 665, label: 'Somfy Solar motor: draadloze motor op zonne-energie met afstandsbediening' },
};

function mkLookupMarkies(tabel, breedteMM, uitvalMM) {
  const breed = Math.ceil(breedteMM / 10), uitv = Math.ceil(uitvalMM / 10);
  // Boven tabelbereik → null (geen stille fallback naar grootste maat) → handmatige controle
  if (breed > tabel[tabel.length - 1][0]) return null;
  if (uitv > MK_UITVAL_COLS[MK_UITVAL_COLS.length - 1]) return null;
  let row = tabel[tabel.length - 1][1];
  for (const [b, p] of tabel) { if (b >= breed) { row = p; break; } }
  let idx = MK_UITVAL_COLS.length - 1;
  for (let i = 0; i < MK_UITVAL_COLS.length; i++) { if (MK_UITVAL_COLS[i] >= uitv) { idx = i; break; } }
  return row[idx];
}
function mkLookupBovenkap(breedteMM, alu) {
  const breed = Math.ceil(breedteMM / 10);
  if (breed > MK_BOVENKAP_B[MK_BOVENKAP_B.length - 1]) return null; // boven tabelbereik → handmatig
  let idx = MK_BOVENKAP_B.length - 1;
  for (let i = 0; i < MK_BOVENKAP_B.length; i++) { if (MK_BOVENKAP_B[i] >= breed) { idx = i; break; } }
  return alu ? MK_BOVENKAP_ALU[idx] : MK_BOVENKAP_HARDHOUT[idx];
}
function mkLookupZijkap(uitvalMM, alu) {
  const uitv = Math.ceil(uitvalMM / 10);
  if (uitv > MK_UITVAL_COLS[MK_UITVAL_COLS.length - 1]) return null; // boven tabelbereik → handmatig
  let idx = MK_UITVAL_COLS.length - 1;
  for (let i = 0; i < MK_UITVAL_COLS.length; i++) { if (MK_UITVAL_COLS[i] >= uitv) { idx = i; break; } }
  return alu ? MK_ZIJKAP_ALU[idx] : MK_ZIJKAP_HARDHOUT[idx];
}
function mkGetTabel(mat) { return mat === 'Aluminium' ? MK_ALUMINIUM : mat === 'Hardhout' ? MK_HARDHOUT : MK_GRENEN; }
function mkGetMatLabel(mat) { return mat === 'Aluminium' ? 'aluminium' : mat === 'Hardhout' ? 'hardhouten' : 'grenenhouten'; }
function mkTotaalExcl(mat, breedteMM, uitvalMM) {
  const alu = mat === 'Aluminium';
  const markies = mkLookupMarkies(mkGetTabel(mat), breedteMM, uitvalMM);
  const bovenkap = mkLookupBovenkap(breedteMM, alu);
  const zijkap = uitvalMM > 0 ? mkLookupZijkap(uitvalMM, alu) : 0;
  if (markies == null || bovenkap == null || zijkap == null) return null; // buiten tabel → handmatig
  return markies + bovenkap + zijkap;
}

function mkBuildOptiesBlok(bediening, materiaal, breedteMM, uitvalMM) {
  const lines = ['', '', '**Liever een ander materiaal of bediening?**', ''];
  const huidigTotaal = mkTotaalExcl(materiaal, breedteMM, uitvalMM);
  if (huidigTotaal == null) return ''; // buiten tabelbereik: geen optieblok (offerte gaat sowieso naar handmatig)
  const matOpties = [
    { key: 'Grenen', label: 'Grenenhouten kap: klassieke uitstraling' },
    { key: 'Hardhout', label: 'Hardhouten kap (meranti): duurzamer, langere levensduur' },
    { key: 'Aluminium', label: 'Aluminium kap: onderhoudsvrij, 8 standaard RAL kleuren' },
  ].filter(o => !(materiaal === 'Hout' || materiaal === 'Grenen' ? o.key === 'Grenen' : materiaal === o.key));
  const matRegels = [];
  for (const opt of matOpties) {
    const altTotaal = mkTotaalExcl(opt.key, breedteMM, uitvalMM);
    if (altTotaal == null) continue; // alternatief buiten tabelbereik: niet tonen
    const verschil = Math.round((altTotaal - huidigTotaal) * 1.21);
    matRegels.push('• ' + opt.label + ': ' + (verschil >= 0 ? '+€' : '-€') + Math.abs(verschil));
  }
  if (matRegels.length > 0) {
    lines.push('Ander materiaal:', ...matRegels, '');
  }
  const huidigBed = MK_BEDIENING[bediening]?.excl || 0;
  const anderen = Object.entries(MK_BEDIENING).filter(([k]) => k !== bediening);
  if (anderen.length > 0) {
    lines.push('Andere bediening:');
    for (const [, info] of anderen) {
      const verschil = Math.round((info.excl - huidigBed) * 1.21);
      lines.push('• ' + info.label + ': ' + (verschil >= 0 ? '+€' : '-€') + Math.abs(verschil));
    }
    lines.push('');
  }
  lines.push('Extra:');
  lines.push('• Stormstrook: beschermt het raam als markies ingeklapt — +€67');
  const tussenAanbevolen = (materiaal === 'Aluminium' && breedteMM > 4400) || (materiaal !== 'Aluminium' && breedteMM > 3000);
  lines.push('• Tussenpoot: steunpoot in het midden' + (tussenAanbevolen ? ' (aanbevolen bij jouw breedte)' : '') + ' — +€194');
  lines.push('• Niet-standaard RAL kleur — +10%');
  lines.push('• Koord onderlangs i.p.v. bovenlangs — +€48');
  lines.push('• Spots/verlichting — vanaf €847');
  lines.push('');
  lines.push('Laat het ons weten, we passen je offerte graag aan.');
  return lines.join('\n');
}

// Match bediening case-insensitief tegen MK_BEDIENING keys (configurator kan afwijkende hoofdletters sturen)
function mkFindBediening(str) {
  if (!str) return null;
  const norm = str.trim().toLowerCase();
  for (const k of Object.keys(MK_BEDIENING)) { if (k.toLowerCase() === norm) return k; }
  return null;
}
const MK_MATERIALEN = ['Grenen', 'Hout', 'Hardhout', 'Aluminium'];

// Retourneert { lines, issues }: issues niet-leeg → offerte NIET automatisch verwerken (→ handmatige controle)
function processMarkiezen(desc, existingLines) {
  const markiezen = [];
  let cur = null;
  for (const line of desc.split('\n')) {
    const mm = line.match(/(\d+)x markiezen/i);
    if (mm) { if (cur) markiezen.push(cur); cur = { units: parseInt(mm[1]), materiaal: '', breedte: 0, uitval: 0, bediening: '', framekleur: '', doekkleur: '' }; }
    if (cur) {
      const m1 = line.match(/kies_materiaal:\s*(.+)/i); if (m1) cur.materiaal = m1[1].trim();
      const m2 = line.match(/breedte:\s*([\d.]+)/i); if (m2) cur.breedte = parseFloat(m2[1]);
      const m3 = line.match(/uitval:\s*(\d+)/i); if (m3) cur.uitval = parseInt(m3[1]);
      const m4 = line.match(/welk_type_bediening_wil_je\?:\s*(.+)/i); if (m4) cur.bediening = m4[1].trim();
      const m5 = line.match(/framekleur:\s*(.+)/i); if (m5) cur.framekleur = m5[1].trim();
      const m6 = line.match(/doekkleur:\s*(.+)/i); if (m6) cur.doekkleur = m6[1].trim();
    }
  }
  if (cur) markiezen.push(cur);
  if (markiezen.length === 0) return { lines: null, issues: [] };

  // Validatie: ontbrekende/onbekende velden of maten buiten tabel → NIET verzinnen, naar handmatige controle
  const issues = [];
  markiezen.forEach((mk, i) => {
    const nr = 'markies ' + (i + 1);
    if (mk.breedte <= 0) issues.push(nr + ': breedte ontbreekt');
    if (mk.uitval <= 0) issues.push(nr + ': uitval ontbreekt');
    const matKey = MK_MATERIALEN.find(m => m.toLowerCase() === (mk.materiaal || '').toLowerCase());
    if (!mk.materiaal) issues.push(nr + ': materiaal ontbreekt');
    else if (!matKey) issues.push(nr + ': onbekend materiaal "' + mk.materiaal + '"');
    else mk.materiaal = matKey; // normaliseer naar canonieke naam (mkGetTabel/alu-check zijn case-sensitief)
    const bedKey = mkFindBediening(mk.bediening);
    if (!bedKey) issues.push(nr + ': ' + (mk.bediening ? 'onbekende bediening "' + mk.bediening + '"' : 'bediening ontbreekt'));
    else mk.bediening = bedKey; // normaliseer naar exacte MK_BEDIENING key
    if (mk.breedte > 0 && mk.uitval > 0 && mk.materiaal && mkTotaalExcl(mk.materiaal, mk.breedte, mk.uitval) == null) {
      issues.push(nr + ': maat ' + mk.breedte + '×' + mk.uitval + 'mm buiten prijstabel');
    }
  });
  if (issues.length > 0) return { lines: null, issues };

  const baseLine = { imageUri: null, vatPercentage: 21, discount: null, lockTotalPrice: false };
  // Behoud niet-markies regels. ALLE bestaande markiesregels (ook geprijsde of units>1) worden
  // vervangen door de hieronder opgebouwde regels — anders staat het markies dubbel in de offerte.
  const keepLines = existingLines.filter(l => {
    const fl = (l.description?.split('\n')[0] || '').toLowerCase();
    if (fl.includes('markies')) return false; // incl. 'montage markies' en eerder opgebouwde markiesregels
    if (fl.includes('opties (op aanvraag') || fl.includes('opties (niet inbegrepen')) return false;
    return true;
  });

  const markiesLines = [];
  let totalMontages = 0;
  for (const mk of markiezen) {
    const alu = mk.materiaal === 'Aluminium';
    const markiesExcl = mkLookupMarkies(mkGetTabel(mk.materiaal), mk.breedte, mk.uitval);
    const bedExcl = MK_BEDIENING[mk.bediening]?.excl || 0;
    const bovenkExcl = mkLookupBovenkap(mk.breedte, alu);
    const zijkExcl = mk.uitval > 0 ? mkLookupZijkap(mk.uitval, alu) : 0;
    const totaalIncl = Math.round((markiesExcl + bedExcl + bovenkExcl + zijkExcl) * 1.21 * 100) / 100;

    let bedDesc = mk.bediening === 'Handbediend' ? 'Handbediend (koord bovenlangs)' :
      mk.bediening === 'Motor + afstandsbediening' ? 'Elektrisch (Somfy IO motor met afstandsbediening)' :
      mk.bediening === 'Draaischakelaar' ? 'Elektrisch (Somfy LT motor met draaischakelaar)' :
      mk.bediening.includes('Solar') || mk.bediening.includes('Brel') ? 'Elektrisch solar (draadloze motor op zonne-energie)' : mk.bediening;

    let d = '**Markies ' + mkGetMatLabel(mk.materiaal) + ' kap**\n';
    d += 'Breedte: ' + Math.round(mk.breedte) + ' mm\n';
    if (mk.uitval > 0) d += 'Uitval: ' + mk.uitval + ' mm\n';
    d += 'Frame kleur: ' + (mk.framekleur || 'naar keuze') + '\n';
    d += 'Kleur doek: ' + (mk.doekkleur || 'naar keuze') + '\n';
    d += 'Bediening: ' + bedDesc + '\n';
    d += '\nInclusief:\n';
    d += '- ' + (alu ? 'Aluminium' : 'Houten') + ' bovenkap (recht 25cm diep)\n';
    d += '- Zijkappen (set van 2, ' + (alu ? 'aluminium recht 20cm' : 'hardhout recht 22cm') + ')\n';
    d += '- Koord met RVS katrollen en koordkikker\n- PVC afbiesband in kleur\n- Slijtlat\n';
    d += '- Doek uit de standaard collectie\n';
    d += '- Volant (schulp, recht of recht met inkam)\n- Scharnieren in kleur\n';
    if (bedExcl > 0) {
      if (mk.bediening === 'Motor + afstandsbediening') d += '- Somfy IO motor met afstandsbediening\n';
      else if (mk.bediening === 'Draaischakelaar') d += '- Somfy LT motor met draaischakelaar\n';
      else d += '- ' + mk.bediening + '\n';
    }
    d += '\nGarantie: 2 jaar montage | 3 jaar product';
    if (bedExcl > 0) d += ' | 5 jaar motor';
    d += mkBuildOptiesBlok(mk.bediening, mk.materiaal, mk.breedte, mk.uitval);

    markiesLines.push({ ...baseLine, units: mk.units, pricePerUnit: totaalIncl, position: 0, description: d });
    totalMontages += mk.units;
  }

  markiesLines.push({ ...baseLine, units: totalMontages, pricePerUnit: 275, position: 0, description: '**Inmeten + montage markies**\n- Inmeetafspraak bij je thuis\n- Professionele montage door ons eigen montageteam\n- Klein materiaal en bevestiging\n- Verwerken verpakkingsmateriaal' });

  const combined = [...keepLines, ...markiesLines];
  combined.forEach((l, i) => l.position = i);
  return { lines: combined, issues: [] };
}

// ============ API HELPERS ============

// Fetch met retry voor tijdelijke netwerkfouten (ECONNRESET etc.) — max 3 pogingen
async function fetchRetry(url, options, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      return await fetch(url, options);
    } catch (e) {
      if (i === tries) throw e;
      console.log('  (netwerkfout, poging ' + (i + 1) + '/' + tries + ' over ' + (i * 5) + 's: ' + (e.cause?.code || e.message) + ')');
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

async function rpPatch(ep, body) {
  const res = await fetchRetry('https://backend.reuzenpanda.nl' + ep, {
    method: 'PATCH', headers: { 'Authorization': 'Bearer ' + RP_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.ok;
}

async function setStatus(itemId, statusId) {
  return rpPatch('/contact-service/' + PID + '/backlogs/' + BACKLOG_ID + '/items/' + itemId, { item: { status_id: statusId } });
}

// Sheets write met throttle (limiet 60/min) + retry bij 429 quota-fout
async function sheetsWrite(fn) {
  await new Promise(r => setTimeout(r, 1100));
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await fn(); }
    catch (e) {
      if (e.code === 429 || e.status === 429) {
        console.log('  Sheets 429, wacht 65s (poging ' + (attempt + 1) + ')');
        await new Promise(r => setTimeout(r, 65000));
      } else throw e;
    }
  }
  throw new Error('Sheets write bleef 429 geven na 3 pogingen');
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
  return sendEmail(email, 'Kom stoffen voelen in onze showroom - dan weet je het zeker (en krijg je direct een prijs)',
    '<p>Hi ' + voornaam + ',</p>' +
    '<p>Bedankt voor je aanvraag voor gordijnen bij Sonty!</p>' +
    '<p>Eerlijk gezegd: gordijnen kiezen op afstand werkt niet goed. En dat heeft een simpele reden - de stof bepaalt alles:</p>' +
    '<p><strong>1. Elke stof heeft een andere prijs.</strong><br>Een linnenlook, een velours of een verduisterende stof: het prijsverschil per meter is groot. Pas als jij de stof hebt gekozen, kunnen we een echte prijs maken. Een offerte zonder stofkeuze is dus altijd een slag in de lucht - en daar heb je niks aan.</p>' +
    '<p><strong>2. Kleur en stof moet je voelen, niet googlen.</strong><br>Op een beeldscherm ziet elke stof er anders uit dan in het echt. De kleur naast jouw muurverf, de val van de stof, hoeveel licht erdoor komt - dat zie je alleen met de stof in je handen.</p>' +
    '<p><strong>3. In &eacute;&eacute;n bezoek is alles geregeld.</strong><br>In onze showroom in Rijswijk staan honderden stalen: gordijnen, vitrage, pliss&eacute;s, vouwgordijnen, jaloezie&euml;n en Arte behang. Onze adviseur helpt je kiezen, rekent direct de prijs voor jouw ramen uit en plant meteen het inmeten in.</p>' +
    '<p><strong>Plan je showroombezoek in:</strong><br><a href="' + BOOKINGS_URL + '">' + BOOKINGS_URL + '</a></p>' +
    '<p>Liever gewoon binnenlopen? Dat kan ook - een afspraak is niet verplicht, maar dan weet je zeker dat er een adviseur voor je klaarzit.</p>' +
    '<p><strong>Onze showroom:</strong><br>Frijdastraat 8F, 2288 EX Rijswijk<br>Di t/m vr: 9:30 - 17:00<br>Za: 9:30 - 16:00</p>' +
    '<p>Vragen? Bel of app ons op 085 006 9681.</p>' +
    '<p>Tot snel!</p>' +
    '<p>Met vriendelijke groet,<br>Het Sonty Team</p><p>Sonty B.V.</p>',
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
  if (d.includes('rolluik') || d.includes('rollsuper') || d.includes('roll super')) return 'rolluik';
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
  if (b.includes('brel') || m.includes('brel')) return 'solarBrel';
  if (b.includes('solar') || m.includes('solar')) return 'solar';
  if (b.includes('draaischakelaar') || m.includes('somfy lt')) return 'draaischakelaar';
  if (b.includes('slingerstang') || b.includes('handbediend') || b.includes('bandbediening') || b.includes('band ')) return 'handbediend';
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

// Categorie uit de montagetitel zelf ('Inmeten + montage screen solar' → screen).
// Bij combi-offertes [product A, product B, montage A, montage B] is de titel leidend;
// lastCat is alleen fallback. 'markies' → aparte flow (processMarkiezen), niet hier prijzen.
function getMontageCategory(firstLine) {
  const d = firstLine.toLowerCase();
  if (d.includes('markies')) return 'markies';
  if (d.includes('rolluik')) return 'rolluik';
  if (d.includes('screen')) return 'screen';
  if (d.includes('knikarm')) return 'knikarmscherm';
  if (d.includes('uitvalscherm')) return 'uitvalscherm';
  if (d.includes('pergola')) return 'pergola';
  if (d.includes('serre')) return 'serre';
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

// Herorden: producten → montage → tahoma → opmerkingen
// GEEN samenvoegen — units NOOIT wijzigen, alleen volgorde aanpassen
function reorderAndMerge(lines) {
  let changed = false;
  const producten = [], montageLines = [];
  const tahomaLines = [];
  const opmerkingen = [];
  for (const l of lines) {
    const d = (l.description?.split('\n')[0] || '').toLowerCase();
    if (d.includes('tahoma')) {
      tahomaLines.push(l);
      continue;
    }
    if (d.includes('montage') || d.includes('inmeten')) {
      montageLines.push(l);
      continue;
    }
    if (l.pricePerUnit === 0 && (l.units === 0 || d.length < 5)) { opmerkingen.push(l); continue; }
    producten.push(l);
  }
  // Tahoma: altijd 1 stuk per offerte (RP voegt er meerdere toe per productgroep)
  let tahomaLine = null;
  if (tahomaLines.length > 0) {
    tahomaLine = { ...tahomaLines[0], units: 1 };
    if (tahomaLines.length > 1) changed = true;
  }
  const newLines = [...producten, ...montageLines];
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
  const isTahoma = l => (l.description?.split('\n')[0] || '').toLowerCase().includes('tahoma');
  const isProduct = l => {
    const d = (l.description?.split('\n')[0] || '').toLowerCase();
    return !d.includes('montage') && !d.includes('inmeten') && !isTahoma(l) && l.pricePerUnit > 0;
  };
  // Check 1: product count
  const origPC = origLines.filter(isProduct).length;
  const newPC = newLines.filter(isProduct).length;
  if (origPC !== newPC) errors.push('Aantal producten gewijzigd! orig: ' + origPC + ' nieuw: ' + newPC);
  // Check 2: units (excl Tahoma)
  const origTotal = origLines.filter(l => !isTahoma(l)).reduce((s, l) => s + l.units, 0);
  const newTotal = newLines.filter(l => !isTahoma(l)).reduce((s, l) => s + l.units, 0);
  if (origTotal !== newTotal) errors.push('Totaal units gewijzigd! orig: ' + origTotal + ' nieuw: ' + newTotal);
  return errors;
}

function selfCheckAndFix(origLines, newLines) {
  const isTahoma = l => (l.description?.split('\n')[0] || '').toLowerCase().includes('tahoma');

  // Ronde 1: check
  let errors = selfCheck(origLines, newLines);
  if (errors.length === 0) return { lines: newLines, errors: [], fixed: false };

  // Ronde 2: probeer te fixen
  let fixed = [...newLines];
  const fixes = [];

  // Fix: Tahoma duplicaten → dedup naar 1 met units=1
  const tahomaLines = fixed.filter(isTahoma);
  if (tahomaLines.length > 1) {
    fixed = fixed.filter(l => !isTahoma(l));
    fixed.push({ ...tahomaLines[0], units: 1 });
    fixes.push('tahoma gedesupt');
  }

  // Fix: montage units check — als montage lijnen gemerged zijn, units moeten kloppen
  const isMontage = l => {
    const d = (l.description?.split('\n')[0] || '').toLowerCase();
    return d.includes('montage') || d.includes('inmeten');
  };
  const origMontageUnits = origLines.filter(isMontage).reduce((s, l) => s + l.units, 0);
  const newMontageUnits = fixed.filter(isMontage).reduce((s, l) => s + l.units, 0);
  if (origMontageUnits !== newMontageUnits && origMontageUnits > 0) {
    // Montage units kloppen niet — herstel naar origineel totaal
    const montageLijnen = fixed.filter(isMontage);
    if (montageLijnen.length === 1 && origMontageUnits > montageLijnen[0].units) {
      montageLijnen[0].units = origMontageUnits;
      fixes.push('montage units hersteld naar ' + origMontageUnits);
    }
  }

  // Ronde 3: hercheck na fixes
  errors = selfCheck(origLines, fixed);
  if (errors.length === 0) {
    console.log('    Self-check gerepareerd: ' + fixes.join(', '));
    return { lines: fixed, errors: [], fixed: true };
  }

  // Nog steeds fout — niet fixbaar
  return { lines: newLines, errors, fixed: false };
}

// ============ VERKOOPTEKSTEN (ENHANCE) — goedgekeurd door Daimy 2026-06-10 (test offerte #20266838) ============
// REGELS: productnaam NOOIT aanpassen, originele velden NOOIT verwijderen, alleen "Waarom" blok toevoegen

const WAAROM_SONTY_TEXT = '**Waarom Sonty?**\n\n- Sunmaster Premium Dealer: wij leveren uitsluitend A-merk zonwering van de hoogste kwaliteit\n- Eigen montageteam: al onze monteurs zijn in dienst, geen onderaannemers\n- Persoonlijk advies: gratis inmeetafspraak bij je thuis\n- 3000+ tevreden klanten\n- 4.9/5.0 op Google met 600+ reviews\n- Alles uit eigen hand: van advies tot montage en nazorg';

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
    const b = ['**Waarom dit rolluik**'];
    let txt = 'Premium kwaliteit, Nederlands geproduceerd. Dubbelwandige aluminium lamellen met PU-schuim voor isolatie.';
    if (isSolar) txt += ' Op zonne-energie: geen bekabeling nodig, volledig draadloos.';
    else if (isDraai) txt += ' Somfy motor met vaste draaischakelaar op de muur.';
    else txt += ' Fluisterstille Somfy motor met afstandsbediening.';
    txt += ' Bescherming tegen inbraak, zon, warmte en kou.';
    b.push(txt);
    return b;
  }
  if (cat === 'screen') {
    const b = ['**Waarom dit screen**'];
    let txt = 'Premium kwaliteit met zip-technologie. Ritsgeleidingssysteem: doek zit vast in de geleiders, geen klapperen bij wind.';
    if (isSolar) txt += ' Op zonne-energie: geen bekabeling nodig, volledig draadloos.';
    else if (isDraai) txt += ' Somfy motor met vaste draaischakelaar op de muur.';
    else txt += ' Fluisterstille Somfy motor met afstandsbediening.';
    txt += ' Bescherming tegen zon, warmte en inkijk met behoud van uitzicht. Compacte cassette: doek en motor beschermd tegen weersinvloeden.';
    b.push(txt);
    return b;
  }
  if (cat === 'knikarmscherm') {
    const b = ['**Waarom dit knikarmscherm**'];
    let txt = '';
    if (fl.includes('sunelite')) {
      txt += 'Knikarmscherm uit het hoogste segment. Volledig gesloten cassette: doek en mechaniek maximaal beschermd.';
    } else if (fl.includes('suneye')) {
      txt += 'Premium knikarmscherm met gesloten cassette. Doek en mechaniek volledig beschermd.';
      if (fl.includes('voorraad')) txt += ' Direct leverbaar uit voorraad: snellere levertijd dan maatwerk.';
    } else {
      txt += 'Premium kwaliteit, Nederlands geproduceerd.';
    }
    txt += ' Sterke aluminium armen: lang meegaand en stabiel.';
    if (isHand) txt += ' Bediening via slingerstang aan de buitenzijde. Geen motor of elektra nodig.';
    else if (isDraai) txt += ' Somfy motor met vaste draaischakelaar op de muur.';
    else txt += ' Fluisterstille Somfy motor met afstandsbediening.';
    b.push(txt);
    return b;
  }
  if (cat === 'uitvalscherm') {
    const b = ['**Waarom dit uitvalscherm**'];
    let txt = 'Compact en stijlvol uitvalscherm.';
    if (isHand) txt += ' Bediening via slingerstang aan de buitenzijde. Geen motor of elektra nodig.';
    else if (isSolar) txt += ' Op zonne-energie: geen bekabeling nodig, volledig draadloos.';
    else if (isDraai) txt += ' Somfy motor met vaste draaischakelaar op de muur.';
    else txt += ' Fluisterstille Somfy motor met afstandsbediening.';
    txt += ' Bescherming tegen directe zonnestraling en warmte.';
    b.push(txt);
    return b;
  }
  if (cat === 'pergola') {
    return ['**Waarom deze pergola**',
      'Terrasoverkapping met waterdicht doek. Beschermd tegen zon en regen: je terras het hele jaar bruikbaar. Stevig aluminium frame: duurzaam en onderhoudsarm. Gemotoriseerd: doek in- en uitrollen met afstandsbediening.'];
  }
  if (cat === 'serre') {
    return ['**Waarom deze serre zonwering**',
      'Speciaal ontworpen voor glazen daken en serres. Houdt warmte buiten: aangenaam klimaat in je serre. Stevig aluminium frame met strakke afwerking. Fluisterstille Somfy motor met afstandsbediening.'];
  }
  return null;
}

// Voeg Waarom blok toe aan product description — origineel blijft volledig intact
function insertWaaromBlock(desc, waaromLines) {
  let lines = desc.split('\n');
  // Verwijder bestaand Waarom/Wat u krijgt blok (idempotent)
  const oldIdx = lines.findIndex(l => /^\*?\*?Waarom (dit|deze) .+\*?\*?$/.test(l.trim()) || l.trim().startsWith('Wat u krijgt'));
  if (oldIdx >= 0) {
    const garIdx = lines.findIndex((l, i) => i > oldIdx && l.trim().startsWith('Garantie'));
    lines.splice(oldIdx, garIdx >= 0 ? garIdx - oldIdx : lines.length - oldIdx);
  }
  // Zoek Garantie-regels en compacteer tot 1 regel
  const gi = lines.findIndex(l => l.trim().startsWith('Garantie'));
  let garantieTekst = '';
  if (gi >= 0) {
    // Verzamel alle garantie-items
    const garParts = [];
    let garEnd = gi + 1;
    while (garEnd < lines.length && lines[garEnd].trim().startsWith('-')) {
      garParts.push(lines[garEnd].trim().replace(/^-\s*/, ''));
      garEnd++;
    }
    // Verwijder ook eventuele lege regels na garantie
    while (garEnd < lines.length && lines[garEnd].trim() === '') garEnd++;
    garantieTekst = 'Garantie: ' + garParts.join(', ') + '.';
    lines.splice(gi, garEnd - gi);
  }
  // Voeg Waarom blok + garantie toe aan het einde
  const insertAt = lines.length;
  const block = ['', ...waaromLines];
  if (garantieTekst) block.push(garantieTekst);
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
        // V4: voeg kleur-annotatie, product-info en upgrade/downgrade opties toe
        const hasTahoma = lines.some(l => (l.description || '').toLowerCase().includes('tahoma'));
        lines[i].description = addV4Enhancements(lines[i].description, fl, hasTahoma, lines[i].pricePerUnit);
      }
    }
    if (lines[i].description !== orig) changed = true;
  }
  return changed;
}

// ============ V4: UPGRADE/DOWNGRADE OPTIES ============

function getProductKey(firstLine) {
  const d = firstLine.toLowerCase();
  if (d.includes('sunelite')) return 'sunelite';
  if (d.includes('suneye') && d.includes('xl')) return 'suneyeXL';
  if (d.includes('suneye')) return 'suneye';
  if (d.includes('sunbasic') && d.includes('cassette')) return 'sunbasicCassette';
  if (d.includes('sunbasic')) return 'sunbasic';
  if (d.includes('knikarm')) return 'suneye';
  if (d.includes('zip design') || d.includes('zip design 110')) return 'zipDesign110';
  if (d.includes('zip square') || d.includes('zip carré') || d.includes('zip carre')) return 'zipSquare85100';
  if (d.includes('rollsuper') || d.includes('roll super')) return 'rolluikS42';
  if (d.includes('rolluik') && d.includes('s-37')) return 'rolluikS37';
  if (d.includes('rolluik') && d.includes('s-42')) return 'rolluikS42';
  if (d.includes('rolluik')) return 'rolluikS42';
  if (d.includes('suncube') || d.includes('sun cube')) return 'suncube150';
  if (d.includes('sunproject')) return 'sunproject100';
  if (d.includes('pergola')) return 'suncontrolPergola';
  if (d.includes('suncontrol') && d.includes('165')) return 'suncontrol165ZIP';
  if (d.includes('suncontrol') && d.includes('150')) return 'suncontrol150';
  if (d.includes('suncontrol') || d.includes('serre') || d.includes('veranda')) return 'suncontrol165ZIP';
  if (d.includes('windvast')) return 'zipDesign110'; // "Windvast" in configurator = Zip Design 110
  if (d.includes('voorraad')) return 'zipSquare85100';
  if (d.includes('screen') || d.includes('square') || d.includes('carré') || d.includes('carre')) {
    if (d.includes('zip')) return 'zipSquare85100';
    return 'zipSquare85100';
  }
  return null;
}

function findNearest(table, key) {
  const keys = Object.keys(table).map(Number).sort((a,b) => a-b);
  for (const k of keys) { if (k >= key) return { key: k, value: table[k] }; }
  return keys.length > 0 ? { key: keys[keys.length-1], value: table[keys[keys.length-1]] } : null;
}

function lookupPrice(productKey, breedteCm, hoogteCm, uitvalCm) {
  const product = SUNMASTER_PRICES[productKey];
  if (!product) return null;
  const cat = getCategory(productKey.replace(/S37|S42|150|100|110|85100|Pergola|165ZIP/i, '').replace(/suncontrol.*/i, 'serre').replace(/suncube|sunproject/i, 'uitvalscherm').replace(/zip.*/i, 'screen').replace(/rolluik.*/i, 'rolluik').replace(/sun.*/i, 'knikarmscherm'));
  const pCat = product.category === 'zipscreen' ? 'screen' : product.category;

  if (product.tables && pCat === 'knikarmscherm') {
    const uitval = uitvalCm || 300;
    // Probeer de dichtstbijzijnde uitval, maar check of breedte beschikbaar is
    const uitvalKeys = Object.keys(product.tables).map(Number).sort((a,b) => b-a); // groot naar klein
    for (const uk of uitvalKeys) {
      if (uk > uitval) continue; // sla grotere uitvallen over
      const tbl = product.tables[String(uk)];
      const bKeys = Object.keys(tbl).map(Number);
      if (breedteCm >= Math.min(...bKeys)) {
        if (breedteCm > Math.max(...bKeys)) return null; // breder dan tabel → geen stille fallback, handmatige controle
        return findNearest(tbl, breedteCm)?.value || null;
      }
    }
    // Fallback: grootste uitval die past
    const tbl = product.tables[findNearest(product.tables, uitval)?.key];
    if (!tbl) return null;
    if (breedteCm > Math.max(...Object.keys(tbl).map(Number))) return null; // breder dan tabel → handmatige controle
    return findNearest(tbl, breedteCm)?.value || null;
  }
  if (product.tables && pCat === 'uitvalscherm') {
    // Doekmaat op basis van uitval (prijsboek p42-43, bevestigd door Daimy 2026-07-02):
    // doek 165 = uitval ≤95cm, doek 200 = uitval ≤115cm, anders doek 225.
    // Configurator biedt 950/1150/1350mm. Zonder uitval: 165 (kleinste, huidige data ≤1350mm).
    const doek = (!uitvalCm || uitvalCm <= 0) ? 165 : uitvalCm <= 95 ? 165 : uitvalCm <= 115 ? 200 : 225;
    const tbl = product.tables[findNearest(product.tables, doek)?.key];
    if (!tbl) return null;
    if (breedteCm > Math.max(...Object.keys(tbl).map(Number))) return null; // breder dan tabel → handmatige controle
    return findNearest(tbl, breedteCm)?.value || null;
  }
  if (product.tables && (pCat === 'serre' || pCat === 'pergola')) {
    // Serre/pergola tabellen: uitval in MM (2500-4500), breedte in CM (300-600)
    const uitvalMM = (uitvalCm || 300) * 10; // cm → mm voor tabel lookup
    const tbl = product.tables[findNearest(product.tables, uitvalMM)?.key];
    if (!tbl) return null;
    const maxBreedte = Math.max(...Object.keys(tbl).map(Number));
    // GEKOPPELD (pergola én serre): breder dan de tabel (>6000mm) = 2 units gekoppeld.
    // Prijs = 2× een unit van de halve breedte (bv. 9000mm = 2× 4500mm). Bevestigd door Daimy 2026-07-02.
    if (breedteCm > maxBreedte) {
      const halveBreedte = Math.ceil(breedteCm / 2);
      if (halveBreedte > maxBreedte) return null; // > 2×6000mm: niet zeker → handmatige controle
      const half = findNearest(tbl, halveBreedte)?.value;
      return half ? half * 2 : null;
    }
    return findNearest(tbl, breedteCm)?.value || null;
  }
  if (product.tableLarge || product.tableSmall) {
    // tableSmall (kleine breedtes) EERST proberen — tableLarge zou kleine maten te duur afronden.
    // Prijslijst-conventie: eerstvolgende maat OMHOOG. Breedte onder tabelminimum of in het gat
    // tussen small (t/m 180) en large (vanaf 200) rondt dus omhoog af — nooit te goedkoop.
    // Alleen breder dan de grootste tabel → null (handmatige controle).
    const b = breedteCm, h = hoogteCm || 150;
    for (const tbl of [product.tableSmall, product.tableLarge]) {
      if (!tbl) continue;
      const bKeys = Object.keys(tbl).map(Number);
      if (b > Math.max(...bKeys)) continue; // te breed voor deze tabel, probeer de volgende
      const bE = findNearest(tbl, b); // rondt omhoog naar eerstvolgende tabelbreedte
      if (bE) {
        const hKeys = Object.keys(bE.value).map(Number);
        if (h > Math.max(...hKeys)) return null; // hoger dan tabel → geen stille fallback, handmatige controle
        const hE = findNearest(bE.value, h);
        if (hE) return hE.value;
      }
    }
    return null;
  }
  if (product.table) {
    const bKeys = Object.keys(product.table).map(Number);
    if (breedteCm > Math.max(...bKeys)) return null; // breder dan tabel → geen stille fallback, handmatige controle
    const bE = findNearest(product.table, breedteCm);
    if (bE && typeof bE.value === 'object') {
      const h = hoogteCm || breedteCm;
      const hKeys = Object.keys(bE.value).map(Number);
      if (h > Math.max(...hKeys)) return null; // hoger dan tabel → handmatige controle
      return findNearest(bE.value, h)?.value || null;
    }
    return null;
  }
  return null;
}

const STANDAARD_KLEUREN_MAP = {
  suneye: ['RAL 9010','RAL 9001','Antraciet','RAL 9005'],
  suneyeXL: ['RAL 9010','RAL 9001','Antraciet','RAL 9005'],
  sunelite: ['RAL 9010','Antraciet'],
  sunbasic: ['RAL 9001','Antraciet'],
  sunbasicCassette: ['RAL 9001','Antraciet'],
  zipDesign110: ['RAL 9010','RAL 9001','Antraciet','RAL 9005','RAL 9006'],
  zipSquare85100: ['RAL 9010','RAL 9001','Antraciet','RAL 9005','RAL 9006'],
  rolluikS37: ['RAL 9010','RAL 9001','Cremewit','DB703','RAL 9007','Quarts grijs','RAL 9005','RAL 7021','Antraciet'],
  rolluikS42: ['RAL 9010','RAL 9001','Cremewit','DB703','RAL 9007','Quarts grijs','RAL 9005','RAL 7021','Antraciet'],
  suncube150: ['RAL 9010','RAL 9001','Antraciet','RAL 9005'],
  sunproject100: ['RAL 9010','RAL 9001','Antraciet','RAL 9005'],
  suncontrol150: ['Antraciet','RAL 9010','RAL 9005','RAL 9007','Brons'],
  suncontrol165ZIP: ['Antraciet','RAL 9010','RAL 9005','RAL 9007','Brons'],
  suncontrolPergola: ['Antraciet','RAL 9010','RAL 9005','RAL 9007','Brons'],
};

const PRODUCT_EXTRA_INFO = {
  sunbasic: { cassette: 'Geen (open arm)' },
  sunbasicCassette: { cassette: 'Gesloten' },
  suneye: { cassette: 'Gesloten, slank design' },
  suneyeXL: { cassette: 'Gesloten, slank design (extra breed)' },
  sunelite: { cassette: 'Gesloten, premium design' },
  zipDesign110: { geleiding: 'ZIP (windvast)', onderlat: 'Geïntegreerd (strak design)' },
  zipSquare85100: { geleiding: 'ZIP (windvast)', onderlat: 'Standaard (los)' },
  rolluikS37: { profiel: 'S-37 (37mm lamel, compact, tot 300cm breed)' },
  rolluikS42: { profiel: 'S-42 (42mm lamel, steviger, tot 400cm breed)' },
  suncube150: { cassette: 'Gesloten, rond design (150mm)' },
  sunproject100: { cassette: 'Gesloten, rechthoekig (100mm)' },
  suncontrol150: { type: 'Onderdak zonwering' },
  suncontrol165ZIP: { type: 'Onderdak zonwering (windvast ZIP)' },
  suncontrolPergola: { type: 'Vrijstaande pergola (windvast ZIP)' },
};

function extractMaatFromDesc(desc) {
  const breedte = desc.match(/breedte[:\s]*(\d+[\.,]?\d*)\s*(mm|cm)?/i);
  const hoogte = desc.match(/hoogte[:\s]*(\d+[\.,]?\d*)\s*(mm|cm)?/i);
  const uitval = desc.match(/uitval[:\s]*(\d+[\.,]?\d*)\s*(mm|cm)?/i);
  function toCm(val, unit) { const n = parseFloat(val.replace(',','.')); return (unit||'mm').toLowerCase() === 'cm' ? n : n / 10; }
  return {
    breedte: breedte ? toCm(breedte[1], breedte[2]) : null,
    hoogte: hoogte ? toCm(hoogte[1], hoogte[2]) : null,
    uitval: uitval ? toCm(uitval[1], uitval[2]) : null,
  };
}

function isStandaardKleur(productKey, kleurStr) {
  if (!kleurStr) return true;
  // Gebruik kleuren uit JSON (heeft RAL 7016 etc.), fallback naar hardcoded
  const kleuren = SUNMASTER_PRICES[productKey]?.standaardKleuren || STANDAARD_KLEUREN_MAP[productKey] || [];
  const norm = kleurStr.toLowerCase().replace(/\s+/g,' ').trim();
  return kleuren.some(k => norm.includes(k.toLowerCase()));
}

function buildUpgradeDowngradeBlock(productKey, breedteCm, hoogteCm, uitvalCm, hasIO, kleurType, hasTahoma, isDraaischakelaar, actualPrice) {
  // actualPrice: de werkelijke offerte prijs (voor voorraadschermen die een afwijkende prijs hebben)
  // kleurType: 'standaard', 'trend', 'ral'
  const product = SUNMASTER_PRICES[productKey];
  if (!product) return '';
  // Normaliseer category: 'zipscreen' → 'screen' voor v3 compatibiliteit
  const rawCat = product.category;
  const pCat = rawCat === 'zipscreen' ? 'screen' : rawCat;
  const bookPrice = lookupPrice(productKey, breedteCm, hoogteCm, uitvalCm);
  if (!bookPrice && !actualPrice) return '';
  const currentPrice = bookPrice || 0;
  // Bij voorraadschermen: gebruik de werkelijke offerte prijs voor vergelijking
  const comparePrice = actualPrice || (currentPrice * MARKUP);
  const hz = SUNMASTER_PRICES.handzenderPrijs || 76;
  const lines = ['', '', '**Liever een ander model of bediening?**', ''];

  // Model alternatieven
  const modelAlts = [];
  const altMap = {
    knikarmscherm: { sunbasic:'SunBasic (open arm, geen cassette)', sunbasicCassette:'SunBasic Cassette (gesloten, instap)', suneye:'SunEye (gesloten, slank)', suneyeXL:'SunEye XL (extra breed, tot 745cm)', sunelite:'SunElite (topmodel, LED mogelijk)' },
    screen: { zipDesign110:'Zip Design 110 (ZIP, geïntegreerde onderlat)', zipSquare85100:'Zip Square 85/100 (ZIP, dunner profiel, budget)', screenSquare85100:'Screen Square 85/100 (zonder ZIP, niet windvast)' },
    rolluik: { rolluikS37:'Rolluik S-37 (37mm lamel, compact, tot 300cm)', rolluikS42:'Rolluik S-42 (42mm lamel, steviger, tot 400cm)' },
    uitvalscherm: { suncube150:'SunCube 150 (rond, premium)', sunproject100:'SunProject 100 (rechthoekig, breder leverbaar)' },
    serre: { suncontrol150:'SunControl 150 (onderdak, zonder ZIP)', suncontrol165ZIP:'SunControl 165 ZIP (onderdak, windvast)' },
    pergola: { suneye:'Knikarmscherm SunEye (wandmontage, geen palen nodig)', suneyeXL:'Knikarmscherm SunEye XL (extra breed, tot 745cm)' },
  };
  for (const [key, label] of Object.entries(altMap[pCat] || {})) {
    if (key === productKey) continue;
    let altPrice = lookupPrice(key, breedteCm, hoogteCm, uitvalCm);
    if (!altPrice) continue;
    // Screen Square 85/100 (zonder ZIP): tabel = LT50 motor
    if (key === 'screenSquare85100' && (productKey === 'zipDesign110' || productKey === 'zipSquare85100')) {
      altPrice += 199; // Sunilus IO upgrade t.o.v. LT50
    }
    const diff = Math.round(altPrice * MARKUP - comparePrice);

    // Bij pergola-alternatieven: toon welke maten het alternatief heeft
    let maatInfo = '';
    if (pCat === 'pergola' && (key === 'suneye' || key === 'suneyeXL')) {
      const altProduct = SUNMASTER_PRICES[key];
      if (altProduct?.tables) {
        // Zoek de grootste uitval waar de breedte bij past
        const uitvalKeys = Object.keys(altProduct.tables).map(Number).sort((a,b) => b-a);
        let gebruiktUitval = null, gebruiktB = null;
        for (const uk of uitvalKeys) {
          const tbl = altProduct.tables[String(uk)];
          const minB = Math.min(...Object.keys(tbl).map(Number));
          if (breedteCm >= minB) {
            gebruiktUitval = uk;
            gebruiktB = Math.min(breedteCm, Math.max(...Object.keys(tbl).map(Number)));
            break;
          }
        }
        if (gebruiktUitval && gebruiktB) {
          maatInfo = ' (' + Math.round(gebruiktB*10) + '×' + gebruiktUitval*10 + 'mm)';
        }
      }
    }

    modelAlts.push('• ' + label + maatInfo + ': ' + (diff >= 0 ? '+€' : '-€') + Math.abs(diff));
  }
  if (modelAlts.length > 0) { lines.push('Ander model:', ...modelAlts, ''); }

  // Bediening alternatieven
  const bedAlts = [];
  if (pCat === 'knikarmscherm' && hasIO) {
    bedAlts.push('• Draaistang (handmatig, geen motor): -€' + Math.round((300 + hz) * MARKUP));
    bedAlts.push('• Orea WT (bedraad, wandschakelaar): -€' + Math.round((51 + hz) * MARKUP));
  }
  if (pCat === 'knikarmscherm' && !hasIO) {
    // Draaischakelaar/handbediend → toon upgrade naar IO
    bedAlts.push('• Motor + afstandsbediening (Sunea IO + handzender): +€' + Math.round((51 + hz) * MARKUP));
    if (!isDraaischakelaar) bedAlts.push('• Draaistang (handmatig, geen motor): -€' + Math.round(300 * MARKUP));
  }
  if (pCat === 'screen' && hasIO) {
    bedAlts.push('• LT 50 draaischakelaar (bedraad): -€' + Math.round((89 + hz) * MARKUP));
    const sbd = Math.round((135 - hz) * MARKUP);
    bedAlts.push('• Solar Brel (zonnepaneel, incl. handzender): ' + (sbd >= 0 ? '+€' : '-€') + Math.abs(sbd));
    // Somfy Solar RS 100 IO alleen bij Zip Design 110 (niet beschikbaar bij Zip Square)
    if (productKey === 'zipDesign110') {
      bedAlts.push('• Somfy Solar RS 100 IO (premium, excl. handzender): +€' + Math.round(173 * MARKUP));
    }
  }
  if (pCat === 'screen' && !hasIO) {
    bedAlts.push('• Motor + afstandsbediening (Sunilus IO + handzender): +€' + Math.round((89 + hz) * MARKUP));
    bedAlts.push('• Solar Brel (zonnepaneel, incl. handzender): +€' + Math.round((135 + 89 - hz) * MARKUP));
  }
  if (pCat === 'rolluik' && hasIO) {
    bedAlts.push('• Bandbediening (handmatig): -€' + Math.round((260 + hz) * MARKUP));
    bedAlts.push('• LT 50 draaischakelaar (bedraad): -€' + Math.round((150 + hz) * MARKUP));
    bedAlts.push('• Somfy Solar RS 100 IO (premium, excl. handzender): +€' + Math.round(239 * MARKUP));
    bedAlts.push('• Solar Brel (zonnepaneel, incl. handzender): +€' + Math.round((199 - hz) * MARKUP));
  }
  if (pCat === 'rolluik' && !hasIO) {
    // Draaischakelaar = LT50 (-150 t.o.v. RS100IO). Toon upgrades + downgrade
    bedAlts.push('• Bandbediening (handmatig): -€' + Math.round((260 - 150) * MARKUP));
    bedAlts.push('• Motor + afstandsbediening (RS100 IO + handzender): +€' + Math.round((150 + hz) * MARKUP));
    bedAlts.push('• Somfy Solar RS 100 IO (premium, excl. handzender): +€' + Math.round((239 + 150) * MARKUP));
    bedAlts.push('• Solar Brel (zonnepaneel, incl. handzender): +€' + Math.round((199 + 150) * MARKUP));
  }
  if (pCat === 'uitvalscherm' && hasIO) {
    if (productKey === 'suncube150') {
      bedAlts.push('• Draaistang (handmatig): -€' + Math.round((60 + hz + 299) * MARKUP));
      bedAlts.push('• Orea WT (bedraad, wandschakelaar): -€' + Math.round((60 + hz) * MARKUP));
    }
    if (productKey === 'sunproject100') {
      bedAlts.push('• Draaistang (handmatig): -€' + Math.round((134 + hz + 299) * MARKUP));
      bedAlts.push('• Somfy LT (bedraad, draaischakelaar): -€' + Math.round((134 + hz) * MARKUP));
    }
  }
  if (pCat === 'uitvalscherm' && !hasIO) {
    if (productKey === 'sunproject100') {
      bedAlts.push('• Motor + afstandsbediening (Sunea IO + handzender): +€' + Math.round((134 + hz) * MARKUP));
    }
    if (productKey === 'suncube150') {
      bedAlts.push('• Motor + afstandsbediening (Sunea IO + handzender): +€' + Math.round((60 + hz) * MARKUP));
    }
  }
  if ((pCat === 'serre' || pCat === 'pergola') && hasIO) {
    bedAlts.push('• Orea WT (bedraad, wandschakelaar): -€' + Math.round((50 + hz) * MARKUP));
  }
  if ((pCat === 'serre' || pCat === 'pergola') && !hasIO) {
    bedAlts.push('• Motor + afstandsbediening (Sunea IO + handzender): +€' + Math.round((50 + hz) * MARKUP));
  }
  if (bedAlts.length > 0) { lines.push('Andere bediening:', ...bedAlts, ''); }

  // Tahoma als optie als die niet in de offerte staat (wordt gecheckt via hasIO parameter overload)
  // Tahoma wordt apart toegevoegd in addV4Enhancements

  // Kleur opties — afhankelijk van wat de klant nu heeft
  const extraLines = [];
  const trendEntry = product.meerprijsTrend ? findNearest(product.meerprijsTrend, breedteCm) : null;
  const ralEntry = product.meerprijsRAL ? findNearest(product.meerprijsRAL, breedteCm) : null;

  if (pCat === 'rolluik') {
    if (kleurType === 'ral') {
      extraLines.push('• Standaardkleur (geen meerprijs): -20% op productprijs');
      extraLines.push('• Trendkleur: -5% op productprijs (i.p.v. 20%)');
    } else if (kleurType === 'trend') {
      extraLines.push('• Standaardkleur (geen meerprijs): -15% op productprijs');
      extraLines.push('• RAL kleur naar keuze: +5% op productprijs');
    } else {
      extraLines.push('• Trendkleur: +15% op productprijs');
      extraLines.push('• RAL kleur/ronde kast: +20% op productprijs');
    }
  } else if (pCat === 'serre' || pCat === 'pergola') {
    if (kleurType === 'ral') {
      extraLines.push('• Standaardkleur (geen meerprijs): -15% op productprijs');
    } else {
      extraLines.push('• RAL kleur naar keuze: +15% op productprijs');
    }
  } else if (trendEntry || ralEntry) {
    if (kleurType === 'ral' && ralEntry) {
      extraLines.push('• Standaardkleur: -€' + Math.round(ralEntry.value * MARKUP));
      if (trendEntry) extraLines.push('• Trendkleur: -€' + Math.round((ralEntry.value - trendEntry.value) * MARKUP));
    } else if (kleurType === 'trend' && trendEntry) {
      extraLines.push('• Standaardkleur: -€' + Math.round(trendEntry.value * MARKUP));
      if (ralEntry) extraLines.push('• RAL kleur naar keuze: +€' + Math.round((ralEntry.value - trendEntry.value) * MARKUP));
    } else {
      if (trendEntry) extraLines.push('• Trendkleur: +€' + Math.round(trendEntry.value * MARKUP));
      if (ralEntry) extraLines.push('• RAL kleur naar keuze: +€' + Math.round(ralEntry.value * MARKUP));
    }
  }
  if (extraLines.length > 0) { lines.push('Kleur:', ...extraLines, ''); }

  // Tahoma Switch als optie — alleen als die nog niet in de offerte staat
  if (!hasTahoma) {
    lines.push('Smart home:');
    if (hasIO) {
      lines.push('• Tahoma Switch (bedien alles via je telefoon): +€195');
    } else {
      lines.push('• Tahoma Switch (bedien alles via je telefoon, vereist IO motor): +€195 (excl. motor upgrade)');
    }
    lines.push('');
  }

  lines.push('Laat het ons weten, we passen je offerte graag aan.');
  return lines.join('\n');
}

// ============ V4: PRIJSCORRECTIE ============
// Bereken de correcte Sonty prijs op basis van Sunmaster boekprijs × 1.10
// Retourneert null als niet 100% zeker

function calculateCorrectPrice(productKey, breedteCm, hoogteCm, uitvalCm, bedieningType) {
  const product = SUNMASTER_PRICES[productKey];
  if (!product) return null;
  const pCat = product.category === 'zipscreen' ? 'screen' : product.category;
  const boekprijs = lookupPrice(productKey, breedteCm, hoogteCm, uitvalCm);
  if (!boekprijs) return null;

  const hz = 76; // handzender Situo 1 IO
  const isIO = bedieningType === 'afstandsbediening' || bedieningType === 'io';
  const isDraaischakelaar = bedieningType === 'draaischakelaar';
  const isSolar = bedieningType === 'solar';
  const isHandbediend = bedieningType === 'handbediend';

  let totaal = boekprijs;

  // Motor-aanpassingen t.o.v. standaard motor in tabel
  if (pCat === 'knikarmscherm') {
    // Minderprijs kleinere uitval: tabellen beginnen bij uitval 250; catalogus geeft
    // vaste minderprijs voor uitval 150/200 (bv. suneye: -180/-160). Zonder deze regel te veel gerekend.
    if (uitvalCm && uitvalCm > 0 && product.minderprijzen) {
      if (uitvalCm <= 150 && typeof product.minderprijzen.uitval150 === 'number') totaal += product.minderprijzen.uitval150;
      else if (uitvalCm <= 200 && typeof product.minderprijzen.uitval200 === 'number') totaal += product.minderprijzen.uitval200;
    }
    // Tabel = Sunea IO. IO + handzender is standaard bestelling.
    if (isIO) totaal += hz;
    else if (isDraaischakelaar) totaal -= 51; // Orea WT als "draaischakelaar" interpretatie
    else if (isHandbediend) totaal -= 300; // draaistang
    else totaal += hz; // default = IO + handzender
  }
  else if (pCat === 'screen') {
    // Tabel = Sunilus IO
    if (isIO) totaal += hz;
    else if (isDraaischakelaar) totaal -= 89; // LT50
    else if (isSolar) totaal += 173 + hz; // Somfy RS 100 IO Solar (excl zender) + handzender
    else if (bedieningType === 'solarBrel') totaal += 59; // Brel Solar €135 incl zender i.p.v. Sunilus IO
    else totaal += hz;
  }
  else if (pCat === 'rolluik') {
    // Tabel = RS 100 IO
    if (isIO) totaal += hz;
    else if (isDraaischakelaar) totaal -= 150; // LT50
    else if (isSolar) totaal += 239; // Solar RS100IO, handzender apart
    else if (bedieningType === 'solarBrel') totaal += 199; // Brel Solar incl zender
    else if (isHandbediend) totaal -= 260; // bandbediening
    else totaal += hz;
  }
  else if (pCat === 'uitvalscherm') {
    if (productKey === 'suncube150') {
      // Tabel = Orea WT
      if (isIO) totaal += 60 + hz; // upgrade naar Sunea IO + handzender
      else if (isDraaischakelaar) { /* Orea WT is al in tabel, geen aanpassing */ }
      else if (isHandbediend) totaal -= 299; // draaistang
      else if (isSolar || bedieningType === 'solarBrel') totaal += 135; // Solar Brel incl handzender
      else totaal += 60 + hz; // default IO
    }
    if (productKey === 'sunproject100') {
      // Tabel = Somfy LT
      if (isIO) totaal += 134 + hz; // upgrade naar Sunea IO + handzender
      else if (isDraaischakelaar) { /* LT is al in tabel */ }
      else if (isHandbediend) totaal -= 299; // draaistang
      else if (isSolar || bedieningType === 'solarBrel') totaal += 199; // Solar Brel incl handzender
      else totaal += 134 + hz; // default IO
    }
  }
  else if (pCat === 'serre' || pCat === 'pergola') {
    // Tabel = Sunea IO
    if (isIO) totaal += hz;
    else if (isDraaischakelaar) totaal -= 50; // Orea WT
    else totaal += hz;
  }

  // Markup 10%
  return Math.round(totaal * MARKUP * 100) / 100;
}

// Retourneert { changed, priceUnknown }. priceUnknown=true → prijs kon niet bepaald worden
// (maat buiten tabel e.d.): offerte moet naar HANDMATIGE controle, niet ongecontroleerd door.
function correctProductPrice(line, productKey, breedteCm, hoogteCm, uitvalCm) {
  const bedStr = extractField(line.description, 'Bediening').toLowerCase();
  const motorStr = extractField(line.description, 'Motor').toLowerCase();
  // Check Motor field too — transformProductDesc may have rewritten Bediening but Motor contains original info
  let bedType = 'io'; // default
  if (motorStr.includes('brel') || bedStr.includes('brel')) bedType = 'solarBrel';
  else   if (motorStr.includes('solar') || motorStr.includes('brel') || bedStr.includes('solar') || bedStr.includes('brel')) bedType = 'solar';
  else if (bedStr.includes('afstandsbediening') || bedStr.includes('motor +') || bedStr.includes('motor +')) bedType = 'afstandsbediening';
  else if (bedStr.includes('draaischakelaar') || motorStr.includes('somfy lt')) bedType = 'draaischakelaar';
  else if (bedStr.includes('handbediend') || bedStr.includes('slingerstang') || bedStr.includes('band')) bedType = 'handbediend';

  let correctPrice = calculateCorrectPrice(productKey, breedteCm, hoogteCm, uitvalCm, bedType);
  if (!correctPrice) return { changed: false, priceUnknown: true };

  // RAL kleur meerprijs toevoegen als niet-standaard kleur
  const product = SUNMASTER_PRICES[productKey];
  const pCatColor = product.category === 'zipscreen' ? 'screen' : product.category;
  const kleurStr = extractField(line.description, 'Frame Kleur') || extractField(line.description, 'Frame kleur') || '';
  const stdKleuren = product.standaardKleuren || STANDAARD_KLEUREN_MAP[productKey] || [];
  const isStd = stdKleuren.some(k => kleurStr.toLowerCase().includes(k.toLowerCase()));
  const isRAL = !isStd && kleurStr && !kleurStr.toLowerCase().includes('n.t.b') && !kleurStr.toLowerCase().includes('ntb') && !kleurStr.toLowerCase().includes('naar keuze');

  if (isRAL) {
    // Bepaal of het een trendkleur is
    const trendKleuren = ['RAL 7039','RAL 9007','RAL 9010 structuur','DB 703','DB703','RAL 7021'];
    const isTrend = trendKleuren.some(k => kleurStr.toLowerCase().includes(k.toLowerCase()));

    if (pCatColor === 'rolluik') {
      // Rolluik: percentage-based — trendkleur +15%, RAL +20% op productprijs (= correctPrice vóór kleur)
      const pct = isTrend ? 0.15 : 0.20;
      const surcharge = Math.round(correctPrice * pct * 100) / 100;
      console.log('    Kleur meerprijs rolluik: ' + (isTrend ? 'trend +15%' : 'RAL +20%') + ' = +€' + surcharge);
      correctPrice += surcharge;
    } else if (pCatColor === 'serre' || pCatColor === 'pergola') {
      // Serre/pergola: RAL +15% op productprijs
      const surcharge = Math.round(correctPrice * 0.15 * 100) / 100;
      console.log('    Kleur meerprijs serre/pergola: RAL +15% = +€' + surcharge);
      correctPrice += surcharge;
    } else if (isTrend && product.meerprijsTrend) {
      // Screens/knikarm/uitval met trendkleur: vaste meerprijs uit tabel
      const trendEntry = findNearest(product.meerprijsTrend, breedteCm);
      if (trendEntry) {
        const surcharge = Math.round(trendEntry.value * MARKUP * 100) / 100;
        console.log('    Kleur meerprijs trend: +€' + surcharge);
        correctPrice += surcharge;
      }
    } else if (product.meerprijsRAL) {
      // Screens/knikarm/uitval met RAL kleur: vaste meerprijs uit tabel
      const ralEntry = findNearest(product.meerprijsRAL, breedteCm);
      if (ralEntry) {
        const surcharge = Math.round(ralEntry.value * MARKUP * 100) / 100;
        console.log('    Kleur meerprijs RAL: +€' + surcharge);
        correctPrice += surcharge;
      }
    }
  }

  // Alleen corrigeren als er een significant verschil is (>€1)
  if (Math.abs(line.pricePerUnit - correctPrice) > 1) {
    console.log('    Prijs gecorrigeerd: €' + line.pricePerUnit + ' → €' + correctPrice + ' (' + productKey + (isRAL ? ' +RAL' : '') + ')');
    line.pricePerUnit = correctPrice;
    return { changed: true, priceUnknown: false };
  }
  return { changed: false, priceUnknown: false };
}

function addV4Enhancements(desc, firstLine, hasTahoma, linePrice) {
  if (desc.includes('Liever een ander model')) return desc; // idempotent
  const pKey = getProductKey(firstLine);
  if (!pKey) return desc;
  const pKeyProduct = SUNMASTER_PRICES[pKey];
  const pCat = pKeyProduct ? (pKeyProduct.category === 'zipscreen' ? 'screen' : pKeyProduct.category) : null;
  const info = PRODUCT_EXTRA_INFO[pKey];
  const maat = extractMaatFromDesc(desc);
  if (!maat.breedte && !maat.hoogte) return desc;

  const lines = desc.split('\n');

  // 1. Annoteer eerste "Frame kleur" met (standaard) of meerprijs
  let kleurDone = false;
  let frameKleur = '';
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim().toLowerCase();
    if (!kleurDone && t.match(/^frame\s*kleur[:\s]/i) && !lines[i].includes('(standaard') && !lines[i].includes('(+€') && !lines[i].includes('(niet standaard')) {
      const kleurMatch = lines[i].match(/:\s*(.+)/);
      frameKleur = kleurMatch ? kleurMatch[1].trim() : '';
      const isStd = isStandaardKleur(pKey, frameKleur);
      if (isStd) {
        lines[i] = lines[i].trimEnd() + ' (standaard)';
      } else if (frameKleur && !frameKleur.toLowerCase().includes('n.t.b') && !frameKleur.toLowerCase().includes('ntb')) {
        const product = SUNMASTER_PRICES[pKey];
        const trendKleuren = ['RAL 7039','RAL 9007','RAL 9010 structuur','DB 703','DB703','RAL 7021'];
        const isTrend = trendKleuren.some(k => frameKleur.toLowerCase().includes(k.toLowerCase()));
        if (isTrend && product?.meerprijsTrend) {
          const te = findNearest(product.meerprijsTrend, maat.breedte || 300);
          if (te) lines[i] = lines[i].trimEnd() + ' (+€' + Math.round(te.value * MARKUP) + ' trendkleur)';
        } else if (product?.meerprijsRAL) {
          const re = findNearest(product.meerprijsRAL, maat.breedte || 300);
          if (re) lines[i] = lines[i].trimEnd() + ' (+€' + Math.round(re.value * MARKUP) + ' andere RAL kleur)';
        } else if (pCat === 'rolluik') {
          lines[i] = lines[i].trimEnd() + (isTrend ? ' (+15% trendkleur)' : ' (+20% andere RAL kleur)');
        } else if (pCat === 'serre' || pCat === 'pergola') {
          lines[i] = lines[i].trimEnd() + ' (+15% andere RAL kleur)';
        } else {
          lines[i] = lines[i].trimEnd() + ' (niet standaard)';
        }
      }
      kleurDone = true;
    }
  }

  // 1b. Rolluiken: pantserkleur = framekleur
  if (pKey.startsWith('rolluik') && frameKleur) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().toLowerCase().startsWith('kleur pantser')) {
        lines[i] = 'Kleur Pantser: ' + frameKleur;
      }
    }
  }

  // 2. Voeg product-info toe vóór Garantie
  if (info) {
    const fullText = lines.join('\n').toLowerCase();
    const toAdd = [];
    if (info.cassette && !fullText.includes('cassette:')) toAdd.push('Cassette: ' + info.cassette);
    if (info.geleiding && !fullText.includes('geleiding:')) toAdd.push('Geleiding: ' + info.geleiding);
    if (info.profiel && !fullText.includes('profiel:') && !fullText.includes('s-37') && !fullText.includes('s-42')) toAdd.push('Profiel: ' + info.profiel);
    if (info.type && !fullText.includes('type:')) toAdd.push('Type: ' + info.type);
    if (toAdd.length > 0) {
      // Voeg toe op logische plek bij de specs:
      // Rolluik Profiel → na Lamel
      // Screen Geleiding → na Onderlat of na Type geleider
      // Knikarm Cassette → na Montage/Overige (laatste spec)
      // Uitvalscherm Cassette → na Overige (laatste spec)
      // Serre Type → na eerste specs
      let insertAt = -1;
      const lower = lines.map(l => l.trim().toLowerCase());

      // Zoek de beste plek per product-type
      if (info.profiel) {
        // Rolluik: na Lamel
        const lamelIdx = lower.findIndex(l => l.startsWith('lamel'));
        if (lamelIdx >= 0) insertAt = lamelIdx + 1;
      }
      if (info.geleiding) {
        // Screen: na Onderlat of na Type geleider
        const onderlatIdx = lower.findIndex(l => l.startsWith('onderlat'));
        const typeGelIdx = lower.findIndex(l => l.startsWith('type geleider'));
        if (typeGelIdx >= 0) insertAt = typeGelIdx + 1;
        else if (onderlatIdx >= 0) insertAt = onderlatIdx + 1;
      }
      if (info.cassette) {
        // Knikarm/Uitvalscherm: na Montage of Overige (laatste spec-regel)
        const montageIdx = lower.findIndex(l => l.startsWith('montage:'));
        const overigeIdx = lower.findIndex(l => l.startsWith('overige:'));
        const motorIdx = lower.findIndex(l => l.startsWith('motor:'));
        if (overigeIdx >= 0) insertAt = overigeIdx + 1;
        else if (montageIdx >= 0) insertAt = montageIdx + 1;
        else if (motorIdx >= 0) insertAt = motorIdx + 1;
      }
      if (info.type) {
        // Serre: na Motor of na Bediening
        const motorIdx = lower.findIndex(l => l.startsWith('motor:'));
        const bedIdx = lower.findIndex(l => l.startsWith('bediening:'));
        if (motorIdx >= 0) insertAt = motorIdx + 1;
        else if (bedIdx >= 0) insertAt = bedIdx + 1;
      }

      // Fallback: vóór Garantie of Waarom
      if (insertAt < 0) {
        const gi = lower.findIndex(l => l.startsWith('garantie'));
        const wi = lines.findIndex(l => /^\*?\*?Waarom/.test(l.trim()));
        insertAt = gi >= 0 ? gi : wi >= 0 ? wi : lines.length;
      }

      lines.splice(insertAt, 0, ...toAdd);
    }
  }

  // 3. Upgrade/downgrade opties
  const bedStr = (extractField(desc, 'Bediening') || '').toLowerCase();
  const hasIO = bedStr.includes('afstandsbediening') || bedStr.includes('motor +');
  const isDraaischakelaar = bedStr.includes('draaischakelaar') && !hasIO;

  // Bepaal kleurtype
  const product = SUNMASTER_PRICES[pKey];
  const isStdKleur = (product?.standaardKleuren || []).some(k => (frameKleur || '').toLowerCase().includes(k.toLowerCase()));
  let kleurType = 'standaard';
  if (!isStdKleur && frameKleur && !frameKleur.toLowerCase().includes('n.t.b') && !frameKleur.toLowerCase().includes('ntb') && !frameKleur.toLowerCase().includes('naar keuze')) {
    // Check of het een trendkleur is (RAL 7039, RAL 9007 str, RAL 9010 str, RAL 7016, DB703, RAL 7021 str)
    const trendKleuren = ['RAL 7039','RAL 9007','RAL 9010 structuur','DB 703','DB703','RAL 7021'];
    const isTrend = trendKleuren.some(k => frameKleur.toLowerCase().includes(k.toLowerCase()));
    kleurType = isTrend ? 'trend' : 'ral';
  }

  // Bij voorraadschermen: geef de werkelijke prijs mee zodat up/downgrades t.o.v. de echte prijs worden berekend
  const isVoorraad = firstLine.includes('voorraad');
  const block = buildUpgradeDowngradeBlock(pKey, maat.breedte, maat.hoogte, maat.uitval, hasIO, kleurType, hasTahoma || false, isDraaischakelaar, isVoorraad ? linePrice : null);
  if (block) return lines.join('\n') + block;
  return lines.join('\n');
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
    try {
    const lcId = item.item_subject?.id;
    if (!lcId) continue;
    const docInfo = await getDocForItem(lcId);
    if (!docInfo) continue;
    const fullData = await getFullDoc(docInfo.documentId);
    if (!fullData?.quotationData) continue;

    const qd = fullData.quotationData;
    const plg = qd.segments?.defaultTemplatePriceLineGroup;
    const lines = plg?.data?.lines || [];

    // Gordijnen/behang detectie VOOR lege-offerte skip (desc-based, niet afhankelijk van productlijnen)
    const desc = item.description || '';
    const email = desc.match(/E-mailadres:\s*([^\n]+)/i)?.[1]?.trim() || item.fields?.email || '';
    const descLower = desc.toLowerCase();
    const isGordijnDesc = descLower.includes('gordijn') || (descLower.includes('pliss') && !descLower.includes('zip')) || descLower.includes('behang');
    if (isGordijnDesc && lines.length <= 1 && (!lines[0] || !lines[0].pricePerUnit)) {
      if (email) await sendGordijnenEmail(item.summary, email);
      await setStatus(item.id, GORDIJNEN_STATUS);
      console.log('  → Gordijnen/showroom (lege offerte): ' + item.summary);
      routeCount++; continue;
    }

    if (lines.length === 0) continue;

    const origLines = JSON.parse(JSON.stringify(lines)); // backup voor self-check

    // Persistente backup naar disk (voor herstel bij fouten)
    const backupDir = path.join(__dirname, '../data/offerte-backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const backupFile = path.join(backupDir, docInfo.quotationNumber + '.json');
    if (!fs.existsSync(backupFile)) {
      fs.writeFileSync(backupFile, JSON.stringify({ quotationNumber: docInfo.quotationNumber, documentId: docInfo.documentId, name: item.summary, timestamp: new Date().toISOString(), lines: origLines }, null, 2));
    }
    const city = desc.match(/Plaats:\s*([^\n]+)/i)?.[1]?.trim() || '';
    const opmerking = desc.match(/Opmerking:\s*([\s\S]*?)(?=\n\d+x |\n*$)/i)?.[1]?.trim() || '';
    const hasToevoegingen = opmerking.toLowerCase().includes('toevoeg') || opmerking.toLowerCase().includes('aanpass') || desc.includes('TOEVOEGEN');
    const isMarkies = lines.some(l => l.description?.toLowerCase().includes('markies'));
    const isGordijn = lines.some(l => l.description?.toLowerCase().includes('gordijn') || (l.description?.toLowerCase().includes('plisse') && !l.description?.toLowerCase().includes('zip')))
      || descLower.includes('gordijn') || (descLower.includes('pliss') && !descLower.includes('zip'));

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
    if (hasToevoegingen && !isMarkies) {
      await setStatus(item.id, HANDMATIG);
      routeCount++; continue;
    }
    // Markiezen: direct verwerken (was: routeer naar Handmatig, aparte daemon)
    // Combi-offertes (markies + andere producten): verwerk alles in één keer

    // STAP 2: OFFERTE AANPASSEN (in originele volgorde!)
    // Bij markiezen-combi: verwerk de niet-markies producten WEL, routeer daarna naar Handmatig
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
    const catBed = {}; // bedieningstype per categorie (voor montageregels bij combi-offertes)
    const priceUnknown = []; // producten waarvan de prijs niet bepaald kon worden → handmatige controle
    for (let i = 0; i < lines.length; i++) {
      const firstLine = lines[i].description?.split('\n')[0] || '';
      const bediening = lines[i].description?.match(/Bediening:\s*([^\n]+)/i)?.[1]?.trim() || '';
      const motor = lines[i].description?.match(/Motor:\s*([^\n]+)/i)?.[1]?.trim() || '';
      const cat = getCategory(firstLine);

      if (cat && lines[i].pricePerUnit > 0) {
        lastCat = cat;
        lastBed = getBedType(bediening, motor);
        catBed[cat] = lastBed;
        // Transform product omschrijving
        const newDesc = transformProductDesc(lines[i].description, lastCat, lastBed);
        if (newDesc !== lines[i].description) { lines[i].description = newDesc; changed = true; }
        // V4: Prijscorrectie (Sunmaster boekprijs × 1.10)
        // Voorraadschermen: NIET aanpassen (handmatige prijs)
        const pKey = getProductKey(firstLine);
        if (pKey && !firstLine.toLowerCase().includes('voorraad')) {
          const maat = extractMaatFromDesc(lines[i].description);
          if (maat.breedte || maat.hoogte) {
            const pc = correctProductPrice(lines[i], pKey, maat.breedte, maat.hoogte, maat.uitval);
            if (pc.changed) changed = true;
            if (pc.priceUnknown) priceUnknown.push(firstLine.replace(/\*\*/g, '') + ' (' + Math.round(maat.breedte || 0) + '×' + Math.round(maat.hoogte || maat.uitval || 0) + 'cm)');
          }
        }
        continue;
      }

      const d = firstLine.toLowerCase();
      if (d.includes('montage') || d.includes('inmeten')) {
        // Categorie EERST uit de montagetitel zelf; lastCat alleen als fallback (combi-offertes!)
        const mCat = getMontageCategory(d) || lastCat;
        // Alleen aanpassen als er ook echt een product van die categorie in de offerte zit
        // (catBed gevuld) — anders niet aanraken i.p.v. gokken.
        if (mCat && mCat !== 'markies' && catBed[mCat] !== undefined) {
          // Montage prijs aanpassen (behoudt originele titel + bullets)
          if (adjustMontageInPlace(lines[i], mCat, catBed[mCat])) changed = true;
        }
        continue;
      }
    }

    // H1: product herkend maar prijs niet bepaalbaar (maat buiten tabel e.d.)
    // → NIET ongecontroleerd naar de klant; naar handmatige controle. Niets is nog opgeslagen.
    if (priceUnknown.length > 0) {
      console.log('  → Handmatige controle (prijs niet bepaalbaar): ' + priceUnknown.join(' | ') + ' — ' + item.summary);
      await setStatus(item.id, HANDMATIG);
      routeCount++; continue;
    }

    // STAP 2c: MARKIEZEN VERWERKEN (was aparte daemon, nu geïntegreerd)
    if (isMarkies) {
      const mkResult = processMarkiezen(desc, lines);
      if (mkResult.issues.length > 0) {
        // Onvolledige/onbekende markies-gegevens of maat buiten tabel → handmatige controle
        console.log('  → Handmatige controle (markies): ' + mkResult.issues.join('; ') + ' — ' + item.summary);
        await setStatus(item.id, HANDMATIG);
        routeCount++; continue;
      }
      if (mkResult.lines) {
        // Vervang lines met gecombineerde regels (bestaande + markies)
        lines.length = 0;
        lines.push(...mkResult.lines);
        changed = true;
      }
    }

    // STAP 2d: VERKOOPTEKSTEN (optioneel)
    if (ENHANCE_DESCRIPTIONS) {
      if (enhanceAllDescriptions(lines)) changed = true;
    }

    // STAP 2e: TITELS BOLD MAKEN (**)
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

    // STAP 4: SELF-CHECK + AUTO-FIX (skip voor markiezen — prijzen veranderen bij markies-opbouw)
    if (!isMarkies) {
      const scResult = selfCheckAndFix(origLines, newLines);
      if (scResult.errors.length > 0) {
        console.log('⚠️ SELF-CHECK FAIL (niet fixbaar) #' + docInfo.quotationNumber + ' ' + item.summary + ': ' + scResult.errors.join(', '));
        await sendTelegram('⚠️ Self-check fail (niet fixbaar): #' + docInfo.quotationNumber + ' ' + item.summary + '\n' + scResult.errors.join('\n'));
        errorCount++; continue;
      }
      if (scResult.fixed) {
        newLines.length = 0;
        newLines.push(...scResult.lines);
        changed = true;
      }
    }

    // STAP 4b: WAAROM SONTY TEKSTBLOK (1x onderaan document)
    if (ENHANCE_DESCRIPTIONS) {
      if (addWaaromSontyBlock(qd)) changed = true;
    }

    // STAP 5: OPSLAAN + STATUS → altijd GECONTROLEERD (Daimy checkt, pas daarna verstuurd)
    if (changed) {
      plg.data.lines = newLines;
      if (!await saveDoc(docInfo.documentId, qd)) { errorCount++; continue; }
      fixCount++;
    } else {
      okCount++;
    }
    await setStatus(item.id, GECONTROLEERD);
    } catch (e) {
      console.log('  ERROR bij ' + item.summary + ': ' + (e.cause?.code || e.message)?.substring(0, 100) + ' — item blijft in OC voor volgende run');
      errorCount++;
    }
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
    // Telefoon altijd in +316XXXXXXXX format (voor WhatsApp)
    let phone = (item.fields?.phone || '').replace(/[\s()\-\.]/g, '');
    phone = phone.replace(/^(\+31)0/, '$1'); // +31(0) → +31
    if (phone.startsWith('06')) phone = '+31' + phone.substring(1);
    if (phone.startsWith('0031')) phone = '+' + phone.substring(2);
    if (phone.startsWith('31') && !phone.startsWith('+')) phone = '+' + phone;
    if (!phone.startsWith('+') && phone.length >= 9) phone = '+31' + phone;

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
    const tab = bestaandeTabs.find(t => t.title.trim() === tabNaam);
    if (!tab) {
      await sendTelegram('Tab "' + tabNaam + '" bestaat niet. Maak deze aan.');
      continue;
    }
    const sheetTabNaam = tab.title; // echte naam inclusief eventuele spaties
    // Dedup op offerte nummer
    const existRes = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "'" + sheetTabNaam + "'!G4:G2000" });
    const existingNrs = new Set((existRes.data.values || []).map(r => r[0]).filter(Boolean));
    const newRows = rows.filter(r => !existingNrs.has(r[6]));
    if (newRows.length === 0) continue;

    // BACKUP: sla huidige sheet data op voor herstel bij fouten
    const fullRes = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "'" + sheetTabNaam + "'!A4:X3000" });
    const existingRows = fullRes.data.values || [];
    const backupPath = path.join(__dirname, '../data/sheet-backup-' + sheetTabNaam.trim().replace(/\s+/g, '-') + '.json');
    fs.writeFileSync(backupPath, JSON.stringify({ tab: sheetTabNaam, timestamp: new Date().toISOString(), rows: existingRows }, null, 2));

    // Schrijf RIJ VOOR RIJ — sla elke rij met data in A, T, U, V of X over
    let written = 0;
    let nextRow = 4;
    for (const newRow of newRows) {
      // Zoek de eerstvolgende volledig lege rij (geen A, geen T/U/V/X)
      while (nextRow - 4 < existingRows.length) {
        const r = existingRows[nextRow - 4];
        const hasA = r?.[0]?.toString().trim();
        const hasT = r?.[19]?.toString().trim();
        const hasU = r?.[20]?.toString().trim();
        const hasV = r?.[21]?.toString().trim();
        const hasX = r?.[23]?.toString().trim();
        if (!hasA && !hasT && !hasU && !hasV && !hasX) break; // lege rij gevonden
        nextRow++;
      }

      // Google Sheets limiet: 60 writes/min/user — throttle + retry bij 429 (quota)
      await sheetsWrite(() => sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID, range: "'" + sheetTabNaam + "'!A" + nextRow + ':L' + nextRow,
        valueInputOption: 'USER_ENTERED', requestBody: { values: [newRow] },
      }));
      await sheetsWrite(() => sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID, requestBody: { requests: [{ repeatCell: {
          range: { sheetId: tab.id, startRowIndex: nextRow - 1, endRowIndex: nextRow, startColumnIndex: 0, endColumnIndex: 12 },
          cell: { userEnteredFormat: { backgroundColor: { red: 1, green: 1, blue: 0 } } },
          fields: 'userEnteredFormat.backgroundColor',
        }}]},
      }));
      written++;
      nextRow++;
    }
    sheetRows += written;
  }

  console.log('Sheet: ' + sheetRows + ' rijen, ' + teVerSheetCount + ' TE VER');

  // GECONTROLEERD → OFFERTE VERSTUURD (geactiveerd door Daimy 2026-06-29)
  // Haal VERS op (niet cached) zodat ook items die in DEZE run naar GC zijn gezet worden meegenomen
  await new Promise(r => setTimeout(r, 5000)); // 5s wachten zodat RP de status-wijzigingen heeft verwerkt
  const gcToOvData = await rpGet('/contact-service/' + PID + '/backlogs/' + BACKLOG_ID + '/items');
  const gcToOv = (gcToOvData?.items || []).filter(i =>
    i.status_id === GECONTROLEERD && !i.technical_labels?.some(l => l.type === 'ITEM_ARCHIVED')
  );
  let ovCount = 0;
  for (const item of gcToOv) {
    if (await setStatus(item.id, '15c4f0be-c6bf-447d-bf5f-a233c482eb53')) ovCount++;
  }
  if (ovCount > 0) console.log('Gecontroleerd → Offerte verstuurd: ' + ovCount);

  // WHATSAPP OFFERTE VERZENDING
  // Stuur WhatsApp met offerte-link naar items in "Offerte verstuurd" die >60 min geleden zijn verplaatst
  const WA_OFFERTE_TEMPLATE = 235187; // offerte_met_link
  const WA_OFFERTE_SENT_FILE = path.join(__dirname, '.wa-offerte-sent.json');
  function getWaSent() { try { return JSON.parse(fs.readFileSync(WA_OFFERTE_SENT_FILE, 'utf8')); } catch { return {}; } }
  function markWaSent(key) { const d = getWaSent(); d[key] = new Date().toISOString(); fs.writeFileSync(WA_OFFERTE_SENT_FILE, JSON.stringify(d, null, 2)); }

  const ovItemsData = await rpGet('/contact-service/' + PID + '/backlogs/' + BACKLOG_ID + '/items');
  const ovItems = (ovItemsData?.items || []).filter(i =>
    i.status_id === '15c4f0be-c6bf-447d-bf5f-a233c482eb53' && // Offerte verstuurd
    !i.technical_labels?.some(l => l.type === 'ITEM_ARCHIVED') &&
    i.timestamp_updated && (Date.now() - i.timestamp_updated > 60 * 60 * 1000) && // >60 min geleden
    i.timestamp_updated > Date.now() - 2 * 86400000 // max 2 dagen oud (alleen recente van v4)
  );

  const waSent = getWaSent();
  let waCount = 0;

  for (const item of ovItems) {
    const lcId = item.item_subject?.id;
    if (!lcId) continue;
    const qNum = item.id; // gebruik item id als key (offerte nummer niet altijd beschikbaar zonder extra call)
    if (waSent[qNum]) continue; // al verstuurd

    // Haal telefoon + naam + offerte-link op
    const desc = item.description || '';
    const voornaam = desc.match(/Voornaam:\s*([^\n]+)/i)?.[1]?.trim() || item.summary?.split(' ')[0] || '';
    let telefoon = desc.match(/Telefoonnummer:\s*([^\n]+)/i)?.[1]?.trim() || item.fields?.phone || '';
    if (!telefoon || telefoon.length < 8) continue;

    // Format telefoon
    telefoon = telefoon.replace(/[\s()\-\.]/g, '');
    telefoon = telefoon.replace(/^(\+31)0/, '$1');
    if (telefoon.startsWith('06')) telefoon = '+31' + telefoon.substring(1);
    if (telefoon.startsWith('0031')) telefoon = '+' + telefoon.substring(2);
    if (telefoon.startsWith('31') && !telefoon.startsWith('+')) telefoon = '+' + telefoon;
    if (!telefoon.startsWith('+')) telefoon = '+31' + telefoon;

    // Haal offerte-link op
    const docData = await rpGet('/document-service/v1/' + PID + '/quotations?lead_configuration_id=' + lcId);
    // Alleen SENT offertes (niet DRAFT) — zoals oude cron
    const docs = (docData?.quotationDatas || []).filter(d => d.quotationStatus === 'SENT' || d.quotationStatus === 'ACCEPTED');
    docs.sort((a, b) => (b.quotationCreationTimestamp || 0) - (a.quotationCreationTimestamp || 0));
    if (!docs[0]) continue;

    const offerteLink = 'https://document.reuzenpanda.nl/nl/' + PID + '/' + docs[0].documentId + '/latest';

    // Stuur WhatsApp via Trengo (zelfde logica als oude cron-sync-rp-hubspot.js)
    try {
      const waRes = await fetchRetry('https://app.trengo.com/api/v2/wa_sessions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + TRENGO_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_phone_number: telefoon,
          hsm_id: WA_OFFERTE_TEMPLATE,
          channel_id: 1359857,
          params: [
            { type: 'body', key: '{{1}}', value: voornaam || 'daar' },
            { type: 'body', key: '{{2}}', value: 'Jaimy' },
            { type: 'body', key: '{{3}}', value: offerteLink },
          ]
        })
      });
      if (waRes.ok) {
        let waData; try { waData = await waRes.json(); } catch { waData = null; }
        if (waData?.message?.ticket_id) {
          // Sluit ticket via POST /close (zoals oude cron)
          await fetchRetry('https://app.trengo.com/api/v2/tickets/' + waData.message.ticket_id + '/close', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + TRENGO_TOKEN, 'Content-Type': 'application/json' },
          }).catch(() => {});
        }
        markWaSent(item.id);
        waCount++;
      }
    } catch (e) {
      console.log('  WA fout ' + item.summary + ': ' + (e.message || '').substring(0, 50));
    }

    await new Promise(r => setTimeout(r, 1500)); // rate limit
  }

  if (waCount > 0) console.log('WhatsApp offerte verstuurd: ' + waCount);

  if (ocItems.length > 0 || ovCount > 0 || waCount > 0) {
    await sendTelegram('Offerte controle v4: ' + okCount + ' OK, ' + fixCount + ' aangepast, ' + routeCount + ' gerouted, ' + errorCount + ' errors\nSheet: ' + sheetRows + ' rijen' + (waCount > 0 ? '\nWhatsApp offerte: ' + waCount + ' verstuurd' : ''));
  }
}

// Test mode: node cron-offerte-controle-v4-combined.js --test <naam>
// Draait alleen op OC items die <naam> bevatten, slaat routing/sheet/status over
const testArg = process.argv.find(a => a === '--test');
const testName = testArg ? process.argv[process.argv.indexOf(testArg) + 1] : null;
if (testName) {
  (async () => {
    console.log('=== TEST MODE: alleen items met "' + testName + '" ===');
    const itemsData = await rpGet('/contact-service/' + PID + '/backlogs/' + BACKLOG_ID + '/items');
    const items = (itemsData?.items || []).filter(i =>
      i.status_id === '64788881-632c-4217-8f56-d20732c94b08' &&
      (i.summary || '').toLowerCase().includes(testName.toLowerCase()) &&
      !i.technical_labels?.some(l => l.type === 'ITEM_ARCHIVED')
    );
    console.log('Gevonden: ' + items.length + ' items');
    for (const item of items) {
      const lcId = item.item_subject?.id;
      if (!lcId) continue;
      const docInfo = await getDocForItem(lcId);
      if (!docInfo) continue;
      const fullData = await getFullDoc(docInfo.documentId);
      if (!fullData?.quotationData) continue;
      const qd = fullData.quotationData;
      const plg = qd.segments?.defaultTemplatePriceLineGroup;
      if (!plg?.data?.lines) continue;

      console.log('\n--- #' + docInfo.quotationNumber + ' ' + item.summary + ' ---');
      const lines = plg.data.lines;
      const origJSON = JSON.stringify(lines);

      // Backup
      const backupDir = path.join(__dirname, '../data/offerte-backups');
      fs.writeFileSync(path.join(backupDir, docInfo.quotationNumber + '-v4test-' + Date.now() + '.json'), JSON.stringify(qd, null, 2));

      // 2a. Markiezen verwerken
      const isMarkies = lines.some(l => l.description?.toLowerCase().includes('markies'));
      if (isMarkies) {
        const mkResult = processMarkiezen(item.description || '', lines);
        if (mkResult.issues.length > 0) {
          console.log('  !! MARKIES ISSUES (zou naar Handmatige controle gaan): ' + mkResult.issues.join('; '));
          continue;
        }
        if (mkResult.lines) { lines.length = 0; lines.push(...mkResult.lines); }
      }

      // 2b. Transform + montage
      let lastCat = null, lastBed = null;
      const catBed = {};
      for (let i = 0; i < lines.length; i++) {
        const firstLine = lines[i].description?.split('\n')[0] || '';
        const bediening = lines[i].description?.match(/Bediening:\s*([^\n]+)/i)?.[1]?.trim() || '';
        const motor = lines[i].description?.match(/Motor:\s*([^\n]+)/i)?.[1]?.trim() || '';
        const cat = getCategory(firstLine);
        if (cat && lines[i].pricePerUnit > 0) {
          lastCat = cat; lastBed = getBedType(bediening, motor);
          catBed[cat] = lastBed;
          const newDesc = transformProductDesc(lines[i].description, lastCat, lastBed);
          if (newDesc !== lines[i].description) lines[i].description = newDesc;
          // Prijscorrectie (niet bij voorraadschermen)
          const pKey = getProductKey(firstLine);
          if (pKey && !firstLine.toLowerCase().includes('voorraad')) {
            const maat = extractMaatFromDesc(lines[i].description);
            if (maat.breedte || maat.hoogte) {
              const pc = correctProductPrice(lines[i], pKey, maat.breedte, maat.hoogte, maat.uitval);
              if (pc.priceUnknown) console.log('  !! Prijs niet bepaalbaar voor "' + firstLine + '" (zou naar Handmatige controle gaan)');
            }
          }
        }
        const d = firstLine.toLowerCase();
        if (d.includes('montage') || d.includes('inmeten')) {
          const mCat = getMontageCategory(d) || lastCat;
          if (mCat && mCat !== 'markies' && catBed[mCat] !== undefined) {
            adjustMontageInPlace(lines[i], mCat, catBed[mCat]);
          }
        }
      }

      // 2c. Enhance (Waarom + V4 opties)
      if (ENHANCE_DESCRIPTIONS) enhanceAllDescriptions(lines);

      // 2d. Bold
      for (const l of lines) {
        const fl = l.description?.split('\n')[0] || '';
        if (!fl.startsWith('**') && l.pricePerUnit > 0) {
          l.description = '**' + fl.replace(/^\*\*|\*\*$/g, '') + '**' + l.description.substring(fl.length);
        }
      }

      // 2e. Herordenen
      const { newLines } = reorderAndMerge(lines);
      plg.data.lines = newLines;

      // 2f. Garantie op 1 regel (nu gedaan in insertWaaromBlock)

      // Waarom Sonty
      addWaaromSontyBlock(qd);

      // Print resultaat
      for (const l of newLines) {
        console.log('\n' + l.description.split('\n')[0] + ' — €' + l.pricePerUnit + ' x ' + l.units);
        const descLines = l.description.split('\n').slice(1);
        for (const dl of descLines) console.log('  ' + dl);
      }

      // Opslaan
      const ok = await rpPut('/document-service/v1/' + PID + '/quotations/' + docInfo.documentId, qd);
      console.log('\nOpgeslagen: ' + (ok ? 'OK' : 'FOUT'));
    }
  })().catch(e => { console.error(e); process.exit(1); });
} else {
  main().catch(e => { console.error(e); process.exit(1); });
}
